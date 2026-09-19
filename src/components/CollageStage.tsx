import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import { gsap } from 'gsap'
import { Draggable } from 'gsap/Draggable'
import { generateLayout, generatePanoramaLayout, getCursorFollowRange, getWorldSize } from '../lib/layout'
import type { CollageItem, CollageSettings, LayoutMode } from '../types'

gsap.registerPlugin(Draggable)

interface CollageStageProps {
  items: CollageItem[]
  settings: CollageSettings
  seed: number
  isMobile: boolean
  isPreview: boolean
  layoutMode: LayoutMode
  onOpenGallery: (itemId: string, origin: { x: number; y: number }) => void
  onAspectRatioChange: (itemId: string, aspectRatio: number) => void
}

function getItemAspectRatio(item: CollageItem) {
  if (item.type !== 'text') return item.aspectRatio
  if (item.textSize === 'small') return 1.3
  if (item.textSize === 'large') return 1.56
  return 1.42
}

export function CollageStage({ items, settings, seed, isMobile, isPreview, layoutMode, onOpenGallery, onAspectRatioChange }: CollageStageProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const followBaseRef = useRef({ x: 0, y: 0 })
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })
  const viewport = useMemo(() => stageSize.width > 0 && stageSize.height > 0
    ? stageSize
    : isMobile ? { width: 390, height: 320 } : { width: 1200, height: 800 }, [isMobile, stageSize])
  const isPanorama = layoutMode === 'panorama'
  const isCursorMode = !isPanorama && settings.interactionMode === 'cursor'
  const heroItemId = isPanorama
    ? items[0]?.id
    : settings.heroEnabled && items[0]?.type !== 'text' ? items[0]?.id : undefined
  const followRange = getCursorFollowRange(viewport, isMobile)
  const panorama = useMemo(
    () => isPanorama ? generatePanoramaLayout(items, settings, seed, viewport.width) : undefined,
    [isPanorama, items, settings, seed, viewport.width],
  )
  const layouts = useMemo(
    () => panorama?.layouts ?? generateLayout(items, settings, seed, isMobile, { viewport }),
    [panorama, items, settings, seed, isMobile, viewport],
  )
  const world = panorama?.world ?? getWorldSize(isMobile)

  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return undefined

    const updateStageSize = () => {
      const bounds = stage.getBoundingClientRect()
      const nextSize = { width: Math.round(bounds.width), height: Math.round(bounds.height) }
      setStageSize((currentSize) => currentSize.width === nextSize.width && currentSize.height === nextSize.height ? currentSize : nextSize)
    }

    updateStageSize()
    const observer = new ResizeObserver(updateStageSize)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const stage = stageRef.current
    const worldNode = worldRef.current
    if (!stage || !worldNode) return undefined

    followBaseRef.current = { x: 0, y: 0 }
    gsap.set(worldNode, { xPercent: -50, yPercent: -50, x: 0, y: 0 })
    if (isCursorMode) return undefined

    const stageBounds = stage.getBoundingClientRect()
    const edgePadding = 280
    const verticalRange = Math.max((world.height - stageBounds.height) / 2 + edgePadding, 80)
    const panoramaVerticalRange = Math.max((world.height - stageBounds.height) / 2, 0)
    const canPanVertically = isPanorama && !isMobile
    const normalizePanoramaX = (x: number) => {
      const halfWidth = world.width / 2
      return ((x + halfWidth) % world.width + world.width) % world.width - halfWidth
    }

    const draggable = Draggable.create(worldNode, {
      type: canPanVertically || (!isPanorama && !isMobile) ? 'x,y' : 'x',
      trigger: stage,
      bounds: isPanorama
        ? { minX: -100000, maxX: 100000, minY: -panoramaVerticalRange, maxY: panoramaVerticalRange }
        : isMobile
          ? { minX: -100000, maxX: 100000 }
        : { minX: -100000, maxX: 100000, minY: -verticalRange, maxY: verticalRange },
      allowEventDefault: true,
      cursor: 'grab',
      activeCursor: 'grabbing',
      dragClickables: true,
      ignore: '.settings-toggle',
      edgeResistance: 0.78,
      liveSnap: isPanorama ? { x: normalizePanoramaX } : undefined,
      onPress(this: Draggable) {
        isDraggingRef.current = true
        gsap.killTweensOf(worldNode)
        followBaseRef.current = { x: this.x, y: this.y }
      },
      onRelease(this: Draggable) {
        isDraggingRef.current = false
        followBaseRef.current = { x: this.x, y: this.y }
      },
    })[0]
    gsap.set(worldNode, { xPercent: -50, yPercent: -50, x: 0, y: 0 })
    draggable.update()

    return () => {
      draggable.kill()
    }
  }, [isCursorMode, isMobile, isPanorama, isPreview, world.height, world.width])

  useLayoutEffect(() => {
    const stage = stageRef.current
    const worldNode = worldRef.current
    if (!stage || !worldNode || isMobile || !isCursorMode) return undefined
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
        x: followBaseRef.current.x - horizontalPosition * followRange.x,
        y: followBaseRef.current.y - verticalPosition * followRange.y,
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
  }, [followRange.x, followRange.y, isCursorMode, isMobile])

  return (
    <main
      ref={stageRef}
      className={`collage-stage ${isPreview ? 'collage-stage--preview' : ''} ${isPanorama ? 'collage-stage--panorama' : ''} ${isCursorMode ? 'collage-stage--cursor-follow' : ''} ${settings.showGrid ? 'collage-stage--grid' : ''}`}
      style={{ backgroundColor: settings.background }}
      aria-label={isPanorama ? 'Панорамный интерактивный коллаж' : 'Интерактивный коллаж'}
    >
      <div className="collage-stage__hint" aria-hidden="true">{isCursorMode ? 'Ведите мышью, чтобы исследовать' : isPanorama && !isMobile ? 'Тяните в любую сторону' : isMobile ? 'Проведите влево или вправо' : 'Тяните, чтобы исследовать'}</div>
      <div ref={worldRef} className="collage-world" style={{ width: world.width, height: world.height }}>
        {settings.showGrid && <div className="collage-grid" style={{ '--grid-color': settings.gridColor } as CSSProperties} aria-hidden="true" />}
        {(isCursorMode ? [0] : [-1, 0, 1]).flatMap((copyOffset) => items.map((item) => {
          const layout = layouts[item.id]
          if (!layout) return null
          const aspectRatio = getItemAspectRatio(item)
          const left = layout.x + copyOffset * world.width
          const isHero = item.id === heroItemId
          const cardStyle = {
            left,
            top: layout.y,
            width: layout.width,
            height: layout.height,
            zIndex: layout.zIndex,
            transform: `translate(-50%, -50%) rotate(${layout.rotation}deg) scale(var(--card-scale, 1))`,
            aspectRatio: String(aspectRatio),
            '--hover-scale': String(isPanorama ? 1 : settings.hoverScale / 100),
          }

          const focusCard = (event: MouseEvent<HTMLButtonElement>) => {
            const bounds = event.currentTarget.getBoundingClientRect()
            onOpenGallery(item.id, { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 })
          }

          if (item.type === 'text') {
            return (
              <article key={`${copyOffset}-${item.id}`} className={`collage-card collage-card--text collage-card--${item.textSize ?? 'medium'} ${isHero ? 'collage-card--hero' : ''}`} style={cardStyle as CSSProperties}>
                <p>{item.text || 'Напишите текст'}</p>
              </article>
            )
          }

          return (
            <button
              key={`${copyOffset}-${item.id}`}
              className={`collage-card collage-card--${item.type} ${isHero ? 'collage-card--hero' : ''}`}
              style={cardStyle as CSSProperties}
              onPointerMove={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect()
                event.currentTarget.style.setProperty('--reveal-x', `${(event.clientX - bounds.left) / bounds.width * 100}%`)
                event.currentTarget.style.setProperty('--reveal-y', `${(event.clientY - bounds.top) / bounds.height * 100}%`)
              }}
              onClick={focusCard}
              aria-label={`Открыть галерею: ${item.name}`}
              data-hero={isHero || undefined}
            >
              {item.type === 'image' && item.source && <img src={item.source} alt={item.name} draggable={false} onLoad={(event) => {
                const image = event.currentTarget
                onAspectRatioChange(item.id, image.naturalWidth / image.naturalHeight)
              }} />}
              {item.type === 'video' && item.source && <video src={item.source} muted playsInline preload="none" aria-label={item.name} onLoadedMetadata={(event) => {
                const video = event.currentTarget
                onAspectRatioChange(item.id, video.videoWidth / video.videoHeight)
              }} />}
            </button>
          )
        }))}
      </div>
    </main>
  )
}
