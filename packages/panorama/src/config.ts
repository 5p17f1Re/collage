import type { CollageItem, CollageSettings, PanoramaSettings } from './types'
export type { CollageItem, PanoramaSettings } from './types'
export interface PanoramaData {
  schemaVersion: 1
  items: CollageItem[]
  seed: number
  settings: { panorama: PanoramaSettings; background: string; showGrid: boolean; gridColor: string }
}
export const DEFAULT_PANORAMA: PanoramaSettings = { groupCount: 3, spanPercent: 100, cardGap: 4, groupContrast: 60, heroScale: 150, inertia: 40 }
export function createPanoramaData(): PanoramaData {
  return { schemaVersion: 1, items: [], seed: 2648, settings: { panorama: { ...DEFAULT_PANORAMA }, background: '#ffffff', showGrid: false, gridColor: '#4a4a4a' } }
}
function number(value: unknown, fallback: number, min: number, max: number): number {
  if (value === undefined) return fallback
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`Число вне диапазона ${min}…${max}`)
  return value
}
function string(value: unknown, fallback = ''): string {
  if (value === undefined) return fallback
  if (typeof value !== 'string') throw new Error('Ожидался текст')
  return value
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Ожидался объект конфигурации')
  return value as Record<string, unknown>
}
function url(value: unknown): string | undefined {
  if (value === undefined || value === '') return undefined
  const text = string(value)
  if (/^(https?:\/\/|\/[^/]|\.\.?\/)/i.test(text) && !/[\u0000-\u0020\\]/.test(text)) return text
  throw new Error('Нужен постоянный HTTP(S) или относительный URL файла; blob/data не сохраняются')
}
function color(value: unknown, fallback: string) {
  const text = string(value, fallback)
  if (!/^#[\da-f]{6}$/i.test(text)) throw new Error('Цвет должен быть #RRGGBB')
  return text
}
/** Validates and copies persisted data. Throws on unsupported versions and temporary URLs. */
export function parsePanoramaData(input: unknown): PanoramaData {
  const data = record(input)
  if (data.schemaVersion !== 1) throw new Error('Неизвестная версия данных Панорамы')
  if (!Array.isArray(data.items)) throw new Error('Нет списка материалов')
  const settings = record(data.settings ?? {})
  const p = record(settings.panorama ?? {})
  const defaults = DEFAULT_PANORAMA
  const panorama: PanoramaSettings = {
    groupCount: number(p.groupCount, defaults.groupCount, 1, 7), spanPercent: number(p.spanPercent, defaults.spanPercent, 50, 250),
    cardGap: number(p.cardGap, defaults.cardGap, 0, 16), groupContrast: number(p.groupContrast, defaults.groupContrast, 0, 250),
    heroScale: number(p.heroScale, defaults.heroScale, 50, 250), inertia: number(p.inertia, defaults.inertia, 0, 100),
  }
  if (!Number.isInteger(panorama.groupCount) || ![0,4,8,12,16].includes(panorama.cardGap)) throw new Error('Некорректные группы или зазор')
  const ids = new Set<string>()
  const items = data.items.map((raw): CollageItem => {
    const item = record(raw)
    const id = string(item.id)
    if (!id || ids.has(id)) throw new Error('ID материалов должны быть заполнены и уникальны внутри блока')
    ids.add(id)
    if (!['image','video','text'].includes(String(item.type))) throw new Error('Неизвестный тип материала')
    const type = item.type as CollageItem['type']
    const source = url(item.source)
    if (type !== 'text' && !source) throw new Error('У медиа отсутствует адрес файла')
    const textStyle = item.textStyle ?? 'gramatika'
    if (textStyle !== 'gramatika' && textStyle !== 'wremena') throw new Error('Неизвестный стиль текста')
    const sizeGroup = item.sizeGroup === undefined ? undefined : number(item.sizeGroup, 1, 1, panorama.groupCount)
    if (sizeGroup !== undefined && !Number.isInteger(sizeGroup)) throw new Error('Группа должна быть целой')
    return { id, type, name: string(item.name), caption: string(item.caption), source,
      aspectRatio: number(item.aspectRatio, 1, 0.0001, 10000), placeholder: url(item.placeholder), poster: url(item.poster),
      text: type === 'text' ? string(item.text) : undefined, textStyle: type === 'text' ? textStyle : undefined, sizeGroup }
  })
  return { schemaVersion: 1, seed: number(data.seed, 2648, 0, 2147483647), items,
    settings: { panorama, background: color(settings.background, '#ffffff'), gridColor: color(settings.gridColor, '#4a4a4a'), showGrid: settings.showGrid === true } }
}
export function toInternalSettings(data: PanoramaData): CollageSettings {
  return { ...data.settings, density: 56, horizontalOverlap: 34, verticalOverlap: 34, scaleMode: 'priority', globalScale: 100,
    hoverScale: 100, interactionMode: 'drag', heroEnabled: true, heroScale: 100, previewImages: {} }
}
