import marked from 'marked'
import fs from 'fs-extra'
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

async function md2vue(file: string, opt: MdRenderOption = {}) {
  const content = await fs.readFile(file, { encoding: 'utf-8' })

  const mdMatter = matter(content, {
    excerpt_separator: '<!-- more -->',
  })

  const layout = mdMatter.data?.layout

  let rendered = marked(mdMatter.content)

  const tag = opt.wrapper || 'div'
  rendered = `<${tag} v-bind="frontmatter">${rendered}</${tag}>`

  const html = rendered

  const script = `<script setup>
const frontmatter = ${JSON.stringify(mdMatter.data || {})}
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

  return { html, script, blocks }
}