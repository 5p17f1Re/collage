import type { CollageItem, CollageSettings, ItemLayout } from '../types'

const DESKTOP_WORLD = { width: 2600, height: 1540 }
const MOBILE_WORLD = { width: 2060, height: 620 }
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
const MIN_CARD_WIDTH = 112
const MAX_CARD_WIDTH = 520
const MIN_SCALE = 0.65
const MAX_SCALE = 1.28
const FALLBACK_VIEWPORT = { width: 1200, height: 800 }

function createSeededRandom(seed: number) {
  let state = seed >>> 0

  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function interpolate(start: number, end: number, amount: number) {
  return start + (end - start) * amount
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function getWorldSize(isMobile: boolean) {
  return isMobile ? MOBILE_WORLD : DESKTOP_WORLD
}

export function getCursorFollowRange(viewport: { width: number; height: number }, isMobile: boolean) {
  if (isMobile) return { x: 0, y: 0 }
  return {
    x: Math.min(48, Math.max(18, viewport.width * 0.038)),
    y: Math.min(36, Math.max(14, viewport.height * 0.038)),
  }
}

function getItemAspectRatio(item: CollageItem) {
  if (item.type !== 'text') return item.aspectRatio
  if (item.textSize === 'small') return 1.3
  if (item.textSize === 'large') return 1.56
  return 1.42
}

function generateCursorLayout(
  items: CollageItem[],
  settings: CollageSettings,
  seed: number,
  isMobile: boolean,
  viewport: { width: number; height: number },
): Record<string, ItemLayout> {
  const random = createSeededRandom(seed)
  const world = getWorldSize(isMobile)
  const safeViewport = viewport.width > 0 && viewport.height > 0 ? viewport : FALLBACK_VIEWPORT
  const followRange = getCursorFollowRange(safeViewport, isMobile)
  const edgePadding = clamp(Math.min(safeViewport.width, safeViewport.height) * 0.032, 14, 32)
  const usableWidth = Math.max(240, safeViewport.width - (edgePadding + followRange.x) * 2)
  const usableHeight = Math.max(180, safeViewport.height - (edgePadding + followRange.y) * 2)
  const aspect = usableWidth / usableHeight
  const total = Math.max(items.length, 1)
  const columnCount = isMobile
    ? Math.min(4, total)
    : clamp(Math.ceil(Math.sqrt(total * aspect)), 3, 9)
  const rowCount = Math.ceil(total / columnCount)
  const cellWidth = usableWidth / columnCount
  const cellHeight = usableHeight / rowCount
  const horizontalOverlap = clamp((settings.horizontalOverlap + 50) / 200, 0, 1)
  const verticalOverlap = clamp((settings.verticalOverlap + 50) / 200, 0, 1)
  const densityScale = interpolate(0.86, 1.22, settings.density / 150)
  const horizontalFill = interpolate(0.7, 1.45, horizontalOverlap)
  const verticalFill = interpolate(0.7, 1.45, verticalOverlap)
  const globalScale = settings.globalScale / 100
  const hoverScale = Math.max(1, settings.hoverScale / 100)
  const slots = Array.from({ length: columnCount * rowCount }, (_, slotIndex) => ({
    column: slotIndex % columnCount,
    row: Math.floor(slotIndex / columnCount),
    edgeDistance: Math.min(
      slotIndex % columnCount,
      columnCount - 1 - (slotIndex % columnCount),
      Math.floor(slotIndex / columnCount),
      rowCount - 1 - Math.floor(slotIndex / columnCount),
    ),
    noise: random(),
  }))
  slots.sort((first, second) => first.edgeDistance - second.edgeDistance || first.noise - second.noise)
  const layouts: Record<string, ItemLayout> = {}

  items.forEach((item, index) => {
    const slot = slots[index] ?? slots[slots.length - 1]
    const itemAspectRatio = Math.max(0.1, getItemAspectRatio(item))
    const visualWidthMultiplier = item.type === 'text' ? 1.38 : 1
    const desiredVisualWidth = Math.min(
      cellWidth * horizontalFill * densityScale * globalScale,
      cellHeight * itemAspectRatio * verticalFill * densityScale * globalScale,
    ) * (settings.scaleMode === 'priority'
      ? interpolate(MAX_SCALE, MIN_SCALE, Math.pow(index / Math.max(total - 1, 1), 0.72))
      : 1) * (0.88 + random() * 0.24)
    const maxVisualWidth = Math.min(
      usableWidth * 0.96,
      usableHeight * itemAspectRatio * 0.96,
      cellWidth * 1.65,
      cellHeight * itemAspectRatio * 2.2,
    )
    const visualWidth = Math.min(maxVisualWidth, Math.max(18, desiredVisualWidth))
    const width = visualWidth / visualWidthMultiplier / hoverScale
    const visualHeight = visualWidth / itemAspectRatio
    const baseX = world.width / 2 - usableWidth / 2 + cellWidth * (slot.column + 0.5)
    const baseY = world.height / 2 - usableHeight / 2 + cellHeight * (slot.row + 0.5)
    const jitterX = (random() - 0.5) * cellWidth * 0.42
    const jitterY = (random() - 0.5) * cellHeight * 0.38
    const minX = world.width / 2 - usableWidth / 2 + visualWidth / 2
    const maxX = world.width / 2 + usableWidth / 2 - visualWidth / 2
    const minY = world.height / 2 - usableHeight / 2 + visualHeight / 2
    const maxY = world.height / 2 + usableHeight / 2 - visualHeight / 2

    layouts[item.id] = {
      x: clamp(baseX + jitterX, minX, maxX),
      y: clamp(baseY + jitterY, minY, maxY),
      width,
      rotation: 0,
      zIndex: items.length - index,
    }
  })

  return layouts
}

export function generateLayout(
  items: CollageItem[],
  settings: CollageSettings,
  seed: number,
  isMobile: boolean,
  options?: { viewport?: { width: number; height: number } },
): Record<string, ItemLayout> {
  if (settings.interactionMode === 'cursor') {
    return generateCursorLayout(items, settings, seed, isMobile, options?.viewport ?? FALLBACK_VIEWPORT)
  }

  const random = createSeededRandom(seed)
  const world = getWorldSize(isMobile)
  const layouts: Record<string, ItemLayout> = {}
  const total = Math.max(items.length - 1, 1)
  const compactness = interpolate(0.62, 1.28, settings.density / 150)
  const horizontalOverlap = clamp((settings.horizontalOverlap + 50) / 200, 0, 1)
  const verticalOverlap = clamp((settings.verticalOverlap + 50) / 200, 0, 1)
  const radialLimit = Math.min(world.width, world.height * 1.56) * 0.42 * compactness
  const radialLimitX = radialLimit * interpolate(1.12, 0.62, horizontalOverlap)
  const radialLimitY = radialLimit * interpolate(1.12, 0.62, verticalOverlap)
  const globalScale = settings.globalScale / 100
  const viewportScale = isMobile ? 0.76 : 1

  items.forEach((item, index) => {
    const rank = index / total
    const priorityScale = settings.scaleMode === 'priority'
      ? interpolate(MAX_SCALE, MIN_SCALE, Math.pow(rank, 0.72))
      : 1
    const sizeBias = 0.9 + random() * 0.2
    const width = Math.max(
      MIN_CARD_WIDTH,
      Math.min(MAX_CARD_WIDTH, 230 * globalScale * viewportScale * priorityScale * sizeBias),
    )
    const ringDistance = index === 0 ? 0 : 70
    const angle = index * GOLDEN_ANGLE + (random() - 0.5) * 0.55
    const xJitter = (random() - 0.5) * 110 * horizontalOverlap
    const yJitter = (random() - 0.5) * 90 * verticalOverlap
    const isText = item.type === 'text'
    const radialProgress = Math.pow(rank, 0.68)
    const x = world.width / 2 + Math.cos(angle) * (ringDistance + radialProgress * radialLimitX) + xJitter
    const y = world.height / 2 + Math.sin(angle) * (ringDistance + radialProgress * radialLimitY) * (isMobile ? 0.36 : 0.62) + yJitter

    layouts[item.id] = {
      x,
      y,
      width: isText ? width * 1.38 : width,
      rotation: 0,
      zIndex: items.length - index,
    }
  })

  return layouts
}
