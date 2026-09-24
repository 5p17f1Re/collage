import { useEffect, useRef } from 'react'
import type { ReactEventHandler } from 'react'

interface VisibilityVideoProps {
  src: string
  poster?: string
  label?: string
  controls?: boolean
  preload?: 'none' | 'metadata' | 'auto'
  onLoadedMetadata?: ReactEventHandler<HTMLVideoElement>
  onLoadedData?: ReactEventHandler<HTMLVideoElement>
}

/** Play muted, looping video only while it is visible in the current viewport. */
export function VisibilityVideo({ src, poster, label, controls = false, preload = 'none', onLoadedMetadata, onLoadedData }: VisibilityVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let isInViewport = false
    const syncPlayback = () => {
      if (isInViewport && !document.hidden) {
        void video.play().catch(() => undefined)
      } else {
        video.pause()
      }
    }

    const observer = new IntersectionObserver(([entry]) => {
      isInViewport = entry.isIntersecting && entry.intersectionRatio >= 0.15
      syncPlayback()
    }, { threshold: 0.15 })

    observer.observe(video)
    document.addEventListener('visibilitychange', syncPlayback)

    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', syncPlayback)
      video.pause()
    }
  }, [src])

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      aria-label={label}
      muted
      loop
      playsInline
      preload={preload}
      controls={controls}
      onLoadedMetadata={onLoadedMetadata}
      onLoadedData={onLoadedData}
    />
  )
}
