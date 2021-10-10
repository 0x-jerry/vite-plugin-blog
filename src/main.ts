import path from 'path'
import fs from 'fs-extra'
import { PluginOption } from 'vite'
import rm from 'rimraf'
import { changeImageSrcPlugin } from './plugin/changeImageSrc'
import { changeHrefPlugin } from './plugin/changeHref'
import { BlogServiceConfig, BlogService } from './BlogService'
import { ChangeTagOption, changeTagPlugin } from './plugin/changeTag'

export type BlogPluginConfig = Omit<BlogServiceConfig, 'watch'> & {
  pluginOpt: {
    changeTag?: ChangeTagOption
  }

  folder: {
    posts?: string
  }

  onAfterBuild(ctx: BlogService): Promise<void> | void
}

export function createBlogPlugin(opt: Partial<BlogPluginConfig> = {}): PluginOption {
  let init = false

  return {
    name: 'vite-plugin-blog',
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

      await ctx.transformAllMarkdown()

      // clear output dir
      rm.sync(ctx.outDir)

      // generate excerpts
      await ctx.generateImportAll({
        filePattern: (opt.folder?.posts ?? 'posts') + '/**/*.md',
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
