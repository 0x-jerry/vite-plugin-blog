import path from 'path'
import fs from 'fs-extra'
import { PluginOption } from 'vite'
import rm from 'rimraf'
import { changeImageSrcPlugin } from './plugin/changeImageSrc'
import { changeHrefPlugin } from './plugin/changeHref'
import { BlogServiceConfig, BlogService } from './BlogService'
import { changeTagPlugin } from './plugin/changeTag'

export type BlogPluginConfig = Omit<BlogServiceConfig, 'watch'> & {
  /**
   * @default '{}'
   */
  changeTagMap?: Record<string, string>
  /**
   * @default '/post'
   */
  postHrefPrefix?: string

  onAfterBuild?(ctx: BlogService): Promise<void> | void
}

export function createBlogPlugin(opt: Partial<BlogPluginConfig> = {}): PluginOption {
  let init = false

  async function initPlugin(command: 'serve' | 'build') {
    if (init) return
    init = true

    const watch = command === 'serve'

    const plugins = [
      // apply before
      changeHrefPlugin({ postHrePrefix: opt.postHrefPrefix }),
      changeImageSrcPlugin(),

      ...(opt.plugins ?? []),

      // apply after
      changeTagPlugin({ map: opt.changeTagMap }),
    ]

    const ctx = new BlogService({
      ...opt,
      plugins,
      command,
    })

    // avoid other vite plugin access dist file.
    rm.sync(ctx.outDir)

    await ctx.transformAllMarkdown()

    // generate excerpts
    await ctx.generateImportAll({
      filePattern: ctx.postsDir + '/**/*.md',
      dir: 'excerpts',
      async transformFile(fileContext, ctx) {
        const info = await ctx.cache.read(fileContext.file)

        const sfc = await ctx.transformMarkdown(
          {
            ...info,
            type: 'excerpt',
            content: info.excerpt,
          },
          fileContext
        )

        await fs.ensureDir(path.parse(fileContext.outFile).dir)
        await fs.writeFile(fileContext.outFile, sfc)
      },
    })

    await opt.onAfterBuild?.(ctx)

    if (watch) {
      ctx.watch()
    }
  }

  return {
    name: 'vite-plugin-blog',
    enforce: 'pre',
    async config(conf, env) {
      await initPlugin(env.command)
      return conf
    },
  }
}
