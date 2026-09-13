import type { CollageItem, CollageSettings, ItemLayout } from '../types'

const DESKTOP_WORLD = { width: 2600, height: 1540 }
const MOBILE_WORLD = { width: 2060, height: 620 }
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
const MIN_CARD_WIDTH = 112
const MAX_CARD_WIDTH = 520
const MIN_SCALE = 0.65
const MAX_SCALE = 1.28
const FALLBACK_VIEWPORT = { width: 1200, height: 800 }
const MAX_EDGE_CLIP = 0.4
// At a corner the horizontal and vertical clipping multiply. Keeping at least
// sqrt(60%) on each axis guarantees that the card remains at least 60% visible.
const MAX_CORNER_AXIS_CLIP = 1 - Math.sqrt(1 - MAX_EDGE_CLIP)

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
    x: Math.min(144, Math.max(68, viewport.width * 0.12)),
    y: Math.min(108, Math.max(50, viewport.height * 0.12)),
  }
}

function getItemAspectRatio(item: CollageItem) {
  if (item.type !== 'text') return item.aspectRatio
  if (item.textSize === 'small') return 1.3
  if (item.textSize === 'large') return 1.56
  return 1.42
}

function getHeroItem(items: CollageItem[], settings: CollageSettings) {
  const firstItem = items[0]
  return settings.heroEnabled && firstItem?.type !== 'text' ? firstItem : undefined
}

function getCursorBounds(
  viewport: { width: number; height: number },
  width: number,
  height: number,
  followRange: { x: number; y: number },
) {
  const clipX = Math.min(MAX_CORNER_AXIS_CLIP, followRange.x / Math.max(width, 1) * 0.94)
  const clipY = Math.min(MAX_CORNER_AXIS_CLIP, followRange.y / Math.max(height, 1) * 0.94)
  const minX = width * (0.5 - clipX)
  const minY = height * (0.5 - clipY)

  return {
    minX,
    maxX: Math.max(minX, viewport.width - minX),
    minY,
    maxY: Math.max(minY, viewport.height - minY),
  }
}

function createScrapbookSlots(
  viewport: { width: number; height: number },
  heroWidth: number,
  heroHeight: number,
  count: number,
  horizontalOverlap: number,
  verticalOverlap: number,
  random: () => number,
) {
  const aspect = viewport.width / viewport.height
  const columns = clamp(Math.ceil(Math.sqrt(Math.max(count, 1) * aspect)), 3, 11)
  const rows = clamp(Math.ceil(Math.max(count, 1) / columns), 3, 9)
  const heroHalfWidth = heroWidth / viewport.width / 2
  const heroHalfHeight = heroHeight / viewport.height / 2
  const slots: Array<{ x: number; y: number; distance: number; isCorner: boolean; noise: number }> = []

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const cellWidth = 1 / columns
      const cellHeight = 1 / rows
      const rawX = (column + 0.5) * cellWidth
      const rawY = (row + 0.5) * cellHeight
      const isCorner = (column === 0 || column === columns - 1) && (row === 0 || row === rows - 1)
      // A shuffled field of uneven slots preserves coverage but removes the
      // visual logic of a table. The hero is allowed to overlap the field.
      const xSpread = interpolate(1.12, 0.86, horizontalOverlap)
      const ySpread = interpolate(1.12, 0.86, verticalOverlap)
      const x = clamp(0.5 + (rawX - 0.5) * xSpread + (random() - 0.5) * cellWidth * 0.84, -0.12, 1.12)
      const y = clamp(0.5 + (rawY - 0.5) * ySpread + (random() - 0.5) * cellHeight * 0.84, -0.12, 1.12)
      slots.push({
        x,
        y,
        distance: Math.hypot(x - 0.5, y - 0.5),
        isCorner,
        noise: random(),
      })
    }
  }

  return slots
}

function selectEvenlyDistributedSlots<T extends { x: number; y: number; noise: number }>(slots: T[], count: number) {
  if (count >= slots.length) return slots
  const selected: T[] = []
  const remaining = [...slots]

  while (selected.length < count && remaining.length) {
    let bestIndex = 0
    let bestScore = -Infinity
    remaining.forEach((slot, index) => {
      const nearestDistance = selected.length
        ? Math.min(...selected.map((other) => Math.hypot(slot.x - other.x, slot.y - other.y)))
        : 1
      const score = nearestDistance + slot.noise * 0.08
      if (score > bestScore) {
        bestScore = score
        bestIndex = index
      }
    })
    selected.push(remaining.splice(bestIndex, 1)[0])
  }

  return selected
}

