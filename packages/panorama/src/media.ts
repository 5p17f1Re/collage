export interface PreparedMedia {
  type: 'image' | 'video'
  file: File
  placeholder?: File
  poster?: File
  width: number
  height: number
  aspectRatio: number
  name: string
}
export interface UploadedMedia { source: string; placeholder?: string; poster?: string }
export interface UploadContext { blockId: string; signal: AbortSignal }
function abort(signal?: AbortSignal) { signal?.throwIfAborted() }
async function encode(source: CanvasImageSource, width: number, height: number, max: number, quality: number, blur = 0): Promise<Blob> {
  const scale = Math.min(1, max / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Браузер не поддерживает обработку изображений')
  if (blur) context.filter = `blur(${blur}px)`
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  const result = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob?.type === 'image/webp' ? resolve(blob) : reject(new Error('Браузер не поддерживает WebP')), 'image/webp', quality))
  canvas.width = 0; canvas.height = 0
  return result
}
/** Every raster upload, including replacements, passes here before the host adapter. */
export async function prepareMedia(file: File, signal?: AbortSignal): Promise<PreparedMedia> {
  abort(signal)
  const name = file.name.replace(/\.[^.]+$/, '')
  if (['image/jpeg','image/png','image/webp','image/avif'].includes(file.type)) {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    try {
      abort(signal)
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
      const width = Math.max(1, Math.round(bitmap.width * scale)), height = Math.max(1, Math.round(bitmap.height * scale))
      const [full, small] = await Promise.all([encode(bitmap, bitmap.width, bitmap.height, 1600, .88), encode(bitmap, bitmap.width, bitmap.height, 96, .42, 1.4)])
      abort(signal)
      return { type: 'image', name, width, height, aspectRatio: width / height,
        file: new File([full], `${name}.webp`, { type: 'image/webp' }), placeholder: new File([small], `${name}-placeholder.webp`, { type: 'image/webp' }) }
    } finally { bitmap.close() }
  }
  if (!['video/mp4','video/webm','video/quicktime','video/x-m4v'].includes(file.type)) throw new Error('Поддерживаются JPEG, PNG, WebP, AVIF и видео MP4/WebM/MOV; SVG, GIF и HEIC конвертируйте перед загрузкой')
  const source = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.preload = 'auto'; video.muted = true; video.playsInline = true
  try {
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        clearTimeout(timer); video.removeEventListener('loadeddata', loaded); video.removeEventListener('error', failed); signal?.removeEventListener('abort', canceled)
        if (error) reject(error); else resolve()
      }
      const loaded = () => finish()
      const failed = () => finish(new Error('Не удалось прочитать видео; попробуйте MP4 H.264'))
      const canceled = () => finish(new DOMException('Отменено', 'AbortError'))
      const timer = setTimeout(() => finish(new Error('Видео не подготовилось за 10 секунд')), 10000)
      video.addEventListener('loadeddata', loaded, { once: true }); video.addEventListener('error', failed, { once: true }); signal?.addEventListener('abort', canceled, { once: true })
      video.src = source
    })
    abort(signal)
    const width = video.videoWidth, height = video.videoHeight
    if (!width || !height) throw new Error('Нет размеров видео')
    const [poster, small] = await Promise.all([encode(video, width, height, 640, .82), encode(video, width, height, 96, .42, 1.4)])
    abort(signal)
    return { type: 'video', name, file, width, height, aspectRatio: width / height,
      poster: new File([poster], `${name}-poster.webp`, { type: 'image/webp' }), placeholder: new File([small], `${name}-placeholder.webp`, { type: 'image/webp' }) }
  } finally { video.pause(); video.removeAttribute('src'); video.load(); URL.revokeObjectURL(source) }
}
