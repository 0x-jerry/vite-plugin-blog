import marked from 'marked'
import { MDFileInfo } from './BlogService'
import { anchorExt } from './marked/anchor'
import { highlightExt, HighlightExtOption } from './marked/highlight'

export interface MarkedPluginOption {
  highlight: Partial<HighlightExtOption>
}

async function initMarked(opt: Partial<MarkedPluginOption> = {}) {
  marked.use(
    await highlightExt(
      Object.assign(
        {
          defaultLang: 'ini',
          highlightLines: true,
        },
        opt.highlight
      )
    ),
    anchorExt()
  )
}

export async function createMd2Vue(opt: Partial<MarkedPluginOption> = {}) {
  await initMarked(opt)

  return md2vue
}

export interface MdRenderOption {
  wrapper?: string
  extra?: Record<string, any>
}

export type Md2Vue = typeof md2vue

export type Md2VueResult = ReturnType<Md2Vue>

function md2vue(info: MDFileInfo, opt: MdRenderOption = {}) {
  const layout = info.matter?.layout

  let rendered = marked(info.content)

  const tag = opt.wrapper || 'div'
  rendered = `<${tag} v-bind="frontmatter">${rendered}</${tag}>`

  const html = rendered

  const frontmatter = Object.assign({}, info.matter, opt.extra)

  const script = `<script setup>
const frontmatter = ${JSON.stringify(frontmatter)}
</script>`

  const blocks = []

  if (layout) {
    blocks.push(
      `<route>
${JSON.stringify({
  meta: {
    layout,
  },
})}
</route>`
    )
  }

  return { html, script, blocks, frontmatter: info.matter }
}
