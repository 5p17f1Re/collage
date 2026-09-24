import { useState } from 'react'
import type { ReactEventHandler } from 'react'

interface ImageWithPlaceholderProps {
  src: string
  placeholder?: string
  alt: string
  onLoad?: ReactEventHandler<HTMLImageElement>
}

export function ImageWithPlaceholder({ src, placeholder, alt, onLoad }: ImageWithPlaceholderProps) {
  const [loadedSource, setLoadedSource] = useState<string>()
  const isLoaded = loadedSource === src

  return (
    <div className={`image-loading ${isLoaded ? 'is-loaded' : ''}`}>
      {placeholder && <img className="image-loading__placeholder" src={placeholder} alt="" aria-hidden="true" draggable={false} />}
      <img
        className="image-loading__image"
        src={src}
        alt={alt}
        draggable={false}
        onLoad={(event) => {
          setLoadedSource(src)
          onLoad?.(event)
        }}
      />
    </div>
  )
}
