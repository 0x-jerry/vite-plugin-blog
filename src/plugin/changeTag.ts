import { BlogPlugin } from '../types'

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

export function replaceTag(document: Document, node: Element, tagName: string) {
  const newNode = document.createElement(tagName)

  const attrs = node.getAttributeNames()

  for (const attr of attrs) {
    newNode.setAttribute(attr, node.getAttribute(attr)!)
  }

  node.childNodes.forEach((n) => newNode.appendChild(n))

  node.parentElement?.replaceChild(newNode, node)
}
