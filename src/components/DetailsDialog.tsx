import { useEffect, useRef } from 'react'
import type { CollageItem } from '../types'
import { CloseIcon } from './icons'
import { VisibilityVideo } from './VisibilityVideo'
import { ImageWithPlaceholder } from './ImageWithPlaceholder'

interface DetailsDialogProps {
  item: CollageItem
  onClose: () => void
}

export function DetailsDialog({ item, onClose }: DetailsDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeButtonRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="details-dialog" role="dialog" aria-modal="true" aria-label={item.name} onMouseDown={(event) => event.stopPropagation()}>
        <button ref={closeButtonRef} className="icon-button details-dialog__close" onClick={onClose} aria-label="Закрыть"><CloseIcon /></button>
        <div className="details-dialog__media">
          {item.type === 'image' && item.source && <ImageWithPlaceholder src={item.source} placeholder={item.placeholder} alt={item.name} />}
          {item.type === 'video' && item.source && <VisibilityVideo src={item.source} poster={item.poster} label={item.name} preload="metadata" controls />}
        </div>
        <footer className="details-dialog__caption">
          <span>{item.name}</span>
          {item.caption && <p>{item.caption}</p>}
        </footer>
      </section>
    </div>
  )
}
