import type { CollageItem } from './types'

type SampleArtwork = {
  background: string
  accent: string
  detail: string
  pattern: string
}

const SAMPLE_ARTWORKS: SampleArtwork[] = [
  { background: '#9b9a96', accent: '#d5c4a1', detail: '#3f392f', pattern: 'ring' },
  { background: '#77726c', accent: '#d8d1c8', detail: '#171717', pattern: 'hand' },
  { background: '#c9cacb', accent: '#a87155', detail: '#6b3d2d', pattern: 'stem' },
  { background: '#5a5a59', accent: '#d9c6ba', detail: '#171717', pattern: 'oval' },
  { background: '#b4afa8', accent: '#e2d0c0', detail: '#5a493f', pattern: 'circle' },
  { background: '#767675', accent: '#babcc0', detail: '#242426', pattern: 'line' },
  { background: '#d1cfcc', accent: '#9e765e', detail: '#352d28', pattern: 'ring' },
  { background: '#87878b', accent: '#d3c6bd', detail: '#514a4d', pattern: 'hand' },
  { background: '#b9b5b0', accent: '#eed1c1', detail: '#62534d', pattern: 'stem' },
  { background: '#686a6d', accent: '#afb1b1', detail: '#222223', pattern: 'oval' },
  { background: '#c6c5c1', accent: '#d9bb93', detail: '#554435', pattern: 'circle' },
]

const SAMPLE_ASPECT_RATIOS = [0.7, 0.68, 1.15, 0.74, 0.86, 0.72, 0.95, 0.68, 0.73, 0.9, 0.74]

function createArtwork({ background, accent, detail, pattern }: SampleArtwork) {
  const shapes: Record<string, string> = {
    ring: `<ellipse cx="252" cy="258" rx="84" ry="122" fill="none" stroke="${accent}" stroke-width="30"/><circle cx="220" cy="245" r="22" fill="${detail}"/>`,
    hand: `<path d="M90 448C130 302 153 116 224 95c47-14 51 43 22 104l-48 98 57-132c31-72 82-32 53 38l-55 130 62-94c39-60 83-15 45 45L262 436Z" fill="${accent}"/><path d="M121 450c78-91 157-96 274-48" stroke="${detail}" stroke-width="13" fill="none"/>`,
    stem: `<path d="M126 494C226 372 245 192 438 33" fill="none" stroke="${accent}" stroke-width="20"/><path d="M265 229c76-50 137-51 171-15-56 34-108 42-171 15Z" fill="${detail}"/><path d="M180 348c60-16 106 0 131 45-59 6-103-8-131-45Z" fill="${detail}"/>`,
    oval: `<ellipse cx="249" cy="267" rx="143" ry="205" fill="${accent}"/><ellipse cx="269" cy="237" rx="74" ry="130" fill="${detail}" opacity=".62"/>`,
    circle: `<circle cx="252" cy="252" r="142" fill="none" stroke="${accent}" stroke-width="48"/><path d="M90 417 418 106" stroke="${detail}" stroke-width="9"/>`,
    line: `<path d="M48 391C113 306 98 175 223 119c90-40 154 37 229-57" fill="none" stroke="${accent}" stroke-width="48"/><path d="M37 130 476 401" stroke="${detail}" stroke-width="8" opacity=".7"/>`,
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520"><rect width="520" height="520" fill="${background}"/><rect x="16" y="16" width="488" height="488" fill="none" stroke="#ffffff" stroke-opacity=".24"/>${shapes[pattern]}</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export const SAMPLE_ITEMS: CollageItem[] = SAMPLE_ARTWORKS.map((artwork, index) => ({
  id: `sample-${index + 1}`,
  name: `Материал ${String(index + 1).padStart(2, '0')}`,
  type: 'image',
  source: createArtwork(artwork),
  caption: '',
  aspectRatio: SAMPLE_ASPECT_RATIOS[index],
}))
