import { marked } from 'marked'

export interface AnchorOption {
  /**
   * @default '#'
   */
  symbol?: string
}

export function anchorExt({ symbol = '#' }: AnchorOption = {}): marked.MarkedExtension {
  return {
    renderer: {
      heading(text, level, raw, slugger) {
        const id = slugger.slug(raw)
        return `<h${level} title="${raw}" id="${id}">
        ${text}

        <a href="#${id}">${symbol}</a>
        </h${level}>`
      },
    },
  }
}
