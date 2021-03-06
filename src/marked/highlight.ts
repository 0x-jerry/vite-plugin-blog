import { marked } from 'marked'
import { Lang, getHighlighter, Theme } from 'shiki'
import { toArray } from '../utils'

export interface HighlightExtOption {
  defaultLang: Lang
  highlightLines: boolean
  theme: Theme
}

const langAlias: Record<string, string | string[]> = {
  docker: 'dockerfile',
  yaml: 'yml',
}

export async function highlightExt(
  opt: Partial<HighlightExtOption> = {}
): Promise<marked.MarkedExtension> {
  const highlighter = await getHighlighter({ theme: opt.theme || 'solarized-light' })

  function normalizeLang(langToTrans: string) {
    langToTrans = langToTrans.toLocaleLowerCase()

    for (const lang in langAlias) {
      const alias = toArray(langAlias[lang])

      if (alias.includes(langToTrans)) return lang
    }

    return highlighter.getLoadedLanguages().includes(langToTrans as Lang)
      ? langToTrans
      : opt.defaultLang
  }

  return {
    renderer: {
      // @ts-ignore
      code(this: Renderer, text, langAttr = '') {
        const [lang, lines] = langAttr.trim().split(/\s+/)

        const langToUse = normalizeLang(lang)

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

  return `<div class="code-highlight-lines">${highlightLinesWrapperCode}${code}</div>`
}
