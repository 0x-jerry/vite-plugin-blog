import { Plugin } from 'vite'
import fs from 'fs-extra'
import glob from 'fast-glob'
import path from 'path'
import chokidar from 'chokidar'
import { JSDOM } from 'jsdom'
import { changeImageSrcPlugin } from './plugin/changeImageSrc'
import { changeHrefPlugin } from './plugin/changeHref'
import { CurrentFileContext, ViteBlogConfig } from './types'
import { createMd2Vue, Md2Vue } from './md2vue'

export function createBlogPlugin(opt: Partial<ViteBlogConfig> = {}): Plugin {
  const defaultOpt: ViteBlogConfig = {
    outDir: '.blog',
    excludes: ['**/node_modules', '**/.git'],
    root: process.cwd(),
    plugins: [],
  }

  const conf: ViteBlogConfig = Object.assign(defaultOpt, opt)

  // default plugin
  conf.plugins.push(
    //
    changeImageSrcPlugin,
    changeHrefPlugin
  )

  return {
    name: 'vite-plugin-blog',
    async configResolved({ command }) {
      const isBuild = command === 'build'

      await startBlogService(conf, !isBuild)
    },
  }
}

let init = false

async function startBlogService(opt: ViteBlogConfig, watch = true) {
  if (init) return

  init = true

  const md2vue = createMd2Vue({})

  const ctx = new BlogService(opt, md2vue)

  await ctx.transformAllMarkdown()

  if (!watch) {
    return
  }

  const watcher = chokidar.watch(ctx.globPattern, { cwd: opt.root })

  watcher.on('change', async (file) => {
    await ctx.transformFile(file)
  })

  watcher.on('add', async (file) => {
    await ctx.transformFile(file)
  })

  watcher.on('unlink', async (file) => {
    const outFilePath = path.join(opt.outDir, file.replace(/\.\w+$/, '.vue'))

    if (await fs.pathExists(outFilePath)) {
      await fs.unlink(outFilePath)
    }
  })
}

export class BlogService {
  globPattern: string[]

  constructor(public conf: ViteBlogConfig, public md2vue: Md2Vue) {
    this.globPattern = ['**/*.md', ...conf.excludes.map((n) => '!' + n)]
  }

  async transformAllMarkdown() {
    const mdFiles = await glob(this.globPattern, {
      cwd: this.conf.root,
    })

    for (const file of mdFiles) {
      await this.transformFile(file)
    }
  }

  async transformMarkdown(ctx: CurrentFileContext) {
    const result = await this.md2vue(ctx.file)

    const $html = new JSDOM(result.html)

    for (const plugin of this.conf.plugins) {
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
    const input = path.join(this.conf.root, file)
    const output = input.replace(/\.md$/, '.vue')

    const fileContext: CurrentFileContext = {
      file: input,
      outFile: output,
    }

    const sfc = await this.transformMarkdown(fileContext)

    await fs.ensureDir(path.parse(file).dir)
    await fs.writeFile(file, sfc)
  }
}
