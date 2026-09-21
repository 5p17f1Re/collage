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
export const PANORAMA_HEIGHT = 720
const PANORAMA_VERTICAL_OVERFLOW = 160
const PANORAMA_GAP = 14
const PANORAMA_HERO_CLEARANCE = 32
const PANORAMA_GUIDE_RATIOS = [0.14, 0.36, 0.64, 0.86]
const PANORAMA_CLUSTER_RATIOS = [0.1, 0.28, 0.42, 0.58, 0.72, 0.9]

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

interface Rectangle {
  x: number
  y: number
  width: number
  height: number
}

interface PanoramaLayoutResult {
  layouts: Record<string, ItemLayout>
  world: { width: number; height: number }
}

function rectanglesIntersect(first: Rectangle, second: Rectangle) {
  return first.x < second.x + second.width
    && first.x + first.width > second.x
    && first.y < second.y + second.height
    && first.y + first.height > second.y
}

function pruneFreeRectangles(rectangles: Rectangle[]) {
  return rectangles.filter((rectangle, index) => rectangle.width > 0.01 && rectangle.height > 0.01 && !rectangles.some((other, otherIndex) => (
    index !== otherIndex
    && rectangle.x >= other.x
    && rectangle.y >= other.y
    && rectangle.x + rectangle.width <= other.x + other.width
    && rectangle.y + rectangle.height <= other.y + other.height
  )))
}

function subtractUsedRectangle(freeRectangles: Rectangle[], used: Rectangle) {
  const next: Rectangle[] = []

  freeRectangles.forEach((free) => {
    if (!rectanglesIntersect(free, used)) {
      next.push(free)
      return
    }

    const freeRight = free.x + free.width
    const freeBottom = free.y + free.height
    const usedRight = used.x + used.width
    const usedBottom = used.y + used.height

    if (used.x > free.x) next.push({ x: free.x, y: free.y, width: used.x - free.x, height: free.height })
    if (usedRight < freeRight) next.push({ x: usedRight, y: free.y, width: freeRight - usedRight, height: free.height })
    if (used.y > free.y) next.push({ x: free.x, y: free.y, width: free.width, height: used.y - free.y })
    if (usedBottom < freeBottom) next.push({ x: free.x, y: usedBottom, width: free.width, height: freeBottom - usedBottom })
  })

  return pruneFreeRectangles(next)
}

function getPanoramaGroupAssignments(items: CollageItem[], groupCount: number, seed: number) {
  const assignments = new Map<string, number>()
  const automaticItems = items.slice(1).filter((item) => !item.sizeGroup)
  const random = createSeededRandom(seed + 41)

  automaticItems
    .map((item) => ({ item, order: random() }))
    .sort((first, second) => first.order - second.order)
    .forEach(({ item }, index) => assignments.set(item.id, index % groupCount))

  items.slice(1).forEach((item) => {
    if (item.sizeGroup) assignments.set(item.id, clamp(Math.round(item.sizeGroup), 1, groupCount) - 1)
  })

  return assignments
}

function getPanoramaGroupFactor(group: number, groupCount: number, groupContrast: number) {
  const contrast = clamp(groupContrast, 0, 100) / 100
  const smallestGroupFactor = interpolate(1, 0.4, contrast)
  return groupCount === 1 ? 1 : interpolate(smallestGroupFactor, 1, group / (groupCount - 1))
}

function getPanoramaHeroHeightFactor(
  hero: CollageItem,
  secondary: CollageItem[],
  assignments: Map<string, number>,
  groupCount: number,
  groupContrast: number,
) {
  const heroAspect = Math.max(0.1, getItemAspectRatio(hero))
  const largestSecondaryAreaFactor = secondary.reduce((largest, item) => {
    const group = assignments.get(item.id) ?? 0
    const scale = getPanoramaGroupFactor(group, groupCount, groupContrast)
    return Math.max(largest, scale ** 2 * Math.max(0.1, getItemAspectRatio(item)))
  }, 0)

  // A hero that is merely taller can still lose to a wide image. Use its
  // footprint instead: it is at least 2.25× the largest secondary card area,
  // while retaining a clear 1.65× height ratio for ordinary proportions.
  return Math.max(1.65, Math.sqrt(largestSecondaryAreaFactor * 2.25 / heroAspect))
}

