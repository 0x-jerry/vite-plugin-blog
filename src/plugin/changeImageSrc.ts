import { BlogPlugin } from '../types'
import path from 'path'
import { replaceTag } from './utils'

export interface ChangeImageOption {
  tag?: string
}

/**
 * 修正图片链接
 */
export const changeImageSrcPlugin = (opt: ChangeImageOption = {}): BlogPlugin => {
  return {
    beforeWriteHtml($, { file, outFile }) {
      $.window.document.querySelectorAll('img').forEach(($img) => {
        const src = $img.src

        if (/^https?:\/\//.test(src)) return

        const abs = path.resolve(path.parse(file).dir, src)
        const outDir = path.parse(outFile).dir
        const relativeSrc = path.relative(outDir, abs)
        $img.src = relativeSrc

        if (opt.tag) {
          replaceTag($.window.document, $img, opt.tag)
        }
      })
    },
  }
}
