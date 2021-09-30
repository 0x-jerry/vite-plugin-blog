export function measure<T extends (...args: any[]) => any>(fn: T): T {
  return async function (...args: any[]) {
    const ts = new Date().getTime()

    const result = await fn(...args)

    console.log('measure: ', (new Date().getTime() - ts).toFixed(0))

    return result
  } as T
}