function getGuidedTarget(
  index: number,
  group: number,
  contentBounds: Rectangle,
  random: () => number,
) {
  const guideIndex = (index * 3 + group * 2) % PANORAMA_GUIDE_RATIOS.length
  const clusterIndex = (index * 5 + group) % PANORAMA_CLUSTER_RATIOS.length
  const xJitter = (random() - 0.5) * contentBounds.width * 0.035
  const yJitter = (random() - 0.5) * contentBounds.height * 0.025

  return {
    x: contentBounds.x + contentBounds.width * PANORAMA_CLUSTER_RATIOS[clusterIndex] + xJitter,
    y: contentBounds.y + contentBounds.height * PANORAMA_GUIDE_RATIOS[guideIndex] + yJitter,
    guideY: contentBounds.y + contentBounds.height * PANORAMA_GUIDE_RATIOS[guideIndex],
  }
}

function getPanoramaContentBounds(world: { width: number; height: number }): Rectangle {
  const contentHeight = Math.min(PANORAMA_HEIGHT, world.height)

  return {
    x: 0,
    y: (world.height - contentHeight) / 2,
    width: world.width,
    height: contentHeight,
  }
}

function getEdgeContacts(rectangle: Rectangle, free: Rectangle) {
  const epsilon = 0.5
  return Number(Math.abs(rectangle.x - free.x) < epsilon)
    + Number(Math.abs(rectangle.y - free.y) < epsilon)
    + Number(Math.abs(rectangle.x + rectangle.width - (free.x + free.width)) < epsilon)
    + Number(Math.abs(rectangle.y + rectangle.height - (free.y + free.height)) < epsilon)
}

function placeAlongGuides(
  freeRectangles: Rectangle[],
  width: number,
  height: number,
  desiredX: number,
  desiredY: number,
  guideY: number,
  random: () => number,
) {
  let best: { rectangle: Rectangle; score: number } | undefined

  freeRectangles.forEach((free) => {
    if (width > free.width || height > free.height) return
    const candidateXs = [
      clamp(desiredX - width / 2, free.x, free.x + free.width - width),
      free.x,
      free.x + free.width - width,
    ]
    const candidateYs = [
      clamp(desiredY - height / 2, free.y, free.y + free.height - height),
      free.y,
      free.y + free.height - height,
    ]
    const seen = new Set<string>()

    candidateXs.forEach((x) => candidateYs.forEach((y) => {
      const key = `${Math.round(x * 10)}:${Math.round(y * 10)}`
      if (seen.has(key)) return
      seen.add(key)

      const rectangle = { x, y, width, height }
      const guideDistance = Math.abs(y + height / 2 - guideY)
      const clusterDistance = Math.abs(x + width / 2 - desiredX)
      const leftoverArea = free.width * free.height - width * height
      const edgeContacts = getEdgeContacts(rectangle, free)
      // Favour short local stacks and common guide lines. The tiny seeded term
      // breaks ties without turning the macro layout back into a scatter.
      const score = guideDistance * 0.72 + clusterDistance * 0.18 + leftoverArea / 100000 - edgeContacts * 78 + random() * 2
      if (!best || score < best.score) best = { rectangle, score }
    }))
  })

  return best?.rectangle
}

