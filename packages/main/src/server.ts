import Koa from 'koa'
import { router } from './routes'
import compress from 'koa-compress'

export function createServer() {
  const app = new Koa()

  app
    .use(compress())
    //
    .use(router.routes())
    .use(router.allowedMethods())
}
