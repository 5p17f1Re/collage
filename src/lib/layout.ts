import type { CollageItem, CollageSettings, ItemLayout } from '../types'

const DESKTOP_WORLD = { width: 2600, height: 1540 }
const MOBILE_WORLD = { width: 2060, height: 620 }
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
const MIN_CARD_WIDTH = 112
const MAX_CARD_WIDTH = 520
const MIN_SCALE = 0.65
const MAX_SCALE = 1.28

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

export function generateLayout(
  items: CollageItem[],
  settings: CollageSettings,
  seed: number,
  isMobile: boolean,
): Record<string, ItemLayout> {
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
