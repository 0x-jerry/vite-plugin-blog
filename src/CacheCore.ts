import fs from 'fs-extra'
import matter from 'gray-matter'
import { CurrentFileContext, MayPromise } from './types'
import debounce from 'lodash/debounce'
import serialize from 'serialize-javascript'
import md5 from 'md5'

export interface MDFileInfo<T = any> {
  /**
   * file path, absolute path
   */
  path: string
  /**
   * markdown matter data
   */
  matter: T
  /**
   * modified time, used to re-transform
   */
  mtime: Date

  /**
   * markdown content
   */
  content: string
  /**
   * markdown excerpt, text before `<!-- more -->`
   */
  excerpt: string

  /**
   * only 'excerpt'
   */
  type?: 'excerpt'

  /**
   * other data, ex. href
   */
  extra: Record<string, any>
}

export type GetMarkdownExtraData = (
  info: Omit<MDFileInfo, 'extra'>
) => MayPromise<Record<string, any>>

export class CacheCore {
  #cache: Record<string, MDFileInfo> = {}

  get cacheData() {
    return this.#cache
  }

  #transformResult: Record<string, string | undefined> = {}

  constructor(public readonly config: string, public readonly disable: boolean = false) {}

  #save = debounce(async () => {
    await fs.ensureFile(this.config)

    const text = serialize({
      cache: this.#cache,
      transform: this.#transformResult,
    })

    await fs.writeFile(this.config, text)
  }, 100)

  async init() {
    if (!(await fs.pathExists(this.config))) {
      return
    }

    const content = await fs.readFile(this.config, {
      encoding: 'utf-8',
    })

    function deserialize(serializedJavascript: string) {
      return (0, eval)('(' + serializedJavascript + ')')
    }

    const data = deserialize(content)

    this.#cache = data.cache
    this.#transformResult = data.transform
  }

  hasTransformed(fileCtx: CurrentFileContext, info: MDFileInfo) {
    if (this.disable) return

    const hash = md5(fileCtx.file + fileCtx.outFile + JSON.stringify(info))
    const hit = this.#transformResult[hash]

    return hit
  }

  setTransformedCache(fileCtx: CurrentFileContext, info: MDFileInfo, code: string) {
    const hash = md5(fileCtx.file + fileCtx.outFile + JSON.stringify(info))
    this.#transformResult[hash] = code

    this.#save()
  }

  async read(path: string, getExtra?: GetMarkdownExtraData): Promise<MDFileInfo> {
    const hit = this.#cache[path]

    const stat = await fs.stat(path)

    if (stat.mtime.getTime() === hit?.mtime.getTime()) {
      return hit
    }

    const content = await fs.readFile(path, { encoding: 'utf-8' })

    const frontmatter = matter(content, {
      excerpt_separator: '<!-- more -->',
    })

    const footLinksReg = /^\[[^\^][^\]]*\]\:.+$/gm
    const links = frontmatter.content.match(footLinksReg) || []

    const excerpt = [frontmatter.excerpt, links.join('\n')].filter(Boolean).join('\n')

    const basicInfo: Omit<MDFileInfo, 'extra'> = {
      path: path,
      mtime: stat.mtime,

      matter: frontmatter.data,
      content: frontmatter.content,
      excerpt: excerpt,
    }

    const extra = getExtra ? await getExtra(basicInfo) : {}

    const info: MDFileInfo = {
      ...basicInfo,
      extra,
    }

    this.#cache[path] = info

    this.#save()
    return info
  }
}
