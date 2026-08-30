import { useEffect, useLayoutEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import type { CollageItem } from '../types'
import { CloseIcon } from './icons'

interface GalleryDialogProps {
  items: CollageItem[]
  activeItemId: string
  origin?: { x: number; y: number }
  onClose: () => void
}

export function GalleryDialog({ items, activeItemId, origin, onClose }: GalleryDialogProps) {
  const activeRef = useRef<HTMLElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    const activeItem = activeRef.current
    if (scroller && activeItem) {
      const previousScrollBehavior = scroller.style.scrollBehavior
      scroller.style.scrollBehavior = 'auto'
      scroller.scrollTop = activeItem.offsetTop
      scroller.style.scrollBehavior = previousScrollBehavior
    }
  }, [activeItemId])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeItemId, onClose])

  return (
    <div className="gallery" role="dialog" aria-modal="true" aria-label="Галерея материалов">
      <button className="icon-button gallery__close" onClick={onClose} aria-label="Закрыть галерею"><CloseIcon /></button>
      <div ref={scrollerRef} className="gallery__scroller">
        {items.map((item) => (
          <article
            key={item.id}
            ref={item.id === activeItemId ? activeRef : undefined}
            className="gallery__item"
            data-active={item.id === activeItemId ? 'true' : undefined}
            style={item.id === activeItemId && origin ? { '--origin-x': `${origin.x}px`, '--origin-y': `${origin.y}px` } as CSSProperties : undefined}
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
