import { useLayoutEffect, useMemo, useRef } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import { gsap } from 'gsap'
import { Draggable } from 'gsap/Draggable'
import { generateLayout, getWorldSize } from '../lib/layout'
import type { CollageItem, CollageSettings } from '../types'

gsap.registerPlugin(Draggable)

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
  const isDraggingRef = useRef(false)
  const followBaseRef = useRef({ x: 0, y: 0 })
  const layouts = useMemo(() => generateLayout(items, settings, seed, isMobile), [items, settings, seed, isMobile])
  const world = getWorldSize(isMobile)

  useLayoutEffect(() => {
    const stage = stageRef.current
    const worldNode = worldRef.current
    if (!stage || !worldNode) return undefined

    const stageBounds = stage.getBoundingClientRect()
    const edgePadding = 280
    const verticalRange = Math.max((world.height - stageBounds.height) / 2 + edgePadding, 80)

    gsap.set(worldNode, { xPercent: -50, yPercent: -50, x: 0, y: 0 })
    const draggable = Draggable.create(worldNode, {
      type: isMobile ? 'x' : 'x,y',
      trigger: stage,
      bounds: isMobile
        ? { minX: -100000, maxX: 100000 }
        : { minX: -100000, maxX: 100000, minY: -verticalRange, maxY: verticalRange },
      allowEventDefault: true,
      cursor: 'grab',
      activeCursor: 'grabbing',
      dragClickables: true,
      ignore: '.settings-toggle',
      edgeResistance: 0.78,
      onPress(this: Draggable) {
        isDraggingRef.current = true
        gsap.killTweensOf(worldNode)
        followBaseRef.current = { x: this.x, y: this.y }
      },
      onRelease(this: Draggable) {
        isDraggingRef.current = false
        followBaseRef.current = { x: this.x, y: this.y }
      },
      onDrag(this: Draggable) {
        const draggableState = this as unknown as { x: number }
        while (draggableState.x > world.width / 2) draggableState.x -= world.width
        while (draggableState.x < -world.width / 2) draggableState.x += world.width
      },
    })[0]
    gsap.set(worldNode, { xPercent: -50, yPercent: -50, x: 0, y: 0 })
    draggable.update()

    return () => {
      draggable.kill()
    }
  }, [isMobile, isPreview, world.height, world.width])

  useLayoutEffect(() => {
    const stage = stageRef.current
    const worldNode = worldRef.current
    if (!stage || !worldNode || isMobile || !settings.mouseFollow) return undefined
    const stageElement = stage

    function handleMouseEnter() {
      followBaseRef.current = {
        x: Number(gsap.getProperty(worldNode, 'x')) || 0,
        y: Number(gsap.getProperty(worldNode, 'y')) || 0,
      }
    }

    function handleMouseMove(event: globalThis.MouseEvent) {
      if (isDraggingRef.current) return
      const bounds = stageElement.getBoundingClientRect()
      const horizontalPosition = (event.clientX - bounds.left) / bounds.width * 2 - 1
      const verticalPosition = (event.clientY - bounds.top) / bounds.height * 2 - 1
      gsap.to(worldNode, {
        x: followBaseRef.current.x - horizontalPosition * 220,
        y: followBaseRef.current.y - verticalPosition * 150,
        duration: 0.35,
        ease: 'power2.out',
        overwrite: true,
      })
    }

    function handleMouseLeave() {
      if (isDraggingRef.current) return
      gsap.to(worldNode, {
        x: followBaseRef.current.x,
        y: followBaseRef.current.y,
        duration: 0.45,
        ease: 'power2.out',
        overwrite: true,
      })
    }

    stageElement.addEventListener('mouseenter', handleMouseEnter)
    stageElement.addEventListener('mousemove', handleMouseMove)
    stageElement.addEventListener('mouseleave', handleMouseLeave)
    return () => {
      stageElement.removeEventListener('mouseenter', handleMouseEnter)
      stageElement.removeEventListener('mousemove', handleMouseMove)
      stageElement.removeEventListener('mouseleave', handleMouseLeave)
      gsap.killTweensOf(worldNode)
    }
  }, [isMobile, settings.mouseFollow])

  return (
    <main
      ref={stageRef}
      className={`collage-stage ${isPreview ? 'collage-stage--preview' : ''} ${settings.showGrid ? 'collage-stage--grid' : ''}`}
      style={{ backgroundColor: settings.background }}
      aria-label="Интерактивный коллаж"
    >
      <div className="collage-stage__hint" aria-hidden="true">{isMobile ? 'Проведите влево или вправо' : 'Тяните, чтобы исследовать'}</div>
      <div ref={worldRef} className="collage-world" style={{ width: world.width, height: world.height }}>
        {settings.showGrid && <div className="collage-grid" style={{ '--grid-color': settings.gridColor } as CSSProperties} aria-hidden="true" />}
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
