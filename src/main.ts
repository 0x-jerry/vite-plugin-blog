import { Plugin } from 'vite'
import fs from 'fs-extra'
import glob from 'fast-glob'
import path from 'path'
import chokidar from 'chokidar'
import { JSDOM } from 'jsdom'
import { measure } from './utils'
import { changeImageSrcPlugin } from './plugin/changeImageSrc'
import { changeHrefPlugin } from './plugin/changeHref'
import { ViteBlogConfig } from './types'
import { createMd2Vue } from './md2vue'

export function createBlogPlugin(
  opt: ViteBlogConfig = {
    outDir: '.blog',
    excludes: ['**/node_modules', '**/.git'],
    root: process.cwd(),
    plugins: [],
  }
): Plugin {
  opt.plugins.push(changeImageSrcPlugin, changeHrefPlugin)

  return {
    name: 'vite-plugin-blog',
    async configResolved(conf) {
      const isBuild = conf.command === 'build'
      await startBlogService(opt, !isBuild)
    },
  }
}

const mdGlob = '**/*.md'

let init = false

interface BlogContext {
  glob: string[]
  conf: ViteBlogConfig
}

async function startBlogService(opt: ViteBlogConfig, watch = true) {
  if (init) return

  init = true

  const ctx: BlogContext = {
    glob: [mdGlob, ...opt.excludes.map((n) => '!' + n)],
    conf: opt,
  }

  const md2vue = createMd2Vue({})

  const outDir = path.join(opt.outDir)

  const transform = measure(transformMarkdown)

  await transformAllMarkdown(ctx)

  if (!watch) {
    return
  }

  const watcher = chokidar.watch(ctx.glob, { cwd: opt.root })

  watcher.on('change', async (file) => {
    await transform(ctx, file, outDir)
  })

  watcher.on('add', async (file) => {
    await transform(ctx, file, outDir)
    //
  })

  watcher.on('unlink', async (file) => {
    const outFilePath = path.join(outDir, file.replace(/\.\w+$/, '.vue'))

    if (await fs.pathExists(outFilePath)) {
      await fs.unlink(outFilePath)
    }
  })

  async function transformAllMarkdown(ctx: BlogContext) {
    const { conf } = ctx

    const mdFiles = await glob(ctx.glob, {
      cwd: conf.root,
    })

    for (const file of mdFiles) {
      await transform(ctx, file, conf.outDir)
    }
  }

  async function transformMarkdown(ctx: BlogContext, file: string, outDir: string) {
    const { conf } = ctx
    const mdFilePath = path.join(conf.root, file)

    const result = await md2vue(mdFilePath)

    const $html = new JSDOM(result.html)

    for (const plugin of conf.plugins) {
      await plugin.beforeWriteHtml($html, { file: mdFilePath, outDir })
    }

    const html = $html.window.document.body.innerHTML

    const sfc = [`<template>${html}</template>`, result.script, ...result.blocks]

    const outFile = path.join(outDir, file.replace(/\.\w+$/, '.vue'))

    await fs.ensureDir(path.parse(outFile).dir)
    await fs.writeFile(outFile, sfc.map((s) => s.trim()).join('\n\n'))
  }
}
