import { useEffect, useMemo, useRef, useState } from 'react'
import { CollageStage } from './components/CollageStage'
import { GalleryDialog } from './components/GalleryDialog'
import { CloseIcon } from './components/icons'
import { Sidebar } from './components/Sidebar'
import { useMediaQuery } from './hooks/useMediaQuery'
import { SAMPLE_ITEMS } from './sampleItems'
import type { CollageItem, CollageSettings } from './types'

const INITIAL_SETTINGS: CollageSettings = {
  density: 56,
  horizontalOverlap: 34,
  verticalOverlap: 34,
  scaleMode: 'priority',
  globalScale: 100,
  hoverScale: 124,
  showGrid: true,
  gridColor: '#4a4a4a',
  interactionMode: 'drag',
  heroEnabled: false,
  background: '#ffffff',
}

const DEFAULT_TEXT = 'Мы представляем\nновую коллекцию\n«Сад»'

function createItemId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

function getMediaType(file: File): CollageItem['type'] {
  return file.type.startsWith('video/') ? 'video' : 'image'
}

function moveItem(items: CollageItem[], itemId: string, direction: -1 | 1) {
  const sourceIndex = items.findIndex((item) => item.id === itemId)
  const targetIndex = sourceIndex + direction
  if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= items.length) return items

  const reorderedItems = [...items]
  const [item] = reorderedItems.splice(sourceIndex, 1)
  reorderedItems.splice(targetIndex, 0, item)
  return reorderedItems
}

function reorderItems(items: CollageItem[], sourceId: string, targetId: string) {
  const sourceIndex = items.findIndex((item) => item.id === sourceId)
  const targetIndex = items.findIndex((item) => item.id === targetId)
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return items

  const reorderedItems = [...items]
  const [item] = reorderedItems.splice(sourceIndex, 1)
  reorderedItems.splice(targetIndex, 0, item)
  return reorderedItems
}

function shuffleItems(items: CollageItem[]) {
  const shuffledItems = [...items]
  for (let index = shuffledItems.length - 1; index > 0; index -= 1) {
    const targetIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffledItems[index], shuffledItems[targetIndex]] = [shuffledItems[targetIndex], shuffledItems[index]]
  }
  return shuffledItems
}

function StoryMediaSection({ position, images, onAddFiles }: { position: 'top' | 'bottom'; images: string[]; onAddFiles: (files: File[]) => void }) {
  const label = position === 'top' ? 'Материалы перед историей' : 'Материалы после истории'
  return (
    <section className={`story-media story-media--${position}`} aria-label={label}>
      {images.length > 0 ? <div className="story-media__images">{images.map((source) => <img key={source} src={source} alt="Материал истории" />)}</div> : <div className="story-media__empty">Сюда можно добавить изображения для вертикального пролога или эпилога.</div>}
      <label className="story-media__upload">
        <input className="visually-hidden" type="file" accept="image/*" multiple onChange={(event) => { onAddFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = '' }} />
        Добавить изображения
      </label>
    </section>
  )
}

