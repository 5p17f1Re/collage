import { useEffect, useRef } from 'react'
import type { CollageItem } from '../types'
import { CloseIcon } from './icons'

interface GalleryDialogProps {
  items: CollageItem[]
  activeItemId: string
  onClose: () => void
}

export function GalleryDialog({ items, activeItemId, onClose }: GalleryDialogProps) {
  const activeRef = useRef<HTMLElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'center' })
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeItemId, onClose])

  return (
    <div className="gallery" role="dialog" aria-modal="true" aria-label="Галерея материалов">
      <button className="icon-button gallery__close" onClick={onClose} aria-label="Закрыть галерею"><CloseIcon /></button>
      <div className="gallery__scroller">
        {items.map((item) => (
          <article
            key={item.id}
            ref={item.id === activeItemId ? activeRef : undefined}
            className="gallery__item"
            data-gallery-id={item.id}
          >
            <div className="gallery__media">
              {item.type === 'image' && item.source && <img src={item.source} alt={item.name} />}
              {item.type === 'video' && item.source && <video src={item.source} muted playsInline controls />}
            </div>
            <footer className="gallery__caption">
              <strong>{item.name}</strong>
              {item.caption && <p>{item.caption}</p>}
            </footer>
          </article>
        ))}
      </div>
    </div>
  )
}
