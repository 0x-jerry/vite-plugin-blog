import { BlogPlugin } from '../types'
import { transformRelativePath } from './utils'

/**
 * 修正图片链接
 */
export const changeImageSrcPlugin = (): BlogPlugin => {
  return {
    beforeWriteHtml($, { file, outFile }) {
      $.window.document.querySelectorAll('img').forEach(($img) => {
        $img.src = transformRelativePath($img.src, file, outFile)
      })
    },
  }
}
