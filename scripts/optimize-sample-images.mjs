import { copyFile, mkdir, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceDirectory = path.join(projectRoot, 'src/assets/sample-set')
const outputDirectory = path.join(projectRoot, 'public/optimized/sample-set')
const maxDimension = 1600
const webpOptions = { quality: 88, effort: 5, smartSubsample: true }

const sourceFilenames = await readdir(sourceDirectory)
const filenames = sourceFilenames
  .filter((filename) => /\.(?:jpe?g|png|webp|avif)$/i.test(filename))
  .sort((left, right) => left.localeCompare(right))
const videoFilenames = sourceFilenames
  .filter((filename) => /\.(?:mp4|webm|mov|m4v)$/i.test(filename))
  .sort((left, right) => left.localeCompare(right))

await mkdir(outputDirectory, { recursive: true })

for (const filename of videoFilenames) {
  await copyFile(path.join(sourceDirectory, filename), path.join(outputDirectory, filename))
}

let sourceBytes = 0
let optimizedBytes = 0

for (const filename of filenames) {
  const sourcePath = path.join(sourceDirectory, filename)
  const outputPath = path.join(outputDirectory, `${path.parse(filename).name}.webp`)
  const sourceStats = await stat(sourcePath)

  await sharp(sourcePath)
    .rotate()
    .resize({
      width: maxDimension,
      height: maxDimension,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp(webpOptions)
    .toFile(outputPath)

  await sharp(sourcePath)
    .rotate()
    .resize({ width: 96, height: 96, fit: 'inside', withoutEnlargement: true })
    .blur(1.4)
    .webp({ quality: 42, effort: 4 })
    .toFile(path.join(outputDirectory, `${path.parse(filename).name}-placeholder.webp`))

  const outputStats = await stat(outputPath)
  sourceBytes += sourceStats.size
  optimizedBytes += outputStats.size
}

const formatMegabytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`
console.log(`Optimized ${filenames.length} starter images: ${formatMegabytes(sourceBytes)} → ${formatMegabytes(optimizedBytes)} (WebP, max ${maxDimension}px).`)
if (videoFilenames.length) console.log(`Copied ${videoFilenames.length} starter video${videoFilenames.length === 1 ? '' : 's'} without re-encoding.`)
