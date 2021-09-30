import { BlogPlugin } from '../types'

/**
 * 修正 md 链接
 */
export const changeHrefPlugin: BlogPlugin = {
  beforeWriteHtml($) {
    $.window.document.querySelectorAll('a').forEach(($a) => {
      const href = $a.href

      if (/^https?:\/\//.test(href)) return

      $a.href = href.replace(/\.md$/, '')
    })
  },
}
