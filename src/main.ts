import path from 'path'
import fs from 'fs-extra'
import { PluginOption } from 'vite'
import { ChangeImageOption, changeImageSrcPlugin } from './plugin/changeImageSrc'
import { ChangeHrefOption, changeHrefPlugin } from './plugin/changeHref'
import { BlogServiceConfig, BlogService } from './BlogService'

export type BlogPluginConfig = Omit<BlogServiceConfig, 'watch'> & {
  pluginOpt: {
    changeHref?: ChangeHrefOption
    changeImage?: ChangeImageOption
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

      const plugins = opt.plugins ?? []

      plugins.unshift(
        changeImageSrcPlugin(opt.pluginOpt?.changeImage),
        changeHrefPlugin(opt.pluginOpt?.changeHref)
      )

      const ctx = new BlogService({
        ...opt,
        plugins,
        command,
      })

      await ctx.transformAllMarkdown()

      // generate excerpts
      await ctx.generateImportAll({
        filePattern: (opt.folder?.posts ?? 'posts') + '/**/*.md',
        dir: 'excerpts',
        async transformFile(fileContext, ctx) {
          const info = await ctx.cache.read(fileContext.file)

          const sfc = await ctx.transformMarkdown(
            {
              ...info,
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
