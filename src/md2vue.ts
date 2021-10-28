import marked from 'marked'
import { MDFileInfo } from './BlogService'
import { anchorExt } from './marked/anchor'
import { highlightExt } from './marked/highlight'

function initMarked() {
  marked.use(
    highlightExt({
      defaultLanguage: 'markup',
    }),
    anchorExt()
  )
}

export function createMd2Vue() {
  initMarked()

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
