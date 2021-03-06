import fs from 'fs-extra'
import glob from 'fast-glob'
import path from 'path'
import { CurrentFileContext } from '../types'
import { BlogService } from '../BlogService'
import { MDFileInfo } from '../CacheCore'
import chokidar from 'chokidar'
import debounce from 'lodash/debounce'
import { v4 as uuid } from 'uuid'

export type SortInfoFn = (infos: FileInfo[]) => FileInfo[]

export interface ImportAllOption {
  filePattern: string
  filename?: string
  dir?: string
  watch?: boolean
  sort?: SortInfoFn
  read?: (fileContext: CurrentFileContext, ctx: BlogService) => Promise<MDFileInfo> | MDFileInfo
  transform?: (
    info: MDFileInfo,
    fileContext: CurrentFileContext,
    ctx: BlogService
  ) => Promise<string> | string
}

const sortFn: SortInfoFn = (infos) =>
  infos.sort((a, b) => b.info.matter?.date - a.info.matter?.date)

export async function importAll(ctx: BlogService, opt: ImportAllOption) {
  const {
    filePattern,
    watch = false,
    dir = '',
    sort = sortFn,
    //
    filename = 'entry.ts',
  } = opt

  const allFilesInfo = new Map<string, FileInfo>()
  const files = await glob([filePattern], { cwd: ctx.root })
  const outDirPath = path.join(ctx.outDir, dir)

  const transformFile = async (file: string) => {
    const fileContext: CurrentFileContext = {
      file: path.join(ctx.root, file),
      outFile: path.join(outDirPath, file.replace(/\.md$/, '.vue')),
    }

    const info = await (opt.read
      ? opt.read(fileContext, ctx)
      : ctx.cache.read(fileContext.file, ctx.transform?.afterRead))

    allFilesInfo.set(fileContext.outFile, {
      path: fileContext.outFile,
      info,
    })

    if (opt.transform) {
      if (ctx.cache.hasTransformed(fileContext, info)) {
        return
      }

      const code = await opt.transform(info, fileContext, ctx)
      ctx.cache.setTransformedCache(fileContext, info, code)

      await fs.ensureDir(path.parse(fileContext.outFile).dir)
      await fs.writeFile(fileContext.outFile, code)
    } else {
      await ctx.transformFile(fileContext)
    }
  }

  await Promise.all(files.map((file) => transformFile(file)))

  const generateEntryFile = debounce(async () => {
    const infos = sort([...allFilesInfo.values()])
    const outPath = path.join(outDirPath, filename)
    const outDir = path.parse(outPath).dir

    const src = `
      ${infos
        .map((i, idx) => `import Comp${idx} from './${path.relative(outDir, i.path)}'`)
        .join('\n')}

      export const modules = [
        ${infos
          .map((v, idx) => {
            const data = JSON.stringify(v.info.matter || {}, null, 2)
            const extra = JSON.stringify(v.info.extra || {}, null, 2)

            return `{
              uuid: ${JSON.stringify(uuid())},
              data: ${data},
              extra: ${extra},
              module: Comp${idx},
            }`
          })
          .join(',\n')}
      ]
      `

    await fs.ensureDir(outDir)
    await fs.writeFile(outPath, src)
  }, 100)

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
}

interface FileInfo {
  path: string
  info: MDFileInfo
}
