import { JSDOM } from 'jsdom'
import { MDFileInfo } from './BlogService'

export interface BlogServicePlugin {
  beforeWriteHtml($: JSDOM, ctx: CurrentFileContext, info: MDFileInfo): void | Promise<void>
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
