import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import { gsap } from 'gsap'
import type { CollageItem } from '../types'
import { CloseIcon } from './icons'
import { VisibilityVideo } from './VisibilityVideo'
import { ImageWithPlaceholder } from './ImageWithPlaceholder'

interface GalleryDialogProps {
  items: CollageItem[]
  activeItemId: string
  origin?: HTMLButtonElement
  onClose: () => void
}

interface ElementTransform {
  rotation: number
  scaleX: number
  scaleY: number
}

const springRate = Math.PI * 2
const springEndValue = 1 - (1 + springRate) * Math.exp(-springRate)

function gallerySpringNoBounce(progress: number) {
  const time = gsap.utils.clamp(0, 1, progress)
  // Critically damped spring residual: (1 + ωt)e^-ωt, normalized to finish at 1.
  return (1 - (1 + springRate * time) * Math.exp(-springRate * time)) / springEndValue
}

function getElementTransform(element: HTMLElement): ElementTransform {
  const transform = getComputedStyle(element).transform
  const matrix = transform === 'none' ? new DOMMatrixReadOnly() : new DOMMatrixReadOnly(transform)

  return {
    rotation: Math.atan2(matrix.b, matrix.a) * 180 / Math.PI,
    scaleX: Math.hypot(matrix.a, matrix.b) || 1,
    scaleY: Math.hypot(matrix.c, matrix.d) || 1,
  }
}

function getMediaSize(aspectRatio: number, viewport: { width: number; height: number }) {
  const safeAspectRatio = aspectRatio > 0 ? aspectRatio : 1
  const sidePadding = Math.max(18, Math.min(112, viewport.width * 0.07))
  const maxWidth = Math.min(viewport.width * 0.8, viewport.width - sidePadding * 2)
  const maxHeight = viewport.height * 0.8
  const height = Math.min(maxHeight, maxWidth / safeAspectRatio)

  return { width: height * safeAspectRatio, height }
}

