import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPanoramaData, parsePanoramaData, toInternalSettings } from './config'
import type { PanoramaData } from './config'
import { CollageStage } from './components/CollageStage'
import { GalleryDialog } from './components/GalleryDialog'
import { MediaSuspendedContext } from './components/VisibilityVideo'
import { useMediaQuery } from './hooks/useMediaQuery'
import { useNearViewport } from './hooks/useNearViewport'
export interface PanoramaProps { data?: PanoramaData; eager?: boolean; label?: string }
/** Public viewer. Empty data renders no public content. */
export function Panorama({ data = createPanoramaData(), eager = false, label = 'Коллаж' }: PanoramaProps) {
  const parsed = useMemo(() => parsePanoramaData(data), [data])
  return parsed.items.length ? <LoadedPanorama data={parsed} eager={eager} label={label} /> : null
}
function LoadedPanorama({ data, eager, label }: Required<PanoramaProps>) {
  const { ref, ready } = useNearViewport<HTMLDivElement>(eager)
  const isMobile = useMediaQuery('(max-width: 599px)')
  const [referenceWidth, setReferenceWidth] = useState(0)
  const [dragged, setDragged] = useState(false)
  const [selection, setSelection] = useState<{ id: string; origin: HTMLButtonElement }>()
  const [ratios, setRatios] = useState<Record<string, { source?: string; ratio: number }>>({})
  const items = useMemo(() => data.items.map(item => ratios[item.id]?.source === item.source && ratios[item.id]
    ? { ...item, aspectRatio: ratios[item.id].ratio } : item), [data.items, ratios])
  const settings = useMemo(() => toInternalSettings(data), [data])
  const close = useCallback(() => setSelection(undefined), [])
  useEffect(() => { setSelection(undefined) }, [data])
  const updateRatio = useCallback((id: string, ratio: number) => {
    if (!Number.isFinite(ratio) || ratio <= 0) return
    const source = data.items.find(item => item.id === id)?.source
    setRatios(current => current[id]?.source === source && Math.abs(current[id].ratio - ratio) < .001 ? current : { ...current, [id]: { source, ratio } })
  }, [data.items])
  return <div className="avgvst-panorama" aria-label={label}>
    <div ref={ref} className="panorama-frame" style={{ background: settings.background }}>
      {ready && <MediaSuspendedContext.Provider value={Boolean(selection)}>
        <CollageStage items={items} settings={settings} seed={data.seed} isMobile={isMobile} isPreview={false}
          isGalleryOpen={Boolean(selection)} layoutMode="panorama" panoramaReferenceWidth={referenceWidth}
          onPanoramaReferenceWidthChange={setReferenceWidth} hasPanoramaBeenDragged={dragged} onPanoramaDragStart={() => setDragged(true)}
          onOpenGallery={(id, origin) => setSelection({ id, origin })} onAspectRatioChange={updateRatio} />
      </MediaSuspendedContext.Provider>}
    </div>
    {selection && <GalleryDialog key={selection.id} items={items.filter(item => item.type !== 'text')} activeItemId={selection.id} origin={selection.origin} onClose={close} />}
  </div>
}
