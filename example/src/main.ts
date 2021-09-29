// register vue composition api globally
import { ViteSSG } from 'vite-ssg'
import generatedRoutes from 'virtual:generated-pages'
import { setupLayouts } from 'virtual:generated-layouts'
import App from './App.vue'

const routes = setupLayouts(generatedRoutes)

// https://github.com/antfu/vite-ssg
export const createApp = ViteSSG(App, { routes })
