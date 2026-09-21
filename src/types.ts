export type CollageItemType = 'image' | 'video' | 'text'
export type ScaleMode = 'priority' | 'uniform'
export type TextCardSize = 'small' | 'medium' | 'large'
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
  /** 0 keeps groups nearly equal; 100 maximises their size difference. */
  groupContrast: number
}

export interface CollageItem {
  id: string
  name: string
  type: CollageItemType
  source?: string
  caption: string
  text?: string
  textSize?: TextCardSize
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
