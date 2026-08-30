import { useLayoutEffect, useMemo, useRef } from 'react'
import type { CSSProperties } from 'react'
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
}

function getItemAspectRatio(item: CollageItem) {
  if (item.type !== 'text') return item.aspectRatio
  if (item.textSize === 'small') return 1.3
  if (item.textSize === 'large') return 1.56
  return 1.42
}

export function CollageStage({ items, settings, seed, isMobile, isPreview }: CollageStageProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
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

  return (
    <main
      ref={stageRef}
      className={`collage-stage ${isPreview ? 'collage-stage--preview' : ''} ${settings.showGrid ? 'collage-stage--grid' : ''}`}
      style={{ backgroundColor: settings.background }}
      aria-label="Интерактивный коллаж"
    >
      <div className="collage-stage__hint" aria-hidden="true">{isMobile ? 'Проведите влево или вправо' : 'Тяните, чтобы исследовать'}</div>
      <div ref={worldRef} className="collage-world" style={{ width: world.width, height: world.height }}>
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

          const focusCard = () => {
            const targetX = world.width / 2 - left
            const targetY = isMobile ? 0 : world.height / 2 - layout.y
            gsap.to(worldRef.current, {
              x: targetX,
              y: targetY,
              duration: 0.62,
              ease: 'power3.out',
              overwrite: true,
              modifiers: {
                x: (value) => {
                  let next = Number(value)
                  while (next > world.width / 2) next -= world.width
                  while (next < -world.width / 2) next += world.width
                  return next
                },
              },
            })
          }

          if (item.type === 'text') {
            return (
              <article key={`${copyOffset}-${item.id}`} className={`collage-card collage-card--text collage-card--${item.textSize ?? 'medium'}`} style={cardStyle as CSSProperties}>
                <p>{item.text || 'Напишите текст'}</p>
              </article>
            )
          }

          return (
            <button key={`${copyOffset}-${item.id}`} className={`collage-card collage-card--${item.type}`} style={cardStyle as CSSProperties} onClick={focusCard} aria-label={`Центрировать: ${item.name}`}>
              {item.type === 'image' && item.source && <img src={item.source} alt={item.name} draggable={false} />}
              {item.type === 'video' && item.source && <video src={item.source} muted playsInline preload="none" aria-label={item.name} />}
            </button>
          )
        }))}
      </div>
    </main>
  )
}
