import fs from 'fs-extra'
import glob from 'fast-glob'
import path from 'path'
import chokidar from 'chokidar'
import { JSDOM } from 'jsdom'
import { BlogPlugin, CurrentFileContext, MayPromise } from './types'
import { createMd2Vue, Md2Vue, MdRenderOption, MarkedPluginOption } from './md2vue'
import { ImportAllOption, importAll } from './generator/importAll'
import { MDFileInfo, CacheCore } from './CacheCore'

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
    /**
     * after read markdown file
     * @param info
     */
    afterRead?(info: Omit<MDFileInfo, 'extra'>): MayPromise<Record<string, any>>

    /**
     * before transform markdown file
     * @param info
     */
    before?(info: MDFileInfo): MayPromise<MdRenderOption>
  }

  markedPluginOption: Partial<MarkedPluginOption>
}

export class BlogService {
  globPattern: string[]

  plugins: BlogPlugin[]

  readonly root: string

  readonly outDir: string

  readonly postsDir: string

  readonly command: 'build' | 'serve'

  readonly debug: boolean

  md2vue!: Md2Vue

  cache: CacheCore

  transform?: BlogServiceConfig['transform']

  constructor(private conf: Partial<BlogServiceConfig>) {
    this.postsDir = conf.postsDir ?? 'posts'
    this.debug = conf.debug ?? false

    this.globPattern = [this.postsDir + '/**/*.md']

    this.plugins = conf.plugins ?? []

    this.root = conf.root ?? process.cwd()
    this.outDir = path.join(this.root, conf.out ?? '.blog')

    this.command = conf.command || 'build'
    this.transform = conf.transform

    this.cache = new CacheCore(path.join(this.outDir, '.cache'), this.debug)
  }

  async init() {
    this.md2vue = await createMd2Vue(this.conf.markedPluginOption)
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

    const before = this.transform?.before

    const opt = before ? await before(info) : info

    const result = this.md2vue(info, opt)

    const $html = new JSDOM(result.html)

    for (const plugin of this.plugins) {
      await plugin.beforeWriteHtml?.call(this, $html, ctx, info)
    }

    let html = $html.window.document.body.innerHTML

    // fix anchor
    html = html.replace(/href="about:blank/g, 'href="')

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
    const content = await this.cache.read(fileContext.file, this.transform?.afterRead)

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
