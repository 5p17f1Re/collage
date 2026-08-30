import { useLayoutEffect, useMemo, useRef } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import { gsap } from 'gsap'
import { generateLayout, getWorldSize } from '../lib/layout'
import type { CollageItem, CollageSettings } from '../types'

interface CollageStageProps {
  items: CollageItem[]
  settings: CollageSettings
  seed: number
  isMobile: boolean
  isPreview: boolean
  onOpenGallery: (itemId: string, origin: { x: number; y: number }) => void
}

function getItemAspectRatio(item: CollageItem) {
  if (item.type !== 'text') return item.aspectRatio
  if (item.textSize === 'small') return 1.3
  if (item.textSize === 'large') return 1.56
  return 1.42
}

export function CollageStage({ items, settings, seed, isMobile, isPreview, onOpenGallery }: CollageStageProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const layouts = useMemo(() => generateLayout(items, settings, seed, isMobile), [items, settings, seed, isMobile])
  const world = getWorldSize(isMobile)

  useLayoutEffect(() => {
    const stage = stageRef.current
    const worldNode = worldRef.current
    if (!stage || !worldNode) return undefined
    const stageElement = stage

    const stageBounds = stage.getBoundingClientRect()
    const edgePadding = 280
    const verticalRange = Math.max((world.height - stageBounds.height) / 2 + edgePadding, 80)
    let activePointerId: number | undefined
    let startPointerX = 0
    let startPointerY = 0
    let startWorldX = 0
    let startWorldY = 0
    let lastPointerX = 0
    let lastTime = 0
    let velocityX = 0
    let hasDragged = false
    let suppressClick = false

    const wrapX = (value: number) => {
      let next = value
      while (next > world.width / 2) next -= world.width
      while (next < -world.width / 2) next += world.width
      return next
    }

    const clampY = (value: number) => Math.max(-verticalRange, Math.min(verticalRange, value))

    function handlePointerDown(event: PointerEvent) {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      if ((event.target as Element).closest('.settings-toggle')) return

      activePointerId = event.pointerId
      startPointerX = event.clientX
      startPointerY = event.clientY
      startWorldX = Number(gsap.getProperty(worldNode, 'x')) || 0
      startWorldY = Number(gsap.getProperty(worldNode, 'y')) || 0
      lastPointerX = event.clientX
      lastTime = performance.now()
      velocityX = 0
      hasDragged = false
      gsap.killTweensOf(worldNode)
      stageElement.setPointerCapture(event.pointerId)
      stageElement.classList.add('is-dragging')
    }

    function handlePointerMove(event: PointerEvent) {
      if (event.pointerId !== activePointerId) return

      const deltaX = event.clientX - startPointerX
      const deltaY = event.clientY - startPointerY
      if (!hasDragged && Math.hypot(deltaX, deltaY) > 4) hasDragged = true
      if (hasDragged) event.preventDefault()

      const now = performance.now()
      const elapsed = Math.max(now - lastTime, 1)
      velocityX = velocityX * 0.72 + ((event.clientX - lastPointerX) / elapsed) * 0.28
      lastPointerX = event.clientX
      lastTime = now

      gsap.set(worldNode, {
        x: startWorldX + deltaX,
        y: isMobile ? startWorldY : clampY(startWorldY + deltaY),
      })
    }

    function handlePointerUp(event: PointerEvent) {
      if (event.pointerId !== activePointerId) return
      if (hasDragged) suppressClick = true
      activePointerId = undefined
      if (stageElement.hasPointerCapture(event.pointerId)) stageElement.releasePointerCapture(event.pointerId)
      stageElement.classList.remove('is-dragging')

      const currentX = Number(gsap.getProperty(worldNode, 'x')) || 0
      const throwDistance = Math.abs(velocityX) < 0.02 ? 0 : velocityX * 560
      gsap.to(worldNode, {
        x: currentX + throwDistance,
        duration: throwDistance === 0 ? 0.08 : 1.15,
        ease: 'power3.out',
        overwrite: true,
        modifiers: { x: (value) => wrapX(Number(value)) },
      })
    }

    function handleClickCapture(event: Event) {
      if (!suppressClick) return
      event.preventDefault()
      event.stopPropagation()
      suppressClick = false
    }

    stageElement.addEventListener('pointerdown', handlePointerDown)
    stageElement.addEventListener('pointermove', handlePointerMove)
    stageElement.addEventListener('pointerup', handlePointerUp)
    stageElement.addEventListener('pointercancel', handlePointerUp)
    stageElement.addEventListener('click', handleClickCapture, true)

    gsap.set(worldNode, { xPercent: -50, yPercent: -50, x: 0, y: 0 })

    return () => {
      stageElement.removeEventListener('pointerdown', handlePointerDown)
      stageElement.removeEventListener('pointermove', handlePointerMove)
      stageElement.removeEventListener('pointerup', handlePointerUp)
      stageElement.removeEventListener('pointercancel', handlePointerUp)
      stageElement.removeEventListener('click', handleClickCapture, true)
      gsap.killTweensOf(worldNode)
    }
  }, [isMobile, isPreview, world.height, world.width])

  return (
    <main
      ref={stageRef}
      className={`collage-stage ${isPreview ? 'collage-stage--preview' : ''} ${settings.showGrid ? 'collage-stage--grid' : ''}`}
      style={{ backgroundColor: settings.background }}
      aria-label="Интерактивный коллаж"
    >
      <div className="collage-stage__hint" aria-hidden="true">{isMobile ? 'Проведите влево или вправо' : 'Тяните, чтобы исследовать'}</div>
      <div ref={worldRef} className="collage-world" style={{ width: world.width, height: world.height }}>
        {settings.showGrid && <div className="collage-grid" aria-hidden="true" />}
        {[-1, 0, 1].flatMap((copyOffset) => items.map((item) => {
          const layout = layouts[item.id]
          const aspectRatio = getItemAspectRatio(item)
          const left = layout.x + copyOffset * world.width
          const cardStyle = {
            left,
            top: layout.y,
            width: layout.width,
            zIndex: layout.zIndex,
            transform: `translate(-50%, -50%) rotate(${layout.rotation}deg) scale(var(--card-scale, 1))`,
            aspectRatio: String(aspectRatio),
            '--hover-scale': String(settings.hoverScale / 100),
          }

          const focusCard = (event: MouseEvent<HTMLButtonElement>) => {
            const bounds = event.currentTarget.getBoundingClientRect()
            onOpenGallery(item.id, { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 })
          }

          if (item.type === 'text') {
            return (
              <article key={`${copyOffset}-${item.id}`} className={`collage-card collage-card--text collage-card--${item.textSize ?? 'medium'}`} style={cardStyle as CSSProperties}>
                <p>{item.text || 'Напишите текст'}</p>
              </article>
            )
          }

          return (
            <button key={`${copyOffset}-${item.id}`} className={`collage-card collage-card--${item.type}`} style={cardStyle as CSSProperties} onClick={focusCard} aria-label={`Открыть галерею: ${item.name}`}>
              {item.type === 'image' && item.source && <img src={item.source} alt={item.name} draggable={false} />}
              {item.type === 'video' && item.source && <video src={item.source} muted playsInline preload="none" aria-label={item.name} />}
            </button>
          )
        }))}
      </div>
    </main>
  )
}
