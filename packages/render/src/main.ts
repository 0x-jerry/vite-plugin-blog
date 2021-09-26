import { createServer } from 'vite'

export async function createRenderServer() {
  const server = await createServer({})

  await server.listen()
}
