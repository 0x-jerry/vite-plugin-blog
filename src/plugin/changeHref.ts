import { BlogPlugin } from '../types'
import { replaceTag } from './utils'

export interface ChangeHrefOption {
  tag?: string
}

/**
 * 修正 md 链接
 */
export const changeHrefPlugin = (opt: ChangeHrefOption = {}): BlogPlugin => {
  return {
    beforeWriteHtml($) {
      $.window.document.querySelectorAll('a').forEach(($a) => {
        const href = $a.href

        if (!/^https?:\/\//.test(href)) {
          $a.href = href.replace(/\.md$/, '')
        }

        if (opt.tag) {
          replaceTag($.window.document, $a, opt.tag)
        }
      })
    },
  }
}
