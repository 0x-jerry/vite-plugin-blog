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
      '~/': `${path.resolve(__dirname, 'src')}/`,
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
      // allow auto load markdown components under `./src/components/`
      extensions: ['vue'],

      // allow auto import and register components used in markdown
      include: [/\.vue$/, /\.vue\?vue/],

      dts: 'src/components.d.ts',
    }),

    createBlogPlugin({
      changeTagMap: {
        a: 'v-link',
        audio: 'v-audio',
      },
      async onAfterBuild(ctx) {
        await ctx.generateImportAll({
          filePattern: 'notes/**/*.md',
          filename: 'notes.ts',
        })
      },
      transform: {
        afterRead() {
          return {
            test: 1,
          }
        },
      },
      debug: true,
      markedPluginOption: {
        highlight: {
          theme: 'solarized-light',
        },
      },
    }),
  ],

  server: {
    fs: {
      strict: true,
    },
  },

  // https://github.com/antfu/vite-ssg
  // @ts-ignore
  ssgOptions: {
    script: 'async',
    formatting: 'minify',
  },

  optimizeDeps: {
    include: ['vue', 'vue-router'],
    exclude: ['vue-demi'],
  },
})
