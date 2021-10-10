import { JSDOM } from 'jsdom'
import { BlogService, MDFileInfo } from './BlogService'

export interface BlogServicePlugin {
  beforeWriteHtml(
    this: BlogService,
    $: JSDOM,
    ctx: CurrentFileContext,
    info: MDFileInfo
  ): void | Promise<void>
}

export type BlogPlugin = Partial<BlogServicePlugin>

export interface CurrentFileContext {
  /**
   * 当前文件路径
   */
  file: string
  /**
   * 输出文件路径
   */
  outFile: string
}
