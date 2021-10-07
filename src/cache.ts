import fs from 'fs-extra'
import matter from 'gray-matter'

export interface MDFileInfo<T = any> {
  matter: T
  mtime: Date

  content: string
  excerpt: string
}

class CacheFs {
  cache = new Map<string, MDFileInfo>()

  async read(path: string): Promise<MDFileInfo> {
    const hit = this.cache.get(path)

    const stat = await fs.stat(path)

    if (stat.mtime.getTime() === hit?.mtime.getTime()) {
      return hit
    }

    const content = await fs.readFile(path, { encoding: 'utf-8' })

    const frontmatter = matter(content, {
      excerpt_separator: '<!-- more -->',
    })

    const footLinksReg = /^\[[^\]]+\]\:.+$/gm
    const links = frontmatter.content.match(footLinksReg) || []

    const excerpt = [frontmatter.excerpt, links.join('\n')].filter(Boolean).join('\n')

    const info: MDFileInfo = {
      mtime: stat.mtime,

      matter: frontmatter.data,
      content: frontmatter.content,
      excerpt: excerpt,
    }

    this.cache.set(path, info)

    return info
  }
}

export const cacheFs = new CacheFs()
