export type CollageItemType = 'image' | 'video' | 'text'
export type ScaleMode = 'priority' | 'uniform'
export type TextCardSize = 'small' | 'medium' | 'large'
export type InteractionMode = 'drag' | 'cursor'

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
  background: string
}

export interface ItemLayout {
  x: number
  y: number
  width: number
  rotation: number
  zIndex: number
}
