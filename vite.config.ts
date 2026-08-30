import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sites } from '@openai/sites-vite-plugin'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

function staticWorker() {
  let outputDirectory = 'dist'

  return {
    name: 'collage-static-worker',
    apply: 'build' as const,
    configResolved(config: { build: { outDir: string } }) {
      outputDirectory = config.build.outDir
    },
    async writeBundle() {
      const serverDirectory = resolve(outputDirectory, 'server')
      const worker = `export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request)
    if (response.status !== 404 || new URL(request.url).pathname.includes('.')) return response
    return env.ASSETS.fetch(new URL('/index.html', request.url))
  },
}
`

      await mkdir(serverDirectory, { recursive: true })
      await writeFile(resolve(serverDirectory, 'index.js'), worker)
    },
  }
}

export default defineConfig({
  plugins: [react(), sites(), staticWorker()],
})
