import { cp, mkdir, mkdtemp, readdir, readFile, writeFile, rm } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const root = fileURLToPath(new URL('../', import.meta.url))
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
await readFile(join(root, 'dist/panorama.js')) // Build first; fail rather than ship missing output.
const artifacts = join(root, 'artifacts')
await mkdir(artifacts, { recursive: true })
const packed = JSON.parse(execFileSync('npm', ['pack', '--json', '--pack-destination', artifacts], { cwd: root, encoding: 'utf8' }))[0]
const temporary = await mkdtemp(join(tmpdir(), 'avgvst-handoff-'))
const name = `avgvst-panorama-${pkg.version}`
const destination = join(temporary, name)
const excluded = new Set(['node_modules', '.next', '.demo-data', '.DS_Store', 'artifacts', 'next-env.d.ts', 'tsconfig.tsbuildinfo'])
try {
  await mkdir(destination)
  for (const entry of ['dist', 'src', 'scripts', 'tests', 'examples', 'docs', 'licenses', 'README.md', 'LICENSES.md', 'package.json', 'package-lock.json', 'tsconfig.json']) {
    await cp(join(root, entry), join(destination, entry), { recursive: true, filter: path => !relative(root, path).split('/').some(part => excluded.has(part)) })
  }
  await cp(join(artifacts, packed.filename), join(destination, packed.filename))
  const lines = []
  async function inventory(directory) {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a,b)=>a.name.localeCompare(b.name))) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) await inventory(path)
      else lines.push(`${createHash('sha256').update(await readFile(path)).digest('hex')}  ${relative(destination, path)}`)
    }
  }
  await inventory(destination)
  await writeFile(join(destination, 'SHA256SUMS.txt'), lines.join('\n') + '\n')
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const archive = join(artifacts, `${name}-handoff-${timestamp}.zip`)
  execFileSync('zip', ['-qr', archive, name], { cwd: temporary })
  execFileSync('unzip', ['-tq', archive])
  console.log(`Handoff: ${archive}\nNpm: ${join(artifacts, packed.filename)}\nFiles: ${lines.length}; ZIP integrity checked.`)
} finally {
  await rm(temporary, { recursive: true, force: true })
}
