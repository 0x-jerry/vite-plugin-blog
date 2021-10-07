import { PluginOption } from 'vite'
import { ChangeImageOption, changeImageSrcPlugin } from './plugin/changeImageSrc'
import { ChangeHrefOption, changeHrefPlugin } from './plugin/changeHref'
import { buildPostsExcerpt } from './generator/excerpts'
import { BlogServiceConfig, BlogService } from './BlogService'

export type BlogPluginConfig = Omit<BlogServiceConfig, 'watch'> & {
  pluginOpt: {
    changeHref?: ChangeHrefOption
    changeImage?: ChangeImageOption
  }
  folder: {
    posts?: string
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

      await ctx.transformAllMarkdown()

      await buildPostsExcerpt(ctx, {
        postPattern: (opt.folder?.posts ?? 'posts') + '/**/*.md',
        watch,
      })

      if (watch) {
        ctx.watch()
      }
    },
  }
}
