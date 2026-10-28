import { build } from 'vite'
import postcss from 'postcss'
import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const root = fileURLToPath(new URL('../', import.meta.url))
process.chdir(root)
await rm('dist', { recursive: true, force: true })
await mkdir('dist', { recursive: true })
const base = { configFile: false, define: { 'process.env.NODE_ENV': '"production"' }, root, publicDir: false, logLevel: 'warn', build: { outDir: 'dist', emptyOutDir: false, sourcemap: true, minify: true, target: 'es2022' } }
await build({ ...base, build: { ...base.build, lib: { entry: 'src/index.ts', formats: ['es'], fileName: () => 'react.js' }, rollupOptions: { external: id => /^react(?:-dom)?(?:\/|$)/.test(id), output: { banner: "'use client';" } } } })
await build({ ...base, build: { ...base.build, lib: { entry: 'src/standalone.tsx', name: 'AvgvstPanorama', formats: ['iife'], fileName: () => 'panorama.js' } } })
execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.json'], { stdio: 'inherit' })
const css = postcss.parse(await readFile('src/rendering.css', 'utf8'))
css.walkRules(rule => {
  if (rule.parent?.type === 'atrule' && rule.parent.name.includes('keyframes')) return
  rule.selectors = rule.selectors.map(selector => `.avgvst-panorama ${selector}`)
})
await writeFile('dist/styles.css', css.toString() + '\n' + await readFile('src/shell.css', 'utf8'))
await cp('src/assets', 'dist/assets', { recursive: true })
console.log('Built dist/react.js, panorama.js, styles.css, types and fonts; no sample media.')
