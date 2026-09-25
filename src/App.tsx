import { useEffect, useMemo, useRef, useState } from 'react'
import { CollageStage } from './components/CollageStage'
import { GalleryDialog } from './components/GalleryDialog'
import { CloseIcon } from './components/icons'
import { Sidebar } from './components/Sidebar'
import { useMediaQuery } from './hooks/useMediaQuery'
import { createVideoPreviews } from './lib/mediaPlaceholders'
import { SAMPLE_ITEMS } from './sampleItems'
import type { CollageItem, CollageSettings, LayoutMode, PanoramaSettings, PreviewImageSlot } from './types'

const INITIAL_SETTINGS: CollageSettings = {
  density: 56,
  horizontalOverlap: 34,
  verticalOverlap: 34,
  scaleMode: 'priority',
  globalScale: 100,
  hoverScale: 124,
  showGrid: false,
  gridColor: '#4a4a4a',
  interactionMode: 'drag',
  heroEnabled: false,
  heroScale: 100,
  background: '#ffffff',
  panorama: {
    groupCount: 3,
    spanPercent: 100,
    cardGap: 4,
    groupContrast: 60,
    heroScale: 150,
    inertia: 40,
  },
  previewImages: {},
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

function shuffleItems(items: CollageItem[], preserveFirst = false) {
  if (items.length < 2) return items

  // In Panorama the first item is the selected anchor. The free-field flow
  // keeps its existing behaviour and may still reshuffle every item.
  const hero = preserveFirst ? items[0] : undefined
  const shuffledItems = preserveFirst ? items.slice(1) : [...items]
  for (let index = shuffledItems.length - 1; index > 0; index -= 1) {
    const targetIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffledItems[index], shuffledItems[targetIndex]] = [shuffledItems[targetIndex], shuffledItems[index]]
  }
  return hero ? [hero, ...shuffledItems] : shuffledItems
}

