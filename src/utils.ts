import fs from 'fs-extra'
import path from 'path'

export function measure<T extends (...args: any[]) => any>(fn: T): T {
  return async function (...args: any[]) {
    const ts = new Date().getTime()

    const result = await fn(...args)

    console.log('measure: ', (new Date().getTime() - ts).toFixed(0))

    return result
  } as T
}

export async function save(file: string, data: string) {
  await fs.ensureDir(path.parse(file).dir)
  await fs.writeFile(file, data)
}
