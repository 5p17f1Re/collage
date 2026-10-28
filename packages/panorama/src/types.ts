export type CollageItemType = 'image' | 'video' | 'text'
export type ScaleMode = 'priority' | 'uniform'
export type TextCardStyle = 'gramatika' | 'wremena'
export type InteractionMode = 'drag' | 'cursor'
export type LayoutMode = 'field' | 'panorama'
export type PreviewImageSlot = 'top' | 'bottom'

export interface PreviewImage {
  source: string
  name: string
}

export type PreviewImages = Partial<Record<PreviewImageSlot, PreviewImage>>

export interface PanoramaSettings {
  groupCount: number
  spanPercent: number
  /** Visible edge-to-edge distance between cards in Panorama. */
  cardGap: number
  /** 0 keeps groups equal; values above 100 make the smallest groups smaller. */
  groupContrast: number
  /** Main Panorama card scale, independent from secondary size groups. */
  heroScale: number
  /** 0 disables post-swipe coast; higher values extend its duration and distance. */
  inertia: number
}

export interface CollageItem {
  id: string
  name: string
  type: CollageItemType
  source?: string
  placeholder?: string
  poster?: string
  caption: string
  text?: string
  textStyle?: TextCardStyle
  aspectRatio: number
  isObjectUrl?: boolean
  /** Undefined lets Panorama assign a group automatically. */
  sizeGroup?: number
}

export interface CollageSettings {
  density: number
  horizontalOverlap: number
  verticalOverlap: number
  scaleMode: ScaleMode
  globalScale: number
  hoverScale: number
  showGrid: boolean
  gridColor: string
  interactionMode: InteractionMode
  heroEnabled: boolean
  heroScale: number
  background: string
  panorama: PanoramaSettings
  previewImages: PreviewImages
}

export interface ItemLayout {
  x: number
  y: number
  width: number
  height?: number
  rotation: number
  zIndex: number
}