export function App() {
  const [items, setItems] = useState<CollageItem[]>(() => SAMPLE_ITEMS.map((item) => ({ ...item })))
  const [settings, setSettings] = useState<CollageSettings>(INITIAL_SETTINGS)
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() => window.location.hash === '#field' ? 'field' : 'panorama')
  const [selectedItemId, setSelectedItemId] = useState<string | undefined>(SAMPLE_ITEMS[0]?.id)
  const [seed, setSeed] = useState(2648)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isPreview, setIsPreview] = useState(false)
  const [panoramaReferenceWidth, setPanoramaReferenceWidth] = useState(0)
  const [gallerySelection, setGallerySelection] = useState<{ id: string; origin: HTMLButtonElement }>()
  const [mediaPreparation, setMediaPreparation] = useState<{ current: number; total: number } | null>(null)
  const objectUrlsRef = useRef(new Set<string>())
  const isMobile = useMediaQuery('(max-width: 599px)')

  const selectedItem = useMemo(() => items.find((item) => item.id === selectedItemId), [items, selectedItemId])
  const galleryItems = useMemo(() => items.filter((item) => item.type !== 'text' && item.source), [items])

  useEffect(() => () => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  useEffect(() => {
    function syncModeFromHash() {
      setLayoutMode(window.location.hash === '#field' ? 'field' : 'panorama')
    }

    window.addEventListener('hashchange', syncModeFromHash)
    return () => window.removeEventListener('hashchange', syncModeFromHash)
  }, [])

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && isPreview) setIsPreview(false)
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isPreview])

  async function handleAddFiles(files: File[]) {
    if (!files.length) return
    const newItems: CollageItem[] = []
    setMediaPreparation({ current: 0, total: files.length })

    try {
      for (const [index, file] of files.entries()) {
        setMediaPreparation({ current: index + 1, total: files.length })
        const mediaType = getMediaType(file)
        const previews: { poster?: string; placeholder?: string } = mediaType === 'video'
          ? await createVideoPreviews(file)
          : {}
        const source = URL.createObjectURL(file)
        objectUrlsRef.current.add(source)

        newItems.push({
          id: createItemId('local'),
          name: file.name.replace(/\.[^/.]+$/, ''),
          type: mediaType,
          source,
          placeholder: previews.placeholder,
          poster: 'poster' in previews ? previews.poster : undefined,
          caption: '',
          aspectRatio: 1,
          isObjectUrl: true,
        })
      }

      setItems((currentItems) => {
        const hasOnlyStarterItems = currentItems.every((item) => item.id.startsWith('sample-'))
        return hasOnlyStarterItems ? newItems : [...currentItems, ...newItems]
      })
      setSelectedItemId(newItems[0]?.id)
      setSeed((currentSeed) => currentSeed + 1)
    } finally {
      setMediaPreparation(null)
    }
  }

  function handleAddText() {
    const textItem: CollageItem = {
      id: createItemId('text'),
      name: 'Текстовый блок',
      type: 'text',
      caption: '',
      text: DEFAULT_TEXT,
      textStyle: 'gramatika',
      aspectRatio: 1,
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

  function handleLayoutModeChange(mode: LayoutMode) {
    setLayoutMode(mode)
    const nextHash = `#${mode}`
    if (window.location.hash !== nextHash) window.location.hash = mode
  }

  function handlePanoramaSettingsChange(updates: Partial<PanoramaSettings>) {
    const nextGroupCount = updates.groupCount
    setSettings((currentSettings) => ({
      ...currentSettings,
      panorama: { ...currentSettings.panorama, ...updates },
    }))
    if (nextGroupCount !== undefined) {
      setItems((currentItems) => currentItems.map((item) => item.sizeGroup
        ? { ...item, sizeGroup: Math.min(item.sizeGroup, nextGroupCount) }
        : item))
    }
  }

  function handlePreviewImageChange(slot: PreviewImageSlot, file: File) {
    const previousSource = settings.previewImages[slot]?.source
    if (previousSource) {
      URL.revokeObjectURL(previousSource)
      objectUrlsRef.current.delete(previousSource)
    }

    const source = URL.createObjectURL(file)
    objectUrlsRef.current.add(source)
    setSettings((currentSettings) => ({
      ...currentSettings,
      previewImages: {
        ...currentSettings.previewImages,
        [slot]: { source, name: file.name },
      },
    }))
  }

  function handlePreviewImageClear(slot: PreviewImageSlot) {
    const previousSource = settings.previewImages[slot]?.source
    if (previousSource) {
      URL.revokeObjectURL(previousSource)
      objectUrlsRef.current.delete(previousSource)
    }

    setSettings((currentSettings) => {
      const { [slot]: _removedImage, ...previewImages } = currentSettings.previewImages
      return { ...currentSettings, previewImages }
    })
  }

  if (isPreview) {
    return (
      <>
        <div className={`clean-preview ${layoutMode === 'panorama' ? 'clean-preview--panorama' : ''}`}>
          {layoutMode === 'panorama' && settings.previewImages.top && (
            <img className="clean-preview__surround clean-preview__surround--top" src={settings.previewImages.top.source} alt={settings.previewImages.top.name} draggable={false} />
          )}
          <CollageStage items={items} settings={settings} seed={seed} isMobile={isMobile} isPreview isGalleryOpen={Boolean(gallerySelection)} layoutMode={layoutMode} panoramaReferenceWidth={panoramaReferenceWidth} onPanoramaReferenceWidthChange={setPanoramaReferenceWidth} onOpenGallery={(itemId, origin) => setGallerySelection({ id: itemId, origin })} onAspectRatioChange={handleAspectRatioChange} />
          {layoutMode === 'panorama' && settings.previewImages.bottom && (
            <img className="clean-preview__surround clean-preview__surround--bottom" src={settings.previewImages.bottom.source} alt={settings.previewImages.bottom.name} draggable={false} />
          )}
        </div>
        <button className="preview-exit" onClick={() => setIsPreview(false)} aria-label="Вернуться к лаборатории"><CloseIcon /></button>
        {gallerySelection && galleryItems.length > 0 && <GalleryDialog items={galleryItems} activeItemId={gallerySelection.id} origin={gallerySelection.origin} onClose={() => setGallerySelection(undefined)} />}
      </>
    )
  }

  return (
    <div className={`app-shell ${layoutMode === 'panorama' ? 'app-shell--panorama' : ''} ${isSidebarOpen ? '' : 'app-shell--settings-collapsed'}`}>
      <Sidebar
        items={items}
        selectedItem={selectedItem}
        mediaPreparation={mediaPreparation}
          settings={settings}
          layoutMode={layoutMode}
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
          onRemoveItem={handleRemoveItem}
          onChangeSettings={(updates) => setSettings((currentSettings) => ({ ...currentSettings, ...updates }))}
          onChangePanoramaSettings={handlePanoramaSettingsChange}
          onLayoutModeChange={handleLayoutModeChange}
          onShuffleItems={() => {
            setItems((currentItems) => shuffleItems(currentItems, layoutMode === 'panorama'))
            setSeed((currentSeed) => currentSeed + 1)
          }}
          previewImages={settings.previewImages}
          onPreviewImageChange={handlePreviewImageChange}
          onPreviewImageClear={handlePreviewImageClear}
          onPreview={() => setIsPreview(true)}
          isSettingsOpen={isSettingsOpen}
          onToggleSettings={() => setIsSettingsOpen((isOpen) => !isOpen)}
      />
      <CollageStage
        items={items}
        settings={settings}
        seed={seed}
        isMobile={isMobile}
        isPreview={false}
        isGalleryOpen={Boolean(gallerySelection)}
        layoutMode={layoutMode}
        panoramaReferenceWidth={panoramaReferenceWidth}
        onPanoramaReferenceWidthChange={setPanoramaReferenceWidth}
        onOpenGallery={(itemId, origin) => setGallerySelection({ id: itemId, origin })}
        onAspectRatioChange={handleAspectRatioChange}
      />
      <button
        className={`settings-toggle ${isSidebarOpen ? 'settings-toggle--open' : ''}`}
        type="button"
        aria-expanded={isSidebarOpen}
        aria-controls="settings-sidebar"
        onClick={() => setIsSidebarOpen((isOpen) => !isOpen)}
      >
        {isSidebarOpen ? 'Скрыть настройки' : 'Настройки'}
      </button>
      {gallerySelection && galleryItems.length > 0 && <GalleryDialog items={galleryItems} activeItemId={gallerySelection.id} origin={gallerySelection.origin} onClose={() => setGallerySelection(undefined)} />}
    </div>
  )
}