function getOverlapRatio(x: number, y: number, width: number, height: number, heroWidth: number, heroHeight: number, viewport: { width: number; height: number }) {
  if (!heroWidth || !heroHeight) return 0
  const heroLeft = (viewport.width - heroWidth) / 2
  const heroTop = (viewport.height - heroHeight) / 2
  const left = x - width / 2
  const top = y - height / 2
  const overlapWidth = Math.max(0, Math.min(left + width, heroLeft + heroWidth) - Math.max(left, heroLeft))
  const overlapHeight = Math.max(0, Math.min(top + height, heroTop + heroHeight) - Math.max(top, heroTop))
  return overlapWidth * overlapHeight / Math.max(width * height, 1)
}

function generateScrapbookLayout(
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
  const horizontalOverlap = clamp((settings.horizontalOverlap + 50) / 200, 0, 1)
  const verticalOverlap = clamp((settings.verticalOverlap + 50) / 200, 0, 1)
  const densityScale = interpolate(0.76, 1.16, settings.density / 150)
  const verticalFill = interpolate(0.82, 1.22, verticalOverlap)
  const globalScale = settings.globalScale / 100
  const hoverScale = Math.max(1, settings.hoverScale / 100)
  const heroItem = getHeroItem(items, settings)
  const secondaryItems = heroItem ? items.filter((item) => item.id !== heroItem.id) : items
  const mediaCount = Math.max(secondaryItems.filter((item) => item.type !== 'text').length, 1)
  const aspect = safeViewport.width / safeViewport.height
  const rowCount = clamp(Math.ceil(Math.sqrt(mediaCount / aspect)), 3, 8)
  const secondaryHeight = clamp(
    safeViewport.height / rowCount * densityScale * verticalFill * globalScale / hoverScale,
    42,
    safeViewport.height * 0.31,
  )
  const heroAspectRatio = heroItem ? Math.max(0.1, getItemAspectRatio(heroItem)) : 0
  const heroTargetHeight = safeViewport.height * 0.6 * (settings.heroScale / 100)
  const heroWidth = heroItem
    ? Math.min(heroTargetHeight * heroAspectRatio, safeViewport.width * 0.92)
    : 0
  const heroHeight = heroItem ? heroWidth / heroAspectRatio : 0
  const slots = createScrapbookSlots(
    safeViewport,
    heroWidth,
    heroHeight,
    secondaryItems.length,
    horizontalOverlap,
    verticalOverlap,
    random,
  )
  const distributedSlots = selectEvenlyDistributedSlots(slots, secondaryItems.length)
  const layouts: Record<string, ItemLayout> = {}

  if (heroItem) {
    layouts[heroItem.id] = {
      x: world.width / 2,
      y: world.height / 2,
      width: heroWidth,
      height: heroHeight,
      rotation: 0,
      zIndex: items.length + 100,
    }
  }

  secondaryItems.forEach((item, index) => {
    const isText = item.type === 'text'
    const itemAspectRatio = Math.max(0.1, getItemAspectRatio(item))
    const priorityScale = heroItem || settings.scaleMode === 'uniform'
      ? 1
      : interpolate(MAX_SCALE, MIN_SCALE, Math.pow(index / Math.max(secondaryItems.length - 1, 1), 0.72))
    const height = secondaryHeight * priorityScale * (isText ? 1.14 : 1)
    const width = height * itemAspectRatio * (isText ? 1.1 : 1)
    const slot = distributedSlots[index % distributedSlots.length]
    const bounds = getCursorBounds(safeViewport, width, height, followRange)
    const jitterX = (random() - 0.5) * safeViewport.width / Math.max(10, mediaCount) * 1.7
    const jitterY = (random() - 0.5) * safeViewport.height / Math.max(10, mediaCount) * 1.35
    let x = clamp(slot.x * safeViewport.width + jitterX, bounds.minX, bounds.maxX)
    let y = clamp(slot.y * safeViewport.height + jitterY, bounds.minY, bounds.maxY)

    // A secondary card can enter the hero zone, but never lose more than 40%
    // of its own area behind it. Nudge it outwards until the limit holds.
    for (let attempt = 0; heroItem && getOverlapRatio(x, y, width, height, heroWidth, heroHeight, safeViewport) > 0.4 && attempt < 12; attempt += 1) {
      const dx = x - safeViewport.width / 2 || (random() - 0.5)
      const dy = y - safeViewport.height / 2 || (random() - 0.5)
      const magnitude = Math.hypot(dx, dy) || 1
      x = clamp(x + dx / magnitude * 28, bounds.minX, bounds.maxX)
      y = clamp(y + dy / magnitude * 28, bounds.minY, bounds.maxY)
    }

    layouts[item.id] = {
      x: world.width / 2 - safeViewport.width / 2 + x,
      y: world.height / 2 - safeViewport.height / 2 + y,
      width,
      height,
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
  return generateScrapbookLayout(items, settings, seed, isMobile, options?.viewport ?? FALLBACK_VIEWPORT)
}
