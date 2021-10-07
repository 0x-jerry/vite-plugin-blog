import fs from 'fs-extra'
import glob from 'fast-glob'
import path from 'path'
import { CurrentFileContext } from '../types'
import { BlogService } from '../BlogService'
import chokidar from 'chokidar'

export type SortInfoFn = (infos: FileInfo[]) => FileInfo[]

export interface ImportAllOption {
  filePattern: string
  dir: string
  watch?: boolean
  sort?: SortInfoFn
}

const sortFn: SortInfoFn = (infos) => infos.sort((a, b) => a.matter?.date - b.matter?.date)

export async function importAll(ctx: BlogService, opt: ImportAllOption) {
  const { filePattern, watch = false, dir, sort = sortFn } = opt
  const files = await glob([filePattern], { cwd: ctx.root })
  const outDirPath = path.join(ctx.root, ctx.outDir, dir)

  const allFilesInfo = new Map<string, FileInfo>()

  for (const file of files) {
    await transformFile(file)
  }

  const generateEntryFile = () =>
    generateEntry(sort([...allFilesInfo.values()]), path.join(outDirPath, 'entry.ts'))

  await generateEntryFile()

  if (watch) {
    const watcher = chokidar.watch([filePattern], { cwd: ctx.root })

    watcher.on('change', async (file) => {
      await transformFile(file)

      await generateEntryFile()
    })

    watcher.on('add', async (file) => {
      await transformFile(file)

      await generateEntryFile()
    })

    watcher.on('unlink', async (file) => {
      const outFilePath = path.join(outDirPath, file.replace(/\.md$/, '.vue'))

      if (await fs.pathExists(outFilePath)) {
        await fs.unlink(outFilePath)
      }

      allFilesInfo.delete(outFilePath)

      await generateEntryFile()
    })
  }

  async function transformFile(file: string) {
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

export interface FileInfo {
  path: string
  matter?: any
}

async function generateEntry(infos: FileInfo[], outPath: string) {
  const outDir = path.parse(outPath).dir

  const src = `
  ${infos.map((i, idx) => `import Comp${idx} from './${path.relative(outDir, i.path)}'`).join('\n')}

  export const components = [
    ${infos.map((_, idx) => `Comp${idx}`).join(',')}
  ]
  `

  await fs.ensureDir(outDir)
  await fs.writeFile(outPath, src)
}
