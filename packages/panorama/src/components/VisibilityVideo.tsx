import { useEffect, useRef, useContext, createContext } from 'react'
import type { ReactEventHandler } from 'react'
import { useNearViewport } from '../hooks/useNearViewport'
export const MediaSuspendedContext = createContext(false)
interface Props { src: string; poster?: string; label?: string; controls?: boolean; preload?: 'none' | 'metadata' | 'auto'; eager?: boolean;
 onLoadedMetadata?: ReactEventHandler<HTMLVideoElement>; onLoadedData?: ReactEventHandler<HTMLVideoElement>; onError?: ReactEventHandler<HTMLVideoElement> }
export function VisibilityVideo({ src, poster, label, controls = false, preload = 'none', eager = false, onLoadedMetadata, onLoadedData, onError }: Props) {
  const { ref, ready } = useNearViewport<HTMLVideoElement>(eager)
  const suspended = useContext(MediaSuspendedContext)
  const visible = useRef(false)
  useEffect(() => {
    const video = ref.current
    if (!video || !ready) return
    const sync = () => { if (visible.current && !document.hidden && !suspended) void video.play().catch(() => {}); else video.pause() }
    const observer = new IntersectionObserver(([entry]) => { visible.current = entry.isIntersecting && entry.intersectionRatio >= 0.15; sync() }, { threshold: 0.15 })
    observer.observe(video)
    document.addEventListener('visibilitychange', sync)
    sync()
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', sync); video.pause() }
  }, [src, ready, suspended, ref])
  return <video ref={ref} src={ready ? src : undefined} poster={ready ? poster : undefined} aria-label={label} muted loop playsInline
    preload={preload} controls={controls} onLoadedMetadata={onLoadedMetadata} onLoadedData={onLoadedData} onError={onError} />
}
