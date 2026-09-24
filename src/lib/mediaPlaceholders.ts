const IMAGE_PLACEHOLDER_DIMENSION = 96
const VIDEO_POSTER_DIMENSION = 640
const VIDEO_FRAME_TIMEOUT_MS = 5000

function drawCanvasFrame(source: CanvasImageSource, sourceWidth: number, sourceHeight: number, maxDimension: number, blur = 0) {
  if (!sourceWidth || !sourceHeight) return undefined

  const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(sourceWidth * scale))
  canvas.height = Math.max(1, Math.round(sourceHeight * scale))

  const context = canvas.getContext('2d')
  if (!context) return undefined
  if (blur) context.filter = `blur(${blur}px)`
  context.drawImage(source, 0, 0, canvas.width, canvas.height)

  const dataUrl = canvas.toDataURL('image/webp', blur ? 0.42 : 0.82)
  canvas.width = 0
  canvas.height = 0
  return dataUrl
}

function waitForMediaEvent(video: HTMLVideoElement, eventNames: string[], ready: () => boolean) {
  if (ready()) return Promise.resolve(true)

  return new Promise<boolean>((resolve) => {
    const timeout = window.setTimeout(() => finish(false), VIDEO_FRAME_TIMEOUT_MS)
    const finish = (didLoad: boolean) => {
      window.clearTimeout(timeout)
      for (const eventName of eventNames) {
        video.removeEventListener(eventName, onLoaded)
        video.removeEventListener(eventName, onError)
      }
      resolve(didLoad && ready())
    }
    const onLoaded = () => finish(true)
    const onError = () => finish(false)

    for (const eventName of eventNames) {
      video.addEventListener(eventName, onLoaded, { once: true })
    }
    video.addEventListener('error', onError, { once: true })
  })
}

/** Extracts a still poster and a tiny blurred preview without re-encoding the video. */
export async function createVideoPreviews(file: File): Promise<{ poster?: string; placeholder?: string }> {
  const source = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.preload = 'auto'
  video.muted = true
  video.playsInline = true
  video.src = source

  try {
    video.load()
    const hasMetadata = await waitForMediaEvent(video, ['loadedmetadata'], () => video.readyState >= HTMLMediaElement.HAVE_METADATA)
    if (!hasMetadata || !video.videoWidth || !video.videoHeight) return {}

    const hasFrame = await waitForMediaEvent(video, ['loadeddata', 'seeked'], () => video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA)
    if (!hasFrame) return {}

    const poster = drawCanvasFrame(video, video.videoWidth, video.videoHeight, VIDEO_POSTER_DIMENSION)
    const placeholder = drawCanvasFrame(video, video.videoWidth, video.videoHeight, IMAGE_PLACEHOLDER_DIMENSION, 1.4)
    return { poster, placeholder }
  } catch {
    return {}
  } finally {
    video.pause()
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(source)
  }
}
