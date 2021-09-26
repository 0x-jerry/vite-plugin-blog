export interface BlogConfig {
  root: string
}

interface SharedConfig {
  blog: BlogConfig
}

export function readConfig(opt: Partial<SharedConfig> = {}): SharedConfig {
  const blog: BlogConfig = Object.assign(opt.blog, {
    root: process.cwd(),
  })

  const configs = {
    blog,
  }

  return configs
}
