import fs from 'fs-extra'
import glob from 'fast-glob'
import path from 'path'
import { CurrentFileContext } from '../types'
import { BlogService } from '../BlogService'
import chokidar from 'chokidar'

export interface BuildPostsExcerptOption {
  postPattern: string
  watch?: boolean
  dir?: string
}

export async function buildPostsExcerpt(ctx: BlogService, opt: BuildPostsExcerptOption) {
  const { postPattern, watch = false, dir = 'excerpts' } = opt
  const files = await glob([postPattern], { cwd: ctx.root })
  const outDirPath = path.join(ctx.root, ctx.outDir, dir)

  const allFilesInfo = new Map<string, ExcerptFileInfo>()

  for (const file of files) {
    await transformExcerpt(file)
  }

  await generateExcerptsEntry([...allFilesInfo.values()], outDirPath)

  if (watch) {
    const watcher = chokidar.watch([postPattern], { cwd: ctx.root })

    watcher.on('change', async (file) => {
      await transformExcerpt(file)

      await generateExcerptsEntry([...allFilesInfo.values()], outDirPath)
    })

    watcher.on('add', async (file) => {
      await transformExcerpt(file)

      await generateExcerptsEntry([...allFilesInfo.values()], outDirPath)
    })

    watcher.on('unlink', async (file) => {
      const outFilePath = path.join(outDirPath, file.replace(/\.md$/, '.vue'))

      if (await fs.pathExists(outFilePath)) {
        await fs.unlink(outFilePath)
      }

      allFilesInfo.delete(outFilePath)

      await generateExcerptsEntry([...allFilesInfo.values()], outDirPath)
    })
  }

  async function transformExcerpt(file: string) {
    const fileContext: CurrentFileContext = {
      file: path.join(ctx.root, file),
      outFile: path.join(outDirPath, file.replace(/\.md$/, '.vue')),
    }

    const info = await ctx.cache.read(fileContext.file)

    const sfc = await ctx.transformMarkdown(
      {
        ...info,
        content: info.excerpt,
      },
      fileContext
    )

    allFilesInfo.set(fileContext.outFile, {
      path: fileContext.outFile,
      matter: info.matter,
    })

    await fs.ensureDir(path.parse(fileContext.outFile).dir)
    await fs.writeFile(fileContext.outFile, sfc)
  }
}

export interface ExcerptFileInfo {
  path: string
  matter?: any
}

async function generateExcerptsEntry(infos: ExcerptFileInfo[], outDir: string) {
  // sort excerpts
  infos.sort((a, b) => a.matter?.date - b.matter?.date)

  const src = `
  ${infos
    .map((i, idx) => `import _Exceprt${idx} from './${path.relative(outDir, i.path)}'`)
    .join('\n')}

  export const excerpts = [
    ${infos.map((_, idx) => `_Exceprt${idx}`).join(',')}
  ]
  `

  await fs.ensureDir(outDir)
  await fs.writeFile(path.join(outDir, 'entry.ts'), src)
}
