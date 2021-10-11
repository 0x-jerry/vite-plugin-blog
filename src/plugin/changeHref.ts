import path from 'path'
import { BlogPlugin } from '../types'
import mime from 'mime-types'
import { isAbsolutePath, replaceTag, transformRelativePath } from './utils'

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

  const allPostHref = new Set<string>()

  return {
    beforeWriteHtml($, ctx, currentInfo) {
      const postsRoot = path.join(this.root, this.postsDir)

      if (currentInfo.type === 'excerpt') {
        const infos = Object.values(this.cache.cacheData)
        for (const info of infos) {
          const post = info.path
            //
            .replace(postsRoot, '')
            .replace(/\.md$/, '')

          const postHref = prefix + post
          if (!allPostHref.has(postHref)) {
            allPostHref.add(postHref)
          }
        }
      }

      $.window.document.querySelectorAll('a').forEach(($a) => {
        const isAbsoluteResource = isAbsolutePath($a.href)

        if (!isAbsoluteResource) {
          $a.href = $a.href.replace(/\.md$/, '')

          // replace relative link in excerpt section
          if (currentInfo.type === 'excerpt') {
            const abs = path.join(path.parse(ctx.file).dir, $a.href)
            const maybePostLink = prefix + abs.replace(postsRoot, '')

            if (allPostHref.has(maybePostLink)) {
              $a.href = maybePostLink
            }
          }
        }

        // fix resource path
        $a.href = transformRelativePath($a.href, ctx.file, ctx.outFile)

        const type = mime.lookup($a.href) || ''

        if (type.startsWith('video')) {
          const $v = replaceTag($.window.document, $a, 'video') as HTMLVideoElement
          $v.src = $a.href
          $v.removeAttribute('href')
          $v.controls = true
        } else if (type.startsWith('audio')) {
          const $v = replaceTag($.window.document, $a, 'audio') as HTMLAudioElement
          $v.src = $a.href
          $v.removeAttribute('href')
          $v.controls = true
        } else {
          if (isAbsoluteResource) {
            $a.target = '_blank'
          }
        }
      })
    },
  }
}
