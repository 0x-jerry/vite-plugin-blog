import marked from 'marked'
import { MDFileInfo } from './BlogService'

export interface Md2VueOption {
  wrapper?: string
}

function initMarked(opt: Md2VueOption) {
  // marked.use({})
  //
}

export function createMd2Vue(opt: Md2VueOption) {
  initMarked(opt)

  return md2vue
}

export interface MdRenderOption {
  wrapper?: string
}

export type Md2Vue = typeof md2vue

export type Md2VueResult = ReturnType<Md2Vue>

function md2vue(info: MDFileInfo, opt: MdRenderOption = {}) {
  const layout = info.matter?.layout

  let rendered = marked(info.content)

  const tag = opt.wrapper || 'div'
  rendered = `<${tag} v-bind="frontmatter">${rendered}</${tag}>`

  const html = rendered

  const script = `<script setup>
const frontmatter = ${JSON.stringify(info.matter || {})}
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
