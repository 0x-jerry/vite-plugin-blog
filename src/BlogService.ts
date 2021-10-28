import fs from 'fs-extra'
import glob from 'fast-glob'
import path from 'path'
import chokidar from 'chokidar'
import matter from 'gray-matter'
import { JSDOM } from 'jsdom'
import { BlogPlugin, CurrentFileContext } from './types'
import { createMd2Vue, Md2Vue, MdRenderOption } from './md2vue'
import { ImportAllOption, importAll } from './generator/importAll'
import debounce from 'lodash/debounce'
import serialize from 'serialize-javascript'
import md5 from 'md5'

export interface MDFileInfo<T = any> {
  path: string
  matter: T
  mtime: Date

  content: string
  excerpt: string

  type?: 'excerpt'
}

class CacheCore {
  #cache: Record<string, MDFileInfo> = {}

  get cacheData() {
    return this.#cache
  }

  #transformResult: Record<string, string | undefined> = {}

  constructor(public readonly config: string, public readonly disable: boolean = false) {}

  #save = debounce(async () => {
    await fs.ensureFile(this.config)

    const text = serialize({
      cache: this.#cache,
      transform: this.#transformResult,
    })

    await fs.writeFile(this.config, text)
  }, 100)

  async init() {
    if (!(await fs.pathExists(this.config))) {
      return
    }

    const content = await fs.readFile(this.config, {
      encoding: 'utf-8',
    })

    function deserialize(serializedJavascript: string) {
      return (0, eval)('(' + serializedJavascript + ')')
    }

    const data = deserialize(content)

    this.#cache = data.cache
    this.#transformResult = data.transform
  }

  hasTransformed(fileCtx: CurrentFileContext, info: MDFileInfo) {
    if (this.disable) return

    const hash = md5(fileCtx.file + fileCtx.outFile + JSON.stringify(info))
    const hit = this.#transformResult[hash]

    return hit
  }

  setTransformedCache(fileCtx: CurrentFileContext, info: MDFileInfo, code: string) {
    const hash = md5(fileCtx.file + fileCtx.outFile + JSON.stringify(info))
    this.#transformResult[hash] = code

    this.#save()
  }

  async read(path: string): Promise<MDFileInfo> {
    const hit = this.#cache[path]

    const stat = await fs.stat(path)

    if (stat.mtime.getTime() === hit?.mtime.getTime()) {
      return hit
    }

    const content = await fs.readFile(path, { encoding: 'utf-8' })

    const frontmatter = matter(content, {
      excerpt_separator: '<!-- more -->',
    })

    const footLinksReg = /^\[[^\^][^\]]*\]\:.+$/gm
    const links = frontmatter.content.match(footLinksReg) || []

    const excerpt = [frontmatter.excerpt, links.join('\n')].filter(Boolean).join('\n')

    const info: MDFileInfo = {
      path: path,
      mtime: stat.mtime,

      matter: frontmatter.data,
      content: frontmatter.content,
      excerpt: excerpt,
    }

    this.#cache[path] = info

    this.#save()
    return info
  }
}

export interface BlogServiceConfig {
  /**
   * @default false
   */
  debug: boolean

  postsDir: string

  /**
   *
   */
  root: string

  out: string

  plugins: BlogPlugin[]

  /**
   * vite command config
   */
  command: 'build' | 'serve'

  transform: {
    before?(info: MDFileInfo): MdRenderOption
    // after?(result: Md2VueResult): Promise<Md2VueResult> | Md2VueResult
  }
}

export class BlogService {
  globPattern: string[]

  plugins: BlogPlugin[]

  readonly root: string

  readonly outDir: string

  readonly postsDir: string

  readonly command: 'build' | 'serve'

  readonly debug: boolean

  md2vue: Md2Vue

  cache: CacheCore

  transform?: BlogServiceConfig['transform']

  constructor(conf: Partial<BlogServiceConfig>) {
    this.postsDir = conf.postsDir ?? 'posts'
    this.debug = conf.debug ?? false

    this.globPattern = [this.postsDir + '/**/*.md']

    this.plugins = conf.plugins ?? []

    this.root = conf.root ?? process.cwd()
    this.outDir = path.join(this.root, conf.out ?? '.blog')

    this.md2vue = createMd2Vue()

    this.command = conf.command || 'build'
    this.transform = conf.transform

    this.cache = new CacheCore(path.join(this.outDir, '.cache'), this.debug)
  }

  async init() {
    await this.cache.init()
  }

  watch() {
    const watcher = chokidar.watch(this.globPattern, { cwd: this.root })

    watcher.on('change', async (file) => {
      await this.transformRelativeFile(file)
    })

    watcher.on('add', async (file) => {
      await this.transformRelativeFile(file)
    })

    watcher.on('unlink', async (file) => {
      const outFilePath = path.join(this.outDir, file.replace(/\.\w+$/, '.vue'))

      if (await fs.pathExists(outFilePath)) {
        await fs.unlink(outFilePath)
      }
    })
  }

  async transformAllMarkdown() {
    const mdFiles = await glob(this.globPattern, {
      cwd: this.root,
    })

    await Promise.all(mdFiles.map((file) => this.transformRelativeFile(file)))
  }

  async transformMarkdown(info: MDFileInfo, ctx: CurrentFileContext) {
    const hit = this.cache.hasTransformed(ctx, info)

    if (hit) {
      return hit
    }

    const opt = this.transform?.before?.(info)

    const result = this.md2vue(info, opt)

    const $html = new JSDOM(result.html)

    for (const plugin of this.plugins) {
      await plugin.beforeWriteHtml?.call(this, $html, ctx, info)
    }

    const html = $html.window.document.body.innerHTML

    const sfc = [`<template>${html}</template>`, result.script, ...result.blocks]

    const transformResult = sfc.join('\n')

    this.cache.setTransformedCache(ctx, info, transformResult)

    return transformResult
  }

  /**
   *
   * @param file relative path
   */
  async transformRelativeFile(file: string) {
    const input = path.join(this.root, file)
    const output = path.join(this.outDir, file.replace(/\.md$/, '.vue'))

    const fileContext: CurrentFileContext = {
      file: input,
      outFile: output,
    }

    await this.transformFile(fileContext)
  }

  async transformFile(fileContext: CurrentFileContext) {
    const content = await this.cache.read(fileContext.file)

    if (this.cache.hasTransformed(fileContext, content)) {
      return
    }

    const sfc = await this.transformMarkdown(content, fileContext)

    await fs.ensureDir(path.parse(fileContext.outFile).dir)
    await fs.writeFile(fileContext.outFile, sfc)
  }

  async generateImportAll(opt: Omit<ImportAllOption, 'watch'>) {
    return importAll(this, {
      ...opt,
      watch: this.command === 'serve',
    })
  }
}
