import type { CollageItem, TextCardStyle } from '../types'

export interface TextCardMetrics {
  width: number
  height: number
}

const MIN_TEXT_CARD_WIDTH = 232
const MAX_TEXT_CARD_WIDTH = 320
const DEFAULT_TEXT_CARD_WIDTH = 300
const TEXT_CARD_PADDING = 4
const TEXT_CARD_LINE_HEIGHT = 16

function getFont(style: TextCardStyle) {
  return style === 'wremena'
    ? { family: 'Wremena', size: 15.5 }
    : { family: 'Gramatika', size: 14 }
}

function getCandidateWidths() {
  const widths: number[] = []
  for (let width = MIN_TEXT_CARD_WIDTH; width <= MAX_TEXT_CARD_WIDTH; width += 2) widths.push(width)
  return widths
}

export function getEstimatedTextCardMetrics(item: CollageItem): TextCardMetrics {
  const text = item.text || 'Напишите текст'
  const lineCount = Math.max(1, text.split('\n').length)
  return {
    width: DEFAULT_TEXT_CARD_WIDTH,
    height: lineCount * TEXT_CARD_LINE_HEIGHT + TEXT_CARD_PADDING * 2,
  }
}

export async function measureTextCardMetrics(items: CollageItem[]): Promise<Record<string, TextCardMetrics>> {
  const textItems = items.filter((item) => item.type === 'text')
  if (!textItems.length || typeof document === 'undefined') return {}

  const styles = [...new Set(textItems.map((item) => item.textStyle ?? 'gramatika'))]
  await Promise.all(styles.map((style) => {
    const font = getFont(style)
    return document.fonts.load(`${font.size}px "${font.family}"`)
  }))
  await document.fonts.ready

  const measureSurface = document.createElement('div')
  Object.assign(measureSurface.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    visibility: 'hidden',
    pointerEvents: 'none',
    boxSizing: 'border-box',
    padding: `${TEXT_CARD_PADDING}px`,
    border: '0',
    margin: '0',
    whiteSpace: 'normal',
    overflow: 'visible',
  })

  const paragraph = document.createElement('p')
  Object.assign(paragraph.style, {
    display: 'block',
    width: '100%',
    maxWidth: 'none',
    margin: '0',
    padding: '0',
    fontWeight: '400',
    lineHeight: `${TEXT_CARD_LINE_HEIGHT}px`,
    textAlign: 'left',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    wordBreak: 'normal',
  })
  measureSurface.append(paragraph)
  document.body.append(measureSurface)

  try {
    return Object.fromEntries(textItems.map((item) => {
      const style = item.textStyle ?? 'gramatika'
      const font = getFont(style)
      measureSurface.style.fontFamily = `"${font.family}", sans-serif`
      measureSurface.style.fontSize = `${font.size}px`
      paragraph.style.fontFamily = `"${font.family}", sans-serif`
      paragraph.style.fontSize = `${font.size}px`
      paragraph.textContent = item.text || 'Напишите текст'

      const measurements = getCandidateWidths().map((width) => {
        measureSurface.style.width = `${width}px`
        const contentHeight = paragraph.getBoundingClientRect().height
        return {
          width,
          height: Math.ceil(contentHeight + TEXT_CARD_PADDING * 2),
          lines: Math.max(1, Math.round(contentHeight / TEXT_CARD_LINE_HEIGHT)),
        }
      })

      const narrowest = measurements[0]
      const widest = measurements[measurements.length - 1]
      const selected = narrowest.lines < 3
        ? narrowest
        : widest.lines > 5
          ? widest
          : measurements
            .filter((measurement) => measurement.lines >= 3 && measurement.lines <= 5)
            .sort((first, second) => (
              Math.abs(first.lines - 4) - Math.abs(second.lines - 4)
              || Math.abs(first.width - DEFAULT_TEXT_CARD_WIDTH) - Math.abs(second.width - DEFAULT_TEXT_CARD_WIDTH)
            ))[0] ?? widest

      return [item.id, { width: selected.width, height: selected.height }]
    }))
  } finally {
    measureSurface.remove()
  }
}
