import { Plugin } from 'vite'
import fs from 'fs-extra'
import glob from 'fast-glob'
import path from 'path'
import chokidar from 'chokidar'
import { JSDOM } from 'jsdom'
import { changeImageSrcPlugin } from './plugin/changeImageSrc'
import { changeHrefPlugin } from './plugin/changeHref'
import { BlogPlugin, CurrentFileContext } from './types'
import { createMd2Vue, Md2Vue } from './md2vue'

export type BlogPluginConfig = Omit<BlogServiceConfig, 'watch'>

export function createBlogPlugin(opt: Partial<BlogPluginConfig> = {}): Plugin {
  let init = false

  return {
    name: 'vite-plugin-blog',
    async configResolved({ command }) {
      if (init) return
      init = true

      const watch = command === 'serve'

      const plugins = opt.plugins ?? []

      plugins.unshift(changeImageSrcPlugin, changeHrefPlugin)

      const ctx = new BlogService({
        ...opt,
        watch,
        plugins,
      })

      await ctx.transformAllMarkdown()
    },
  }
}

export interface BlogServiceConfig {
  /**
   * glob
   */
  includes: string[]
  /**
   * glob
   */
  excludes: string[]

  /**
   *
   */
  root: string

  out: string

  plugins: BlogPlugin[]

  /**
   * @default false
   */
  watch: boolean
}

export class BlogService {
  globPattern: string[]

  plugins: BlogPlugin[]

  root: string

  outDir: string

  md2vue: Md2Vue

  constructor(conf: Partial<BlogServiceConfig>) {
    const includes = conf.includes ?? ['**/*.md']
    const excludes = conf.excludes ?? ['**/node_modules', '**/.git']

    this.globPattern = [...includes, ...excludes.map((n) => '!' + n)]

    this.plugins = conf.plugins ?? []

    this.root = conf.root ?? process.cwd()
    this.outDir = conf.out ?? '.blog'

    this.md2vue = createMd2Vue({})

    if (conf.watch) {
      this.#watch()
    }
  }

  #watch() {
    const watcher = chokidar.watch(this.globPattern, { cwd: this.root })

    watcher.on('change', async (file) => {
      await this.transformFile(file)
    })

    watcher.on('add', async (file) => {
      await this.transformFile(file)
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
      await this.transformFile(file)
    }
  }

  async transformMarkdown(ctx: CurrentFileContext) {
    const result = await this.md2vue(ctx.file)

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
  async transformFile(file: string) {
    const input = path.join(this.root, file)
    const output = path.join(this.root, this.outDir, file.replace(/\.md$/, '.vue'))

    const fileContext: CurrentFileContext = {
      file: input,
      outFile: output,
    }

    const sfc = await this.transformMarkdown(fileContext)

    await fs.ensureDir(path.parse(fileContext.outFile).dir)
    await fs.writeFile(fileContext.outFile, sfc)
  }
}
