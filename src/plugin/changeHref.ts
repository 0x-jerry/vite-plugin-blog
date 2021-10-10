import path from 'path'
import { BlogPlugin } from '../types'

export interface ChangeHrefOption {
  /**
   * @default '/post'
   */
  postHrePrefix?: string
}

/**
 * 修正 md 链接
 */
export const changeHrefPlugin = (opt: ChangeHrefOption = {}): BlogPlugin => {
  const prefix = opt.postHrePrefix ?? '/post'

  return {
    beforeWriteHtml($, ctx, currentInfo) {
      const allHref: string[] = []

      const postsRoot = path.join(this.root, this.postsDir)

      if (currentInfo.type === 'excerpt') {
        const infos = this.cache.cache.values()
        for (const info of infos) {
          const post = info.path.replace(postsRoot, '').replace(/\.md$/, '')

          const postHref = prefix + post
          allHref.push(postHref)
        }
      }

      $.window.document.querySelectorAll('a').forEach(($a) => {
        const href = $a.href

        if (/^https?:\/\//.test(href)) {
          $a.target = '_blank'
          return
        } else {
          $a.href = href.replace(/\.md$/, '')

          if (currentInfo.type !== 'excerpt') {
            return
          }

          const abs = path.join(path.parse(ctx.file).dir, $a.href)
          const maybePostLink = prefix + abs.replace(postsRoot, '')

          if (allHref.includes(maybePostLink)) {
            $a.href = maybePostLink
          }
        }
      })
    },
  }
}