export function App() {
  const [items, setItems] = useState<CollageItem[]>(() => SAMPLE_ITEMS.map((item) => ({ ...item })))
  const [settings, setSettings] = useState<CollageSettings>(INITIAL_SETTINGS)
  const [selectedItemId, setSelectedItemId] = useState<string | undefined>(SAMPLE_ITEMS[0]?.id)
  const [seed, setSeed] = useState(2648)
  const [isPreview, setIsPreview] = useState(false)
  const [gallerySelection, setGallerySelection] = useState<{ id: string; origin: { x: number; y: number } }>()
  const [storyImages, setStoryImages] = useState({ top: [] as string[], bottom: [] as string[] })
  const objectUrlsRef = useRef(new Set<string>())
  const isMobile = useMediaQuery('(max-width: 760px)')

  const selectedItem = useMemo(() => items.find((item) => item.id === selectedItemId), [items, selectedItemId])
  const galleryItems = useMemo(() => items.filter((item) => item.type !== 'text' && item.source), [items])

  useEffect(() => () => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && isPreview) setIsPreview(false)
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isPreview])

  function handleAddFiles(files: File[]) {
    const newItems = files.map((file) => {
      const source = URL.createObjectURL(file)
      objectUrlsRef.current.add(source)

      return {
        id: createItemId('local'),
        name: file.name.replace(/\.[^/.]+$/, ''),
        type: getMediaType(file),
        source,
        caption: '',
        aspectRatio: 1,
        isObjectUrl: true,
      } satisfies CollageItem
    })

    setItems((currentItems) => {
      const hasOnlyStarterItems = currentItems.every((item) => item.id.startsWith('sample-'))
      return hasOnlyStarterItems ? newItems : [...currentItems, ...newItems]
    })
    setSelectedItemId(newItems[0]?.id)
    setSeed((currentSeed) => currentSeed + 1)
  }

  function handleAddText() {
    const textItem: CollageItem = {
      id: createItemId('text'),
      name: 'Текстовый блок',
      type: 'text',
      caption: '',
      text: DEFAULT_TEXT,
      textSize: 'large',
      aspectRatio: 1.56,
    }

    setItems((currentItems) => [...currentItems, textItem])
    setSelectedItemId(textItem.id)
    setSeed((currentSeed) => currentSeed + 1)
  }

  function handleUpdateItem(itemId: string, updates: Partial<CollageItem>) {
    setItems((currentItems) => currentItems.map((item) => item.id === itemId ? { ...item, ...updates } : item))
  }

  function handleAspectRatioChange(itemId: string, aspectRatio: number) {
    if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) return
    setItems((currentItems) => currentItems.map((item) => (
      item.id === itemId && Math.abs(item.aspectRatio - aspectRatio) > 0.001
        ? { ...item, aspectRatio }
        : item
    )))
  }

  function handleRemoveItem(itemId: string) {
    setItems((currentItems) => {
      const removedItem = currentItems.find((item) => item.id === itemId)
      if (removedItem?.isObjectUrl && removedItem.source) {
        URL.revokeObjectURL(removedItem.source)
        objectUrlsRef.current.delete(removedItem.source)
      }
      return currentItems.filter((item) => item.id !== itemId)
    })
    setSelectedItemId((currentId) => currentId === itemId ? undefined : currentId)
    setSeed((currentSeed) => currentSeed + 1)
  }

  function handleAddStoryFiles(position: 'top' | 'bottom', files: File[]) {
    const sources = files.filter((file) => file.type.startsWith('image/')).map((file) => {
      const source = URL.createObjectURL(file)
      objectUrlsRef.current.add(source)
      return source
    })
    if (sources.length) setStoryImages((current) => ({ ...current, [position]: [...current[position], ...sources] }))
  }

  if (isPreview) {
    return (
      <>
        <div className="story-preview">
          <StoryMediaSection position="top" images={storyImages.top} onAddFiles={(files) => handleAddStoryFiles('top', files)} />
          <section className="story-preview__interactive" aria-label="Интерактивная история">
            <CollageStage items={items} settings={settings} seed={seed} isMobile={isMobile} isPreview onOpenGallery={(itemId, origin) => setGallerySelection({ id: itemId, origin })} onAspectRatioChange={handleAspectRatioChange} />
          </section>
          <StoryMediaSection position="bottom" images={storyImages.bottom} onAddFiles={(files) => handleAddStoryFiles('bottom', files)} />
        </div>
        <button className="preview-exit" onClick={() => setIsPreview(false)} aria-label="Вернуться к лаборатории"><CloseIcon /></button>
        {gallerySelection && galleryItems.length > 0 && <GalleryDialog items={galleryItems} activeItemId={gallerySelection.id} origin={gallerySelection.origin} onClose={() => setGallerySelection(undefined)} />}
      </>
    )
  }

  return (
    <div className="app-shell">
      <Sidebar
          items={items}
          selectedItem={selectedItem}
          settings={settings}
          onAddFiles={handleAddFiles}
          onAddText={handleAddText}
          onSelectItem={setSelectedItemId}
          onReorderItems={(sourceId, targetId) => {
            setItems((currentItems) => reorderItems(currentItems, sourceId, targetId))
            setSeed((currentSeed) => currentSeed + 1)
          }}
          onMoveItem={(itemId, direction) => {
            setItems((currentItems) => moveItem(currentItems, itemId, direction))
            setSeed((currentSeed) => currentSeed + 1)
          }}
          onUpdateItem={handleUpdateItem}
          onRemoveItem={() => selectedItem && handleRemoveItem(selectedItem.id)}
          onChangeSettings={(updates) => setSettings((currentSettings) => ({ ...currentSettings, ...updates }))}
          onShuffle={() => setSeed(Math.floor(Math.random() * 1000000000))}
          onShuffleItems={() => {
            setItems((currentItems) => shuffleItems(currentItems))
            setSeed((currentSeed) => currentSeed + 1)
          }}
          onPreview={() => setIsPreview(true)}
          isSettingsOpen={true}
      />
      <CollageStage
        items={items}
        settings={settings}
        seed={seed}
        isMobile={isMobile}
        isPreview={false}
        onOpenGallery={(itemId, origin) => setGallerySelection({ id: itemId, origin })}
        onAspectRatioChange={handleAspectRatioChange}
      />
      {gallerySelection && galleryItems.length > 0 && <GalleryDialog items={galleryItems} activeItemId={gallerySelection.id} origin={gallerySelection.origin} onClose={() => setGallerySelection(undefined)} />}
    </div>
  )
}
