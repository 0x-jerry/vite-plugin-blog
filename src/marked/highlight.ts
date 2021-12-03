import { MarkedExtension } from 'marked'
import { Lang, getHighlighter, Theme } from 'shiki'

export interface HighlightExtOption {
  defaultLang: Lang
  highlightLines: boolean
  theme: Theme
}

export async function highlightExt(
  opt: Partial<HighlightExtOption> = {}
): Promise<MarkedExtension> {
  const highlighter = await getHighlighter({ theme: opt.theme || 'solarized-light' })

  return {
    renderer: {
      // @ts-ignore
      code(this: Renderer, text, langAttr = '') {
        const [lang, lines] = langAttr.trim().split(/\s+/)

        const langToUse = lang || opt.defaultLang

        const result = highlighter.codeToHtml(text, langToUse)

        const langClass = `shiki ${this.options.langPrefix}${langToUse}`
        const resultCode = result

        if (lines && opt.highlightLines) {
          const highlightLinesCode = highlightLines(text, lines, langClass, resultCode)
          return highlightLinesCode
        }

        return resultCode
      },
    },
  }
}

const RE = /{([\d,-]+)}/

function highlightLines(rawCode: string, lines: string, langClass: string, code: string) {
  const lineNumbers = RE.exec(lines)![1]
    .split(',')
    .map((v) => v.split('-').map((v) => parseInt(v, 10)))

  const highlightLinesCode = rawCode
    .split('\n')
    .map((split, index) => {
      const lineNumber = index + 1
      const inRange = lineNumbers.some(([start, end]) => {
        if (start && end) {
          return lineNumber >= start && lineNumber <= end
        }
        return lineNumber === start
      })
      if (inRange) {
        return `<div class="highlighted">&nbsp;</div>`
      }
      return '<br>'
    })
    .join('')

  const highlightLinesWrapperCode = `<div class="${langClass} highlight-lines">${highlightLinesCode}</div>`

  return `<div class="code">${highlightLinesWrapperCode}${code}</div>`
}
