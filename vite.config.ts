import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sites } from '@openai/sites-vite-plugin'
import { env } from 'node:process'
import { mkdir, readdir, rename, writeFile } from 'node:fs/promises'
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
      const rootDirectory = resolve(outputDirectory)
      const serverDirectory = resolve(outputDirectory, 'server')
      const clientDirectory = resolve(outputDirectory, 'client')
      const worker = `export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request)
    if (response.status !== 404 || new URL(request.url).pathname.includes('.')) return response
    return env.ASSETS.fetch(new URL('/index.html', request.url))
  },
}
`

      await mkdir(clientDirectory, { recursive: true })
      const outputEntries = await readdir(rootDirectory, { withFileTypes: true })
      for (const entry of outputEntries) {
        if (entry.name === 'client' || entry.name === 'server' || entry.name === '.openai') continue
        await rename(resolve(rootDirectory, entry.name), resolve(clientDirectory, entry.name))
      }
      await mkdir(serverDirectory, { recursive: true })
      await writeFile(resolve(serverDirectory, 'index.js'), worker)
    },
  }
}

export default defineConfig({
  base: env.VITE_BASE_PATH || '/',
  plugins: [react(), sites(), staticWorker()],
})
