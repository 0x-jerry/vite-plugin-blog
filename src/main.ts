import { Plugin } from 'vite'
import fs from 'fs-extra'
import glob from 'fast-glob'
import path from 'path'
import chokidar from 'chokidar'
import { JSDOM } from 'jsdom'
import { measure, save } from './utils'
import { changeImageSrcPlugin } from './plugin/changeImageSrc'
import { changeHrefPlugin } from './plugin/changeHref'
import { CurrentFileContext, ViteBlogConfig } from './types'
import { createMd2Vue, Md2Vue } from './md2vue'

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
  md2vue: Md2Vue
  transform: typeof transformMarkdown
}

async function startBlogService(opt: ViteBlogConfig, watch = true) {
  if (init) return

  init = true

  const md2vue = createMd2Vue({})

  const ctx: BlogContext = {
    glob: [mdGlob, ...opt.excludes.map((n) => '!' + n)],
    conf: opt,
    md2vue,
    transform: measure(transformMarkdown),
  }

  await transformAllMarkdown(ctx)

  if (!watch) {
    return
  }

  const watcher = chokidar.watch(ctx.glob, { cwd: opt.root })

  watcher.on('change', async (file) => {
    await transformMarkdownFile(ctx, file)
  })

  watcher.on('add', async (file) => {
    await transformMarkdownFile(ctx, file)
  })

  watcher.on('unlink', async (file) => {
    const outFilePath = path.join(opt.outDir, file.replace(/\.\w+$/, '.vue'))

    if (await fs.pathExists(outFilePath)) {
      await fs.unlink(outFilePath)
    }
  })
}

async function transformAllMarkdown(ctx: BlogContext) {
  const { conf } = ctx

  const mdFiles = await glob(ctx.glob, {
    cwd: conf.root,
  })

  for (const file of mdFiles) {
    await transformMarkdownFile(ctx, file)
  }
}

/**
 *
 * @param ctx
 * @param file 相对路径 relative path
 */
async function transformMarkdownFile(ctx: BlogContext, file: string) {
  const input = path.join(ctx.conf.root, file)
  const output = input.replace(/\.md$/, '.vue')

  const fileContext: CurrentFileContext = {
    file: input,
    outFile: output,
  }

  const sfc = await ctx.transform(ctx, fileContext)

  await save(output, sfc)
}

async function transformMarkdown(ctx: BlogContext, fileCtx: CurrentFileContext) {
  const { conf } = ctx
  // const mdFilePath = path.join(conf.root, file)

  const result = await ctx.md2vue(fileCtx.file)

  const $html = new JSDOM(result.html)

  for (const plugin of conf.plugins) {
    await plugin.beforeWriteHtml($html, fileCtx)
  }

  const html = $html.window.document.body.innerHTML

  const sfc = [`<template>${html}</template>`, result.script, ...result.blocks]

  return sfc.join('\n')
}
