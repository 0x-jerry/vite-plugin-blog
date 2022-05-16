# Vite Plugin Blog

以 `Hexo` 的方式处理 `markdown` 文件，使用方式见 [`example`](./example) 文件夹。

## 使用

```ts
import path from 'path'
import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import Pages from 'vite-plugin-pages'
import Layouts from 'vite-plugin-vue-layouts'
import Components from 'unplugin-vue-components/vite'
import { createBlogPlugin } from 'vite-plugin-blog'

export default defineConfig({
  resolve: {
    alias: {
      '@/': `${path.resolve(__dirname, 'src')}/`,
      '~blog/': `${path.resolve(__dirname, '.blog')}/`,
    },
  },
  plugins: [
    Vue(),

    // https://github.com/hannoeru/vite-plugin-pages
    Pages({
      extensions: ['vue'],
      pagesDir: [
        'src/pages',
        // 文章具体的路由
        {
          dir: '.blog/posts',
          baseRoute: 'post',
        },
      ],
    }),

    // https://github.com/JohnCampionJr/vite-plugin-vue-layouts
    Layouts(),

    // https://github.com/antfu/unplugin-vue-components
    Components({
      extensions: ['vue'],
      include: [/\.vue$/, /\.vue\?vue/],
      dts: 'src/components.d.ts',
    }),

    createBlogPlugin({
      // 替换 markdown 生成的 html 中的 tag，配合 `unplugin-vue-components` 插件，可支持 vue 组件
      changeTagMap: {
        a: 'v-link',
        audio: 'v-audio',
      },
      async onAfterBuild(ctx) {
        // 转换其它 markdown 文件，非 `post` 文件夹
        await ctx.generateImportAll({
          filePattern: 'notes/**/*.md',
          filename: 'notes.ts',
        })
      },
      transform: {
        // 读取 markdown 文件之后，增加额外的自定义数据
        afterRead(info) {
          console.log(info)
          return {
            test: 1,
          }
        },
      },
      // marked 插件相关选项
      markedPluginOption: {
        highlight: {
          theme: 'solarized-light',
        },
      },
    }),
  ],

  // https://github.com/antfu/vite-ssg
  ssgOptions: {
    script: 'async',
    formatting: 'minify',
  },
})
```

具体使用示例，可参考 [blog](https://github.com/0x-jerry/blog)。

## 原理

通过 vite 自动把 `markdown` 文件转换成 `vue` 文件并保存到 `.blog` 文件夹里。

并在转换过程中，注入 `front-matter` 等相关的数据。

## 功能

1. 支持 [layout][hexo-layout]，需要 [vite-plugin-vue-layouts] 插件配合一起使用
2. 支持 `posts` 文件转换成 `vue`
3. 支持自定义音频/视频标签，需要 [unplugin-vue-components] 插件配合一起使用
4. 支持生成摘要内容

## TODO

- [ ] 摘要内容分页

## 贡献

任何形式的贡献都欢迎。

[hexo-layout]: https://hexo.io/docs/front-matter#Settings-amp-Their-Default-Values
[vite-plugin-vue-layouts]: https://github.com/JohnCampionJr/vite-plugin-vue-layouts
[vite-plugin-pages]: https://github.com/hannoeru/vite-plugin-pages
[unplugin-vue-components]: https://github.com/antfu/unplugin-vue-components
