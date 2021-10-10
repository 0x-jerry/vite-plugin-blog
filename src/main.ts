import path from 'path'
import fs from 'fs-extra'
import { PluginOption } from 'vite'
// import rm from 'rimraf'
import { changeImageSrcPlugin } from './plugin/changeImageSrc'
import { changeHrefPlugin } from './plugin/changeHref'
import { BlogServiceConfig, BlogService } from './BlogService'
import { ChangeTagOption, changeTagPlugin } from './plugin/changeTag'

export type BlogPluginConfig = Omit<BlogServiceConfig, 'watch'> & {
  pluginOpt: {
    changeTag?: ChangeTagOption
  }

  onAfterBuild?(ctx: BlogService): Promise<void> | void
}

export function createBlogPlugin(opt: Partial<BlogPluginConfig> = {}): PluginOption {
  let init = false

  return {
    name: 'vite-plugin-blog',
    enforce: 'post',
    async configResolved({ command }) {
      if (init) return
      init = true

      const watch = command === 'serve'

      const internalPlugins = [
        changeImageSrcPlugin(),
        changeHrefPlugin(),
        changeTagPlugin(opt.pluginOpt?.changeTag),
      ]

      const plugins = internalPlugins.concat(opt.plugins ?? [])

      const ctx = new BlogService({
        ...opt,
        plugins,
        command,
      })

      // avoid other vite plugin access dist file.
      // const outDir = path.join(opt.root ?? process.cwd(), opt.out ?? '.blog')
      // rm.sync(ctx.outDir)

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
    },
  }
}
