import { BlogPlugin } from '../types'
import { replaceTag } from './utils'

export interface ChangeTagOption {
  /**
   * tag map
   */
  map?: Record<string, string>
}

/**
 * 修正 md 链接
 */
export const changeTagPlugin = (opt: ChangeTagOption = {}): BlogPlugin => {
  return {
    beforeWriteHtml($) {
      const map: Record<string, string> = opt.map || {}

      for (const key in map) {
        if (Object.prototype.hasOwnProperty.call(map, key)) {
          const newTag = map[key]

          $.window.document.querySelectorAll(key).forEach(($el) => {
            replaceTag($.window.document, $el, newTag)
          })
        }
      }
    },
  }
}
