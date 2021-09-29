export function measure<T extends (...args: any[]) => any>(fn: T): T {
  return async function (...args: any[]) {
    const t = new Date().getTime()

    const r = await fn(...args)

    console.log('measure: ', (new Date().getTime() - t).toFixed(0))
    return r
  } as T
}