export function GalleryDialog({ items, activeItemId, origin, onClose }: GalleryDialogProps) {
  const galleryRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLElement>(null)
  const activeMediaRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const motionContextRef = useRef<gsap.Context | undefined>(undefined)
  const entranceTweenRef = useRef<gsap.core.Tween | undefined>(undefined)
  const closingTweenRef = useRef<gsap.core.Tween | undefined>(undefined)
  const expandedBoundsRef = useRef<DOMRectReadOnly | undefined>(undefined)
  const hiddenElementsRef = useRef(new Map<HTMLElement, boolean>())
  const hasEnteredRef = useRef(false)
  const isClosingRef = useRef(false)
  const [isClosing, setIsClosing] = useState(false)
  const [areNeighborsVisible, setAreNeighborsVisible] = useState(false)
  const [shouldReturnOriginal, setShouldReturnOriginal] = useState(false)
  const [isFloatingReturn, setIsFloatingReturn] = useState(false)
  const [isActiveMediaReady, setIsActiveMediaReady] = useState(false)
  const [activeAspectRatio, setActiveAspectRatio] = useState<number>()
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }))
  const activeItemIndex = items.findIndex((item) => item.id === activeItemId)
  const activeItem = items[activeItemIndex]
  const activeMediaSize = getMediaSize(activeAspectRatio ?? activeItem?.aspectRatio ?? 1, viewport)

  const hideElement = useCallback((element: HTMLElement) => {
    if (!hiddenElementsRef.current.has(element)) hiddenElementsRef.current.set(element, element.classList.contains('collage-card--gallery-source-hidden'))
    element.classList.add('collage-card--gallery-source-hidden')
  }, [])

  const restoreHiddenElements = useCallback(() => {
    hiddenElementsRef.current.forEach((wasAlreadyHidden, element) => {
      if (element.isConnected && !wasAlreadyHidden) element.classList.remove('collage-card--gallery-source-hidden')
    })
    hiddenElementsRef.current.clear()
  }, [])

  const beginClose = useCallback(() => {
    if (isClosingRef.current) return
    isClosingRef.current = true
    entranceTweenRef.current?.kill()

    const root = galleryRef.current
    const scroller = scrollerRef.current
    const media = activeMediaRef.current
    const target = origin?.isConnected ? origin : undefined
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const mediaBounds = media?.getBoundingClientRect()
    const savedBounds = expandedBoundsRef.current
    const scrollerBounds = scroller?.getBoundingClientRect()
    const mediaArea = mediaBounds ? mediaBounds.width * mediaBounds.height : 0
    const visibleWidth = mediaBounds && scrollerBounds
      ? Math.max(0, Math.min(mediaBounds.right, scrollerBounds.right) - Math.max(mediaBounds.left, scrollerBounds.left))
      : 0
    const visibleHeight = mediaBounds && scrollerBounds
      ? Math.max(0, Math.min(mediaBounds.bottom, scrollerBounds.bottom) - Math.max(mediaBounds.top, scrollerBounds.top))
      : 0
    const visibleRatio = mediaArea > 0 ? visibleWidth * visibleHeight / mediaArea : 0
    const shouldUseSavedBounds = visibleRatio < 0.35
    const returnBounds = shouldUseSavedBounds ? savedBounds : mediaBounds
    const targetBounds = target?.getBoundingClientRect()
    const stageBounds = target?.closest('.collage-stage')?.getBoundingClientRect()
    const targetClip = stageBounds
      ? {
        left: Math.max(0, stageBounds.left),
        right: Math.min(window.innerWidth, stageBounds.right),
        top: Math.max(0, stageBounds.top),
        bottom: Math.min(window.innerHeight, stageBounds.bottom),
      }
      : { left: 0, right: window.innerWidth, top: 0, bottom: window.innerHeight }
    const targetVisibleWidth = targetBounds
      ? Math.max(0, Math.min(targetBounds.right, targetClip.right) - Math.max(targetBounds.left, targetClip.left))
      : 0
    const targetVisibleHeight = targetBounds
      ? Math.max(0, Math.min(targetBounds.bottom, targetClip.bottom) - Math.max(targetBounds.top, targetClip.top))
      : 0
    const canAnimateBack = Boolean(
      root && media && target && targetBounds && returnBounds && isActiveMediaReady && !prefersReducedMotion
      && targetBounds.width > 0 && targetBounds.height > 0 && targetVisibleWidth > 0 && targetVisibleHeight > 0,
    )

    setShouldReturnOriginal(canAnimateBack)
    setIsFloatingReturn(canAnimateBack && shouldUseSavedBounds)
    setIsClosing(true)

    const context = motionContextRef.current
    if (!root || !context || !media || !canAnimateBack || !target || !targetBounds || !returnBounds) {
      context?.add(() => {
        closingTweenRef.current = gsap.to(root ?? media ?? {}, {
          opacity: 0,
          duration: prefersReducedMotion ? 0 : 0.168,
          ease: gallerySpringNoBounce,
          onComplete: onClose,
        })
      })
      return
    }

    hideElement(target)
    const sourceTransform = getElementTransform(target)
    const targetScaleX = target.offsetWidth * sourceTransform.scaleX / returnBounds.width
    const targetScaleY = target.offsetHeight * sourceTransform.scaleY / returnBounds.height

    context.add(() => {
      if (shouldUseSavedBounds && scroller) {
        scroller.style.overflow = 'visible'
        gsap.set(media, {
          position: 'fixed',
          top: returnBounds.top,
          left: returnBounds.left,
          right: 'auto',
          bottom: 'auto',
          width: returnBounds.width,
          height: returnBounds.height,
          zIndex: 1,
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          transformOrigin: '50% 50%',
        })
      }

      const startBounds = shouldUseSavedBounds ? returnBounds : media.getBoundingClientRect()
      closingTweenRef.current = gsap.to(media, {
        x: targetBounds.left + targetBounds.width / 2 - (startBounds.left + startBounds.width / 2),
        y: targetBounds.top + targetBounds.height / 2 - (startBounds.top + startBounds.height / 2),
        scaleX: targetScaleX,
        scaleY: targetScaleY,
        rotation: sourceTransform.rotation,
        transformOrigin: '50% 50%',
        duration: 0.252,
        ease: gallerySpringNoBounce,
        onComplete: onClose,
      })
    })
  }, [hideElement, isActiveMediaReady, onClose, origin])

  const closeGallery = useCallback(() => {
    beginClose()
  }, [beginClose])

  function handleGalleryClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target instanceof Element && event.target.closest('.gallery__close')) return
    closeGallery()
  }

  function handleMediaReady(itemId: string, aspectRatio?: number) {
    if (itemId !== activeItemId) return
    if (aspectRatio && Number.isFinite(aspectRatio)) setActiveAspectRatio(aspectRatio)
    setIsActiveMediaReady(true)
  }

  useLayoutEffect(() => {
    const root = galleryRef.current
    if (!root) return undefined

    const context = gsap.context(() => {}, root)
    motionContextRef.current = context

    return () => {
      entranceTweenRef.current?.kill()
      closingTweenRef.current?.kill()
      restoreHiddenElements()
      context.revert()
      motionContextRef.current = undefined
    }
  }, [restoreHiddenElements])

  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    const activeItemElement = activeRef.current
    if (scroller && activeItemElement) {
      const previousScrollBehavior = scroller.style.scrollBehavior
      scroller.style.scrollBehavior = 'auto'
      const centeredScrollTop = activeItemElement.offsetTop - (scroller.clientHeight - activeItemElement.offsetHeight) / 2
      scroller.scrollTop = Math.max(centeredScrollTop, 0)
      scroller.style.scrollBehavior = previousScrollBehavior
    }
  }, [activeItemId])

  useLayoutEffect(() => {
    const context = motionContextRef.current
    const media = activeMediaRef.current
    if (!context || !media || !isActiveMediaReady || hasEnteredRef.current) return
    hasEnteredRef.current = true

    const source = origin?.isConnected ? origin : undefined
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!source) {
      expandedBoundsRef.current = media.getBoundingClientRect()
      setAreNeighborsVisible(true)
      return
    }

    hideElement(source)
    if (prefersReducedMotion) {
      expandedBoundsRef.current = media.getBoundingClientRect()
      setAreNeighborsVisible(true)
      return
    }

    const sourceBounds = source.getBoundingClientRect()
    const targetBounds = media.getBoundingClientRect()
    const sourceTransform = getElementTransform(source)
    const sourceScaleX = source.offsetWidth * sourceTransform.scaleX / targetBounds.width
    const sourceScaleY = source.offsetHeight * sourceTransform.scaleY / targetBounds.height

    context.add(() => {
      entranceTweenRef.current = gsap.fromTo(media, {
        x: sourceBounds.left + sourceBounds.width / 2 - (targetBounds.left + targetBounds.width / 2),
        y: sourceBounds.top + sourceBounds.height / 2 - (targetBounds.top + targetBounds.height / 2),
        scaleX: sourceScaleX,
        scaleY: sourceScaleY,
        rotation: sourceTransform.rotation,
        transformOrigin: '50% 50%',
      }, {
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        duration: 0.425,
        ease: gallerySpringNoBounce,
        onComplete: () => {
          entranceTweenRef.current = undefined
          expandedBoundsRef.current = media.getBoundingClientRect()
          setAreNeighborsVisible(true)
        },
      })
    })
  }, [hideElement, isActiveMediaReady, origin])

  useEffect(() => {
    const updateViewport = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeGallery()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeItemId, closeGallery])

  useEffect(() => {
    const media = activeMediaRef.current
    const image = media?.querySelector<HTMLImageElement>('img.image-loading__image')
    const video = media?.querySelector<HTMLVideoElement>('video')
    if (image?.complete && image.naturalWidth > 0) {
      handleMediaReady(activeItemId, image.naturalWidth / image.naturalHeight)
    } else if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      handleMediaReady(activeItemId, video.videoWidth / video.videoHeight)
    }
  }, [activeItemId])

  return (
    <div ref={galleryRef} className={`gallery ${isClosing ? 'is-closing' : ''} ${areNeighborsVisible ? 'has-neighbors' : ''}`} data-floating-return={isClosing && isFloatingReturn ? 'true' : undefined} onClick={handleGalleryClick} role="dialog" aria-modal="true" aria-label="Галерея материалов">
      <button className="icon-button gallery__close" onClick={closeGallery} aria-label="Закрыть галерею"><CloseIcon /></button>
      <div ref={scrollerRef} className="gallery__scroller">
        {items.map((item, index) => {
          const isActiveItem = item.id === activeItemId
          const neighborSide = !isActiveItem && index < activeItemIndex ? 'before' : !isActiveItem ? 'after' : undefined
          const mediaSize = isActiveItem ? activeMediaSize : getMediaSize(item.aspectRatio, viewport)
          const mediaStyle = { width: mediaSize.width, height: mediaSize.height } as CSSProperties

          return (
            <article
              key={item.id}
              ref={isActiveItem ? activeRef : undefined}
              className="gallery__item"
              data-active={isActiveItem ? 'true' : undefined}
              data-neighbor={neighborSide}
              data-gallery-id={item.id}
              data-closing={item.id === activeItemId && isClosing && shouldReturnOriginal ? 'true' : undefined}
            >
              <div
                ref={isActiveItem ? activeMediaRef : undefined}
                className="gallery__media"
                style={mediaStyle}
                data-gallery-id={item.id}
              >
                {item.type === 'image' && item.source && <ImageWithPlaceholder
                  src={item.source}
                  alt={item.name}
                  showPlaceholder={false}
                  onLoad={(event) => handleMediaReady(item.id, event.currentTarget.naturalWidth / event.currentTarget.naturalHeight)}
                />}
                {item.type === 'video' && item.source && <VisibilityVideo
                  src={item.source}
                  poster={item.poster}
                  label={item.name}
                  preload="metadata"
                  onLoadedMetadata={(event) => {
                    const video = event.currentTarget
                    if (item.id === activeItemId && video.videoWidth > 0 && video.videoHeight > 0) setActiveAspectRatio(video.videoWidth / video.videoHeight)
                  }}
                  onLoadedData={(event) => handleMediaReady(item.id, event.currentTarget.videoWidth / event.currentTarget.videoHeight)}
                />}
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
