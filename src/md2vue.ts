import marked from 'marked'
import matter from 'gray-matter'

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

function md2vue(content: string, opt: MdRenderOption = {}) {
  const frontmatter = matter(content, {
    excerpt_separator: '<!-- more -->',
  })

  const layout = frontmatter.data?.layout

  let rendered = marked(frontmatter.content)

  const tag = opt.wrapper || 'div'
  rendered = `<${tag} v-bind="frontmatter">${rendered}</${tag}>`

  const html = rendered

  const script = `<script setup>
const frontmatter = ${JSON.stringify(frontmatter.data || {})}
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

  return { html, script, blocks, frontmatter }
}
