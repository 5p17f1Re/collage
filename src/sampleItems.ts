import type { CollageItem } from './types'

const SAMPLE_ASSET_URLS = import.meta.glob<string>('./assets/sample-set/*.jpg', {
  eager: true,
  query: '?url',
  import: 'default',
})

// Keep the lead image fixed so it remains the Panorama anchor; the remaining
// files use a one-time shuffled order for a varied but repeatable first load.
const SAMPLE_ASSET_ORDER = [
  'image.jpg',
  '15.jpg', '05.jpg', '10.jpg', '06.jpg', '22.jpg', '23.jpg', '04.jpg', '13.jpg',
  '14.jpg', '07.jpg', '12.jpg', '02.jpg', '08.jpg', '09.jpg', '24.jpg', '25.jpg',
  '17.jpg', '03.jpg', '16.jpg', '18.jpg', '19.jpg', '20.jpg', '11.jpg', '21.jpg',
  '01.jpg',
]

const SAMPLE_ASPECT_RATIOS: Record<string, number> = {
  image: 1454 / 1938,
  '01': 1762 / 1200,
  '02': 1620 / 1200,
  '03': 952 / 1200,
  '04': 1178 / 1200,
  '05': 764 / 1200,
  '06': 1762 / 1200,
  '07': 900 / 1200,
  '08': 762 / 1200,
  '09': 2050 / 1200,
  '10': 1212 / 1200,
  '11': 848 / 1200,
  '12': 1528 / 1200,
  '13': 1226 / 1200,
  '14': 950 / 1200,
  '15': 1118 / 1200,
  '16': 1014 / 1200,
  '17': 1902 / 1200,
  '18': 554 / 1200,
  '19': 1050 / 1200,
  '20': 554 / 1200,
  '21': 2102 / 1200,
  '22': 1262 / 1200,
  '23': 1364 / 1200,
  '24': 1424 / 1200,
  '25': 1600 / 1200,
}

export const SAMPLE_ITEMS: CollageItem[] = SAMPLE_ASSET_ORDER.map((filename) => {
  const name = filename.replace(/\.jpg$/i, '')
  const source = SAMPLE_ASSET_URLS[`./assets/sample-set/${filename}`]

  if (!source) throw new Error(`Missing default collage image: ${filename}`)

  return {
    id: `sample-${name}`,
    name,
    type: 'image',
    source,
    caption: '',
    aspectRatio: SAMPLE_ASPECT_RATIOS[name] ?? 1,
  }
})
