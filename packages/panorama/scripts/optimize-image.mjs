import sharp from 'sharp'
/** Alternative server-side processor; returns bytes, independent of any storage/CMS. */
export async function optimizeImage(input) {
  const metadata = await sharp(input, { limitInputPixels: 100_000_000 }).metadata()
  if (!['jpeg','png','webp','avif','heif'].includes(metadata.format) || (metadata.pages ?? 1) > 1) throw new Error('Unsupported or animated raster image')
  const { data: image, info } = await sharp(input).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 88, effort: 5, smartSubsample: true }).toBuffer({ resolveWithObject: true })
  const placeholder = await sharp(input).rotate().resize({ width: 96, height: 96, fit: 'inside', withoutEnlargement: true })
    .blur(1.4).webp({ quality: 42, effort: 4 }).toBuffer()
  return { image, placeholder, width: info.width, height: info.height, aspectRatio: info.width / info.height, mimeType: 'image/webp' }
}
