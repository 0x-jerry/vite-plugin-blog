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
    postDir: 'posts',
    noteDir: 'notes',
    plugins: [],
  }
): Plugin {
  opt.postDir = path.resolve(opt.postDir)
  opt.noteDir = path.resolve(opt.noteDir)

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

async function startBlogService(opt: ViteBlogConfig, watch = true) {
  if (init) return

  init = true

  const md2vue = createMd2Vue({})

  const outDir = path.join(opt.outDir, 'posts')

  const transform = measure(transformMarkdown)

  async function transformPosts(opt: ViteBlogConfig) {
    const mdFiles = await glob(mdGlob, {
      cwd: opt.postDir,
    })

    await fs.ensureDir(outDir)
    for (const file of mdFiles) {
      await transform(opt, file, outDir)
    }
  }

  await transformPosts(opt)

  if (!watch) {
    return
  }

  const watcher = chokidar.watch(['**/*.md'], { cwd: opt.postDir })

  watcher.on('change', async (file) => {
    await transform(opt, file, outDir)
  })

  watcher.on('add', async (file) => {
    await transform(opt, file, outDir)
    //
  })

  watcher.on('unlink', async (file) => {
    const outFilePath = path.join(outDir, file.replace(/\.\w+$/, '.vue'))

    if (await fs.pathExists(outFilePath)) {
      await fs.unlink(outFilePath)
    }
  })

  async function transformMarkdown(opt: ViteBlogConfig, file: string, outDir: string) {
    const mdFilePath = path.join(opt.postDir, file)

    const result = await md2vue(mdFilePath)

    const $html = new JSDOM(result.html)

    for (const plugin of opt.plugins) {
      await plugin.beforeWriteHtml($html, { file: mdFilePath, outDir })
    }

    const html = $html.window.document.body.innerHTML

    const sfc = [`<template>${html}</template>`, result.script, ...result.blocks]

    await fs.writeFile(
      path.join(outDir, file.replace(/\.\w+$/, '.vue')),
      sfc.map((s) => s.trim()).join('\n\n')
    )
  }
}
