import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import { gsap } from 'gsap'
import { Draggable } from 'gsap/Draggable'
import { generateLayout, generatePanoramaLayout, getCursorFollowRange, getWorldSize, PANORAMA_VERTICAL_DRAG_RANGE } from '../lib/layout'
import { getEstimatedTextCardMetrics, measureTextCardMetrics } from '../lib/textCardMetrics'
import type { CollageItem, CollageSettings, LayoutMode } from '../types'
import { VisibilityVideo } from './VisibilityVideo'
import { ImageWithPlaceholder } from './ImageWithPlaceholder'

gsap.registerPlugin(Draggable)

interface CollageStageProps {
  items: CollageItem[]
  settings: CollageSettings
  seed: number
  isMobile: boolean
  isPreview: boolean
  layoutMode: LayoutMode
  panoramaReferenceWidth: number
  onPanoramaReferenceWidthChange: (width: number) => void
  onOpenGallery: (itemId: string, origin: { x: number; y: number }) => void
  onAspectRatioChange: (itemId: string, aspectRatio: number) => void
}

function getItemAspectRatio(item: CollageItem) {
  return item.aspectRatio
}

export function CollageStage({ items, settings, seed, isMobile, isPreview, layoutMode, panoramaReferenceWidth, onPanoramaReferenceWidthChange, onOpenGallery, onAspectRatioChange }: CollageStageProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const followBaseRef = useRef({ x: 0, y: 0 })
  const inertiaLevelRef = useRef(settings.panorama.inertia)
  inertiaLevelRef.current = settings.panorama.inertia
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })
  const [measuredTextMetrics, setMeasuredTextMetrics] = useState<{ signature: string; values: Record<string, { width: number; height: number }> }>({ signature: '', values: {} })
  const textSignature = items
    .filter((item) => item.type === 'text')
    .map((item) => `${item.id}\u0000${item.textStyle ?? 'gramatika'}\u0000${item.text ?? ''}`)
    .join('\u0001')
  const textItems = useMemo(() => items.filter((item) => item.type === 'text'), [textSignature])
  const textMetrics = useMemo(() => Object.fromEntries(textItems
    .map((item) => [item.id, measuredTextMetrics.signature === textSignature && measuredTextMetrics.values[item.id]
      ? measuredTextMetrics.values[item.id]
      : getEstimatedTextCardMetrics(item)])), [textItems, measuredTextMetrics, textSignature])
  const viewport = useMemo(() => stageSize.width > 0 && stageSize.height > 0
    ? stageSize
    : isMobile ? { width: 390, height: 320 } : { width: 1200, height: 800 }, [isMobile, stageSize])
  const isPanorama = layoutMode === 'panorama'
  const panoramaLayoutWidth = panoramaReferenceWidth > 0 ? panoramaReferenceWidth : viewport.width
  const isCursorMode = !isPanorama && settings.interactionMode === 'cursor'
  const heroItemId = isPanorama
    ? items[0]?.id
    : settings.heroEnabled && items[0]?.type !== 'text' ? items[0]?.id : undefined
  const followRange = getCursorFollowRange(viewport, isMobile)

  useLayoutEffect(() => {
    let isCurrent = true
    void measureTextCardMetrics(textItems).then((metrics) => {
      if (isCurrent) setMeasuredTextMetrics({ signature: textSignature, values: metrics })
    })
    return () => { isCurrent = false }
  }, [textItems, textSignature])

  const panorama = useMemo(
    () => isPanorama ? generatePanoramaLayout(items, settings, seed, panoramaLayoutWidth, textMetrics, isMobile ? viewport.height : undefined) : undefined,
    [isMobile, isPanorama, items, settings, seed, panoramaLayoutWidth, textMetrics, viewport.height],
  )
  const layouts = useMemo(
    () => panorama?.layouts ?? generateLayout(items, settings, seed, isMobile, { viewport, textMetrics }),
    [panorama, items, settings, seed, isMobile, viewport, textMetrics],
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
    if (isPanorama && !isPreview && stageSize.width > 0) {
      onPanoramaReferenceWidthChange(stageSize.width)
    }
  }, [isPanorama, isPreview, onPanoramaReferenceWidthChange, stageSize.width])

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
    const panoramaVerticalRange = PANORAMA_VERTICAL_DRAG_RANGE
    const canPanVertically = isPanorama && !isMobile
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    let prefersReducedMotion = motionPreference.matches
    const syncMotionPreference = (event: MediaQueryListEvent) => { prefersReducedMotion = event.matches }
    motionPreference.addEventListener('change', syncMotionPreference)
    const coastProxy = { x: 0, y: 0 }
    let coastTween: gsap.core.Tween | undefined
    let previousWrappedX = 0
    let unwrappedX = 0
    let dragSamples: Array<{ x: number; y: number; time: number }> = []
    const normalizePanoramaX = (x: number) => {
      const halfWidth = world.width / 2
      return ((x + halfWidth) % world.width + world.width) % world.width - halfWidth
    }
    const recordDragSample = (draggableInstance: Draggable, time = performance.now()) => {
      let deltaX = draggableInstance.x - previousWrappedX
      if (isPanorama) {
        if (deltaX > world.width / 2) deltaX -= world.width
        else if (deltaX < -world.width / 2) deltaX += world.width
      }
      unwrappedX += deltaX
      previousWrappedX = draggableInstance.x
      dragSamples.push({ x: unwrappedX, y: draggableInstance.y, time })
      while (dragSamples.length > 2 && time - dragSamples[0].time > 140) dragSamples.shift()
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
      onPressInit(this: Draggable) {
        coastTween?.kill()
        coastTween = undefined
        gsap.killTweensOf(worldNode)
        this.update()
        previousWrappedX = this.x
        unwrappedX = this.x
        dragSamples = [{ x: unwrappedX, y: this.y, time: performance.now() }]
      },
      onPress(this: Draggable) {
        isDraggingRef.current = true
        followBaseRef.current = { x: this.x, y: this.y }
      },
      onDrag(this: Draggable) {
        recordDragSample(this)
      },
      onRelease(this: Draggable) {
        isDraggingRef.current = false
        followBaseRef.current = { x: this.x, y: this.y }
      },
      onDragEnd(this: Draggable) {
        if (!isPanorama || prefersReducedMotion) return
        const energy = inertiaLevelRef.current
        if (energy <= 0) return

        const releaseTime = performance.now()
        recordDragSample(this, releaseTime)
        const recentSamples = dragSamples.filter((sample) => releaseTime - sample.time <= 110)
        const first = recentSamples[0]
        const last = recentSamples[recentSamples.length - 1]
        if (!first || !last || recentSamples.length < 2 || releaseTime - last.time > 110) return

        const elapsedSeconds = Math.max((last.time - first.time) / 1000, 0.016)
        const velocityX = gsap.utils.clamp(-1600, 1600, (last.x - first.x) / elapsedSeconds)
        const velocityY = canPanVertically
          ? gsap.utils.clamp(-900, 900, (last.y - first.y) / elapsedSeconds)
          : 0
        if (Math.hypot(velocityX, velocityY) < 70) return

        const energyRatio = gsap.utils.clamp(0, 1, energy / 100)
        const duration = 0.15 + energyRatio * 1.2
        const maxHorizontalDistance = Math.min(world.width * 0.65, 760)
        const coastDistanceX = gsap.utils.clamp(
          -maxHorizontalDistance,
          maxHorizontalDistance,
          velocityX * duration / 2,
        )
        const targetY = canPanVertically
          ? gsap.utils.clamp(-panoramaVerticalRange, panoramaVerticalRange, this.y + velocityY * duration / 2)
          : this.y

        coastProxy.x = unwrappedX
        coastProxy.y = this.y
        coastTween = gsap.to(coastProxy, {
          x: unwrappedX + coastDistanceX,
          y: targetY,
          duration,
          ease: 'power2.out',
          onUpdate: () => gsap.set(worldNode, {
            x: normalizePanoramaX(coastProxy.x),
            y: gsap.utils.clamp(-panoramaVerticalRange, panoramaVerticalRange, coastProxy.y),
          }),
          onComplete: () => {
            gsap.set(worldNode, { x: normalizePanoramaX(coastProxy.x), y: targetY })
            draggable.update()
            followBaseRef.current = { x: draggable.x, y: draggable.y }
            coastTween = undefined
          },
        })
      },
    })[0]
    gsap.set(worldNode, { xPercent: -50, yPercent: -50, x: 0, y: 0 })
    draggable.update()

    return () => {
      coastTween?.kill()
      motionPreference.removeEventListener('change', syncMotionPreference)
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
            aspectRatio: item.type === 'text' ? 'auto' : String(aspectRatio),
            '--hover-scale': String(isPanorama ? 1 : settings.hoverScale / 100),
          }

          const focusCard = (event: MouseEvent<HTMLButtonElement>) => {
            const bounds = event.currentTarget.getBoundingClientRect()
            onOpenGallery(item.id, { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 })
          }

          if (item.type === 'text') {
            return (
              <article key={`${copyOffset}-${item.id}`} className={`collage-card collage-card--text ${isHero ? 'collage-card--hero' : ''}`} data-text-style={item.textStyle ?? 'gramatika'} style={cardStyle as CSSProperties}>
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
              {item.type === 'image' && item.source && <ImageWithPlaceholder src={item.source} placeholder={item.placeholder} alt={item.name} onLoad={(event) => {
                const image = event.currentTarget
                onAspectRatioChange(item.id, image.naturalWidth / image.naturalHeight)
              }} />}
              {item.type === 'video' && item.source && <>
                {item.placeholder && <img className="collage-card__placeholder" src={item.placeholder} alt="" aria-hidden="true" draggable={false} />}
                <VisibilityVideo src={item.source} poster={item.poster} label={item.name} preload="none" onLoadedMetadata={(event) => {
                  const video = event.currentTarget
                  onAspectRatioChange(item.id, video.videoWidth / video.videoHeight)
                }} />
              </>}
            </button>
          )
        }))}
      </div>
    </main>
  )
}
