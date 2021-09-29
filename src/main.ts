import { Plugin } from 'vite'
import fs from 'fs-extra'
import glob from 'fast-glob'
import path from 'path'
import chokidar from 'chokidar'
import { createMd2Vue } from './md2vue'
import { JSDOM } from 'jsdom'
import { measure } from './utils'

interface BlogServiceConfig {
  postDir: string
  noteDir: string
  outDir: string
}

export function createBlogPlugin(
  opt: BlogServiceConfig = {
    outDir: '.blog',
    postDir: 'posts',
    noteDir: 'notes',
  }
): Plugin {
  opt.postDir = path.resolve(opt.postDir)
  opt.noteDir = path.resolve(opt.noteDir)

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

async function startBlogService(opt: BlogServiceConfig, watch = true) {
  if (init) return

  init = true

  const md2vue = createMd2Vue({})

  const outDir = path.join(opt.outDir, 'posts')

  const transform = measure(transformMarkdown)

  async function transformPosts(opt: BlogServiceConfig) {
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

  async function transformMarkdown(opt: BlogServiceConfig, file: string, outDir: string) {
    const mdFilePath = path.join(opt.postDir, file)

    const result = await md2vue(mdFilePath)

    const $ = new JSDOM(result.html)

    $.window.document.querySelectorAll('img').forEach(($img) => {
      const src = $img.src

      if (/^https?:\/\//.test(src)) return

      const abs = path.resolve(path.parse(mdFilePath).dir, src)
      const relativeSrc = path.relative(outDir, abs)
      $img.src = relativeSrc
    })

    $.window.document.querySelectorAll('a').forEach(($a) => {
      const href = $a.href

      if (/^https?:\/\//.test(href)) return

      $a.href = href.replace(/\.md$/, '')
    })

    const html = $.window.document.body.innerHTML

    const sfc = [`<template>${html}</template>`, result.script, ...result.blocks]

    await fs.writeFile(
      path.join(outDir, file.replace(/\.\w+$/, '.vue')),
      sfc.map((s) => s.trim()).join('\n\n')
    )
  }
}
