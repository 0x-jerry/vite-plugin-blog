import { PluginOption } from 'vite'
import fs from 'fs-extra'
import glob from 'fast-glob'
import path from 'path'
import chokidar from 'chokidar'
import { JSDOM } from 'jsdom'
import { ChangeImageOption, changeImageSrcPlugin } from './plugin/changeImageSrc'
import { ChangeHrefOption, changeHrefPlugin } from './plugin/changeHref'
import { BlogPlugin, CurrentFileContext } from './types'
import { createMd2Vue, Md2Vue } from './md2vue'
import { cacheFs, MDFileInfo } from './cache'

export type BlogPluginConfig = Omit<BlogServiceConfig, 'watch'> & {
  pluginOpt: {
    changeHref?: ChangeHrefOption
    changeImage?: ChangeImageOption
  }
}

export function createBlogPlugin(opt: Partial<BlogPluginConfig> = {}): PluginOption {
  let init = false

  return {
    name: 'vite-plugin-blog',
    async configResolved({ command }) {
      if (init) return
      init = true

      const watch = command === 'serve'

      const plugins = opt.plugins ?? []

      plugins.unshift(
        changeImageSrcPlugin(opt.pluginOpt?.changeImage),
        changeHrefPlugin(opt.pluginOpt?.changeHref)
      )

      const ctx = new BlogService({
        ...opt,
        plugins,
      })

      await buildPostsExcerpt(ctx, 'posts/**/*.md')

      await ctx.transformAllMarkdown()

      if (watch) {
        ctx.watch()
      }
    },
  }
}

async function buildPostsExcerpt(ctx: BlogService, postPattern: string) {
  const files = await glob([postPattern], { cwd: ctx.root })

  for (const file of files) {
    const fileCtx: CurrentFileContext = {
      file: path.join(ctx.root, file),
      outFile: path.join(ctx.root, ctx.outDir, 'post-excerpt', file.replace(/\.md$/, '.vue')),
    }

    await ctx.transformFile(fileCtx)
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
}

export class BlogService {
  globPattern: string[]

  plugins: BlogPlugin[]

  root: string

  outDir: string

  md2vue: Md2Vue

  cache = cacheFs

  constructor(conf: Partial<BlogServiceConfig>) {
    const includes = conf.includes ?? ['**/*.md']
    const excludes = conf.excludes ?? ['**/node_modules', '**/.git']

    this.globPattern = [...includes, ...excludes.map((n) => '!' + n)]

    this.plugins = conf.plugins ?? []

    this.root = conf.root ?? process.cwd()
    this.outDir = conf.out ?? '.blog'

    this.md2vue = createMd2Vue({})
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
    const result = this.md2vue(info)

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
    const output = path.join(this.root, this.outDir, file.replace(/\.md$/, '.vue'))

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
}