function tryPackPanorama(
  items: CollageItem[],
  world: { width: number; height: number },
  groupCount: number,
  groupContrast: number,
  seed: number,
  scale: number,
) {
  if (!items.length) return {} as Record<string, ItemLayout>

  const hero = items[0]
  const contentBounds = getPanoramaContentBounds(world)
  const assignments = getPanoramaGroupAssignments(items, groupCount, seed)
  const secondaryItems = items.slice(1)
  const baseHeight = clamp(Math.min(contentBounds.height * 0.28, contentBounds.width * 0.125), 72, 220) * scale
  const heroHeight = baseHeight * getPanoramaHeroHeightFactor(hero, secondaryItems, assignments, groupCount, groupContrast)
  const heroWidth = heroHeight * Math.max(0.1, getItemAspectRatio(hero))
  const heroOuter: Rectangle = {
    x: contentBounds.x + (contentBounds.width - heroWidth) / 2 - PANORAMA_HERO_CLEARANCE,
    y: contentBounds.y + (contentBounds.height - heroHeight) / 2 - PANORAMA_HERO_CLEARANCE,
    width: heroWidth + PANORAMA_HERO_CLEARANCE * 2,
    height: heroHeight + PANORAMA_HERO_CLEARANCE * 2,
  }

  if (
    heroOuter.x < contentBounds.x
    || heroOuter.y < contentBounds.y
    || heroOuter.x + heroOuter.width > contentBounds.x + contentBounds.width
    || heroOuter.y + heroOuter.height > contentBounds.y + contentBounds.height
  ) return undefined

  const layouts: Record<string, ItemLayout> = {
    [hero.id]: {
      x: heroOuter.x + PANORAMA_HERO_CLEARANCE + heroWidth / 2,
      y: heroOuter.y + PANORAMA_HERO_CLEARANCE + heroHeight / 2,
      width: heroWidth,
      height: heroHeight,
      rotation: 0,
      zIndex: items.length + 100,
    },
  }
  let freeRectangles = subtractUsedRectangle([contentBounds], heroOuter)
  const random = createSeededRandom(seed + 103)
  const secondary = secondaryItems
    .map((item) => ({ item, group: assignments.get(item.id) ?? 0, noise: random() }))
    .sort((first, second) => second.group - first.group || first.noise - second.noise)

  for (const [index, entry] of secondary.entries()) {
    const height = baseHeight * getPanoramaGroupFactor(entry.group, groupCount, groupContrast)
    const width = height * Math.max(0.1, getItemAspectRatio(entry.item))
    const outerWidth = width + PANORAMA_GAP
    const outerHeight = height + PANORAMA_GAP
    const target = getGuidedTarget(index, entry.group, contentBounds, random)
    const placed = placeAlongGuides(
      freeRectangles,
      outerWidth,
      outerHeight,
      target.x,
      target.y,
      target.guideY,
      random,
    )
    if (!placed) return undefined

    layouts[entry.item.id] = {
      x: placed.x + PANORAMA_GAP / 2 + width / 2,
      y: placed.y + PANORAMA_GAP / 2 + height / 2,
      width,
      height,
      rotation: 0,
      zIndex: items.length - index,
    }
    freeRectangles = subtractUsedRectangle(freeRectangles, placed)
  }

  return layouts
}

export function getPanoramaWorldSize(viewportWidth: number, spanPercent: number) {
  const safeViewportWidth = Math.max(1, viewportWidth || FALLBACK_VIEWPORT.width)
  return {
    width: safeViewportWidth * clamp(spanPercent, 50, 150) / 50,
    height: PANORAMA_HEIGHT + PANORAMA_VERTICAL_OVERFLOW,
  }
}

export function generatePanoramaLayout(
  items: CollageItem[],
  settings: CollageSettings,
  seed: number,
  viewportWidth: number,
): PanoramaLayoutResult {
  const groupCount = clamp(Math.round(settings.panorama.groupCount), 1, 5)
  const groupContrast = clamp(settings.panorama.groupContrast, 0, 100)
  const world = getPanoramaWorldSize(viewportWidth, settings.panorama.spanPercent)
  let layout: Record<string, ItemLayout> | undefined
  let low = 0.02
  let high = 4

  for (let attempt = 0; attempt < 18; attempt += 1) {
    const scale = (low + high) / 2
    const candidate = tryPackPanorama(items, world, groupCount, groupContrast, seed, scale)
    if (candidate) {
      layout = candidate
      low = scale
    } else {
      high = scale
    }
  }

  return { layouts: layout ?? {}, world }
}
