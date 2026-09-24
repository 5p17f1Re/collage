import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { AnimationEvent, CSSProperties, MouseEvent } from 'react'
import type { CollageItem } from '../types'
import { CloseIcon } from './icons'
import { VisibilityVideo } from './VisibilityVideo'
import { ImageWithPlaceholder } from './ImageWithPlaceholder'

interface GalleryDialogProps {
  items: CollageItem[]
  activeItemId: string
  origin?: { x: number; y: number }
  onClose: () => void
}

export function GalleryDialog({ items, activeItemId, origin, onClose }: GalleryDialogProps) {
  const activeRef = useRef<HTMLElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const closeTimerRef = useRef<number | undefined>(undefined)
  const [isClosing, setIsClosing] = useState(false)
  const [areNeighborsVisible, setAreNeighborsVisible] = useState(false)
  const [closingTargetId, setClosingTargetId] = useState(activeItemId)
  const [closingOrigin, setClosingOrigin] = useState(origin)
  const activeItemIndex = items.findIndex((item) => item.id === activeItemId)

  const beginClose = useCallback((targetId: string, targetOrigin?: { x: number; y: number }) => {
    if (isClosing || closeTimerRef.current !== undefined) return
    setClosingTargetId(targetId)
    setClosingOrigin(targetOrigin)
    setIsClosing(true)
    closeTimerRef.current = window.setTimeout(onClose, 320)
  }, [isClosing, onClose])

  const closeGallery = useCallback(() => {
    beginClose(activeItemId, origin)
  }, [activeItemId, beginClose, origin])

  function handleMediaClick(event: MouseEvent<HTMLDivElement>, itemId: string) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const targetOrigin = itemId === activeItemId && origin
      ? origin
      : { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
    beginClose(itemId, targetOrigin)
  }

  function handleActiveItemAnimationEnd(event: AnimationEvent<HTMLElement>) {
    if (!isClosing && event.animationName === 'gallery-item-in') setAreNeighborsVisible(true)
  }

  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    const activeItem = activeRef.current
    if (scroller && activeItem) {
      const previousScrollBehavior = scroller.style.scrollBehavior
      scroller.style.scrollBehavior = 'auto'
      const centeredScrollTop = activeItem.offsetTop - (scroller.clientHeight - activeItem.offsetHeight) / 2
      scroller.scrollTop = Math.max(centeredScrollTop, 0)
      scroller.style.scrollBehavior = previousScrollBehavior
    }
  }, [activeItemId])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeGallery()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeItemId, closeGallery])

  useEffect(() => () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current)
  }, [])

  return (
    <div className={`gallery ${isClosing ? 'is-closing' : ''} ${areNeighborsVisible ? 'has-neighbors' : ''}`} role="dialog" aria-modal="true" aria-label="Галерея материалов">
      <button className="icon-button gallery__close" onClick={closeGallery} aria-label="Закрыть галерею"><CloseIcon /></button>
      <div ref={scrollerRef} className="gallery__scroller">
        {items.map((item, index) => {
          const isActiveItem = item.id === activeItemId
          const neighborSide = !isActiveItem && index < activeItemIndex ? 'before' : !isActiveItem ? 'after' : undefined

          return (
            <article
              key={item.id}
              ref={isActiveItem ? activeRef : undefined}
              className="gallery__item"
              data-active={isActiveItem ? 'true' : undefined}
              data-neighbor={neighborSide}
              onAnimationEnd={isActiveItem ? handleActiveItemAnimationEnd : undefined}
              style={item.id === closingTargetId && closingOrigin ? { '--origin-x': `${closingOrigin.x}px`, '--origin-y': `${closingOrigin.y}px` } as CSSProperties : undefined}
              data-gallery-id={item.id}
              data-closing={item.id === closingTargetId ? 'true' : undefined}
            >
              <div className="gallery__media" onClick={(event) => handleMediaClick(event, item.id)}>
                {item.type === 'image' && item.source && <ImageWithPlaceholder src={item.source} placeholder={item.placeholder} alt={item.name} />}
                {item.type === 'video' && item.source && <VisibilityVideo src={item.source} poster={item.poster} label={item.name} preload="metadata" controls />}
              </div>
              <footer className="gallery__caption">
                <strong>{item.name}</strong>
                {item.caption && <p>{item.caption}</p>}
              </footer>
            </article>
          )
        })}
      </div>
    </div>
  )
}
