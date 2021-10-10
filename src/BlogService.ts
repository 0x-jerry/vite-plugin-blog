import fs from 'fs-extra'
import glob from 'fast-glob'
import path from 'path'
import chokidar from 'chokidar'
import matter from 'gray-matter'
import { JSDOM } from 'jsdom'
import { BlogPlugin, CurrentFileContext } from './types'
import { createMd2Vue, Md2Vue, MdRenderOption } from './md2vue'
import { ImportAllOption, importAll } from './generator/importAll'

export interface MDFileInfo<T = any> {
  path: string
  matter: T
  mtime: Date

  content: string
  excerpt: string

  type?: 'excerpt'
}

class CacheFs {
  cache = new Map<string, MDFileInfo>()

  async read(path: string): Promise<MDFileInfo> {
    const hit = this.cache.get(path)

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

    this.cache.set(path, info)

    return info
  }
}

export interface BlogServiceConfig {
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

  root: string

  outDir: string

  md2vue: Md2Vue

  cache = new CacheFs()

  command: 'build' | 'serve'

  transform?: BlogServiceConfig['transform']

  constructor(conf: Partial<BlogServiceConfig>) {
    const postDir = conf.postsDir ?? 'posts'

    this.globPattern = [postDir + '/**/*.md']

    this.plugins = conf.plugins ?? []

    this.root = conf.root ?? process.cwd()
    this.outDir = path.join(this.root, conf.out ?? '.blog')

    this.md2vue = createMd2Vue()

    this.command = conf.command || 'build'
    this.transform = conf.transform
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

    for (const file of mdFiles) {
      await this.transformRelativeFile(file)
    }
  }

  async transformMarkdown(info: MDFileInfo, ctx: CurrentFileContext) {
    const opt = this.transform?.before?.(info)

    const result = this.md2vue(info, opt)

    const $html = new JSDOM(result.html)

    for (const plugin of this.plugins) {
      await plugin.beforeWriteHtml?.($html, ctx)
    }

    const html = $html.window.document.body.innerHTML

    const sfc = [`<template>${html}</template>`, result.script, ...result.blocks]

    return sfc.join('\n')
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
