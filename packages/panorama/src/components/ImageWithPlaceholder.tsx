import { useState } from 'react'
import type { ReactEventHandler } from 'react'
import { useNearViewport } from '../hooks/useNearViewport'
interface Props { src: string; placeholder?: string; alt: string; showPlaceholder?: boolean; eager?: boolean; onLoad?: ReactEventHandler<HTMLImageElement>; onError?: ReactEventHandler<HTMLImageElement> }
export function ImageWithPlaceholder({ src, placeholder, alt, showPlaceholder = true, eager = false, onLoad, onError }: Props) {
  const { ref, ready } = useNearViewport<HTMLDivElement>(eager)
  const [loadedSource, setLoadedSource] = useState<string>()
  const [failedSource, setFailedSource] = useState<string>()
  return <div ref={ref} className={`image-loading ${loadedSource === src ? 'is-loaded' : ''}`}>
    {ready && showPlaceholder && placeholder && <img className="image-loading__placeholder" src={placeholder} alt="" aria-hidden="true" draggable={false} />}
    {ready && <img className="image-loading__image" src={src} alt={alt} draggable={false} decoding="async"
      onError={event => { setFailedSource(src); onError?.(event) }} onLoad={(event) => { setLoadedSource(src); onLoad?.(event) }} />}
    {failedSource === src && <span className="media-error" role="status">Не удалось загрузить: {alt}</span>}
  </div>
}
