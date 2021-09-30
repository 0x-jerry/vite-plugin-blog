import { JSDOM } from 'jsdom'

export interface BlogServicePlugin {
  beforeWriteHtml($: JSDOM, ctx: CurrentFileContext): void | Promise<void>
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

export interface ViteBlogConfig {
  /**
   * @default `process.cwd()`
   */
  root: string
  /**
   * fast-glob
   */
  excludes: string[]
  /**
   *
   */
  outDir: string
  /**
   *
   */
  plugins: BlogPlugin[]
}
