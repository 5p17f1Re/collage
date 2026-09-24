import { useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import type { CollageItem, CollageSettings, InteractionMode, LayoutMode, PanoramaSettings, PreviewImages, PreviewImageSlot, ScaleMode, TextCardStyle } from '../types'
import { AddIcon, ArrowDownIcon, ArrowUpIcon, DragIcon, PanelCollapseIcon, ShuffleIcon } from './icons'

interface SidebarProps {
  items: CollageItem[]
  selectedItem: CollageItem | undefined
  settings: CollageSettings
  layoutMode: LayoutMode
  onAddFiles: (files: File[]) => Promise<void>
  mediaPreparation: { current: number; total: number } | null
  onAddText: () => void
  onSelectItem: (itemId: string) => void
  onReorderItems: (sourceId: string, targetId: string) => void
  onMoveItem: (itemId: string, direction: -1 | 1) => void
  onUpdateItem: (itemId: string, updates: Partial<CollageItem>) => void
  onRemoveItem: (itemId: string) => void
  onChangeSettings: (updates: Partial<CollageSettings>) => void
  onChangePanoramaSettings: (updates: Partial<PanoramaSettings>) => void
  onLayoutModeChange: (mode: LayoutMode) => void
  onShuffleItems: () => void
  previewImages: PreviewImages
  onPreviewImageChange: (slot: PreviewImageSlot, file: File) => void
  onPreviewImageClear: (slot: PreviewImageSlot) => void
  onPreview: () => void
  isSettingsOpen: boolean
}

function RangeControl({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '%',
  valueLabel,
  hint,
  emphasizedTick,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  valueLabel?: string
  hint?: string
  emphasizedTick?: number
  onChange: (value: number) => void
}) {
  const rangeSteps = Math.floor((max - min) / step) + 1
  const tickCount = Math.min(5, rangeSteps)
  const tickPositions = Array.from({ length: tickCount }, (_, index) => tickCount === 1 ? 50 : (index / (tickCount - 1)) * 100)
  const emphasizedPosition = emphasizedTick === undefined ? undefined : ((emphasizedTick - min) / (max - min)) * 100
  if (emphasizedPosition !== undefined && !tickPositions.some((position) => Math.abs(position - emphasizedPosition) < 0.5)) {
    tickPositions.push(emphasizedPosition)
  }
  tickPositions.sort((left, right) => left - right)

  return (
    <label className="range-control">
      <span className="range-control__label"><span>{label}</span><output>{valueLabel ?? `${value}${suffix}`}</output></span>
      <span className="range-control__scale">
        <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
        <span className="range-control__ticks" aria-hidden="true">
          {tickPositions.map((position) => {
            const isEmphasized = emphasizedPosition !== undefined && Math.abs(position - emphasizedPosition) < 0.5
            return (
              <span key={position} className={`range-control__tick${isEmphasized ? ' range-control__tick--emphasized' : ''}`} style={{ left: `${position}%` }}>
                {isEmphasized && <span className="range-control__tick-label">{emphasizedTick}{suffix}</span>}
              </span>
            )
          })}
        </span>
      </span>
      {hint && <small className="range-control__hint">{hint}</small>}
    </label>
  )
}

function ScaleModeControl({ value, onChange }: { value: ScaleMode; onChange: (value: ScaleMode) => void }) {
  return (
    <div className="control-group">
      <span className="control-label">Масштаб по приоритету</span>
      <div className="segmented-control" aria-label="Масштаб по приоритету">
        <button className={value === 'priority' ? 'is-active' : ''} onClick={() => onChange('priority')}>От центра</button>
        <button className={value === 'uniform' ? 'is-active' : ''} onClick={() => onChange('uniform')}>Одинаковый</button>
      </div>
    </div>
  )
}

function InteractionModeControl({ value, onChange }: { value: InteractionMode; onChange: (value: InteractionMode) => void }) {
  return (
    <div className="control-group">
      <span className="control-label">Способ исследования</span>
      <div className="segmented-control" aria-label="Способ исследования">
        <button className={value === 'drag' ? 'is-active' : ''} onClick={() => onChange('drag')}>Перетаскивание</button>
        <button className={value === 'cursor' ? 'is-active' : ''} onClick={() => onChange('cursor')}>Только мышь</button>
      </div>
    </div>
  )
}

function HeroControl({ enabled, onChange }: { enabled: boolean; onChange: (enabled: boolean) => void }) {
  return (
    <div className="control-group">
      <span className="control-label">Главный элемент</span>
      <button className={`hero-toggle ${enabled ? 'is-active' : ''}`} type="button" onClick={() => onChange(!enabled)} aria-pressed={enabled}>
        <span>{enabled ? 'Включён' : 'Выключен'}</span>
        <small>Первый материал в центре</small>
      </button>
    </div>
  )
}

function LayoutModeControl({ value, onChange }: { value: LayoutMode; onChange: (value: LayoutMode) => void }) {
  return (
    <section className="mode-panel" aria-label="Режим раскладки">
      <div className="segmented-control" aria-label="Режим раскладки">
        <button className={value === 'panorama' ? 'is-active' : ''} onClick={() => onChange('panorama')}>Панорама</button>
        <button className={value === 'field' ? 'is-active' : ''} onClick={() => onChange('field')}>Свободное поле</button>
      </div>
    </section>
  )
}

function PreviewImagesControl({
  images,
  onChange,
  onClear,
}: {
  images: PreviewImages
  onChange: (slot: PreviewImageSlot, file: File) => void
  onClear: (slot: PreviewImageSlot) => void
}) {
  const slots: Array<{ slot: PreviewImageSlot; label: string }> = [
    { slot: 'top', label: 'Верхняя картинка' },
    { slot: 'bottom', label: 'Нижняя картинка' },
  ]

  return (
    <section className="preview-images" aria-label="Окружение чистого просмотра">
      <div className="section-heading"><span>Окружение превью</span></div>
      <p className="preview-images__description">Эти изображения появятся над и под панорамой только в «Чистом просмотре».</p>
      <div className="preview-images__controls">
        {slots.map(({ slot, label }) => {
          const image = images[slot]
          const inputId = `preview-image-${slot}`

          return (
            <div key={slot} className="preview-images__control">
              <label htmlFor={inputId}>{label}</label>
              <input
                id={inputId}
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) onChange(slot, file)
                  event.target.value = ''
                }}
              />
              {image && (
                <span className="preview-images__selection">
                  <span title={image.name}>{image.name}</span>
                  <button type="button" onClick={() => onClear(slot)} aria-label={`Убрать ${label.toLowerCase()}`}>Убрать</button>
                </span>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function ItemRow({
  item,
  index,
  isSelected,
  isFirst,
  isLast,
  isHero,
  onSelect,
  onMove,
  onReorder,
  onRemove,
}: {
  item: CollageItem
  index: number
  isSelected: boolean
  isFirst: boolean
  isLast: boolean
  isHero: boolean
  onSelect: () => void
  onMove: (direction: -1 | 1) => void
  onReorder: (sourceId: string, targetId: string) => void
  onRemove: () => void
}) {
  const [isDragging, setIsDragging] = useState(false)

  function handleDragStart(event: DragEvent<HTMLDivElement>) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', item.id)
    setIsDragging(true)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    const sourceId = event.dataTransfer.getData('text/plain')
    if (sourceId && sourceId !== item.id) onReorder(sourceId, item.id)
  }

  return (
    <div
      className={`item-row ${isSelected ? 'is-selected' : ''} ${isDragging ? 'is-dragging' : ''} ${isHero ? 'item-row--hero' : ''}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={() => setIsDragging(false)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <span className="item-row__index">{String(index + 1).padStart(2, '0')}</span>
      <button className="item-row__main" onClick={onSelect} aria-pressed={isSelected}>
        <span className={`item-row__thumb item-row__thumb--${item.type}`}>
          {item.type === 'image' && item.source && <img src={item.source} alt="" />}
          {item.type === 'video' && <span>▶</span>}
          {item.type === 'text' && <span>T</span>}
        </span>
        <span className="item-row__name-group">
          <span className="item-row__name">{item.type === 'text' ? item.text || 'Текстовый блок' : item.name}</span>
          {isHero && <span className="item-row__hero-label">Главный кадр</span>}
        </span>
      </button>
      <span className="item-row__actions">
        <button className="icon-button icon-button--tiny" onClick={() => onMove(-1)} disabled={isFirst} aria-label="Поднять в списке"><ArrowUpIcon /></button>
        <button className="icon-button icon-button--tiny" onClick={() => onMove(1)} disabled={isLast} aria-label="Опустить в списке"><ArrowDownIcon /></button>
        <button className="item-row__remove" type="button" onClick={(event) => { event.stopPropagation(); onRemove() }} aria-label={`Удалить ${item.name}`}>×</button>
        <DragIcon className="drag-icon" />
      </span>
    </div>
  )
}

function ItemInspector({
  item,
  onUpdate,
  onRemove,
  layoutMode,
  groupCount,
  isPanoramaHero,
}: {
  item: CollageItem | undefined
  onUpdate: (updates: Partial<CollageItem>) => void
  onRemove: () => void
  layoutMode: LayoutMode
  groupCount: number
  isPanoramaHero: boolean
}) {
  if (!item) return null

  const textStyles: Array<{ value: TextCardStyle; label: string }> = [
    { value: 'gramatika', label: 'Gramatika' },
    { value: 'wremena', label: 'Wremena' },
  ]

  return (
    <section className="item-inspector" aria-label="Параметры выбранного объекта">
      <div className="section-heading"><span>Выбранный объект</span><button className="text-button text-button--danger" onClick={onRemove}>Удалить</button></div>
      {item.type === 'text' ? (
        <>
          <label className="field-label">Текст<textarea value={item.text ?? ''} onChange={(event) => onUpdate({ text: event.target.value })} placeholder="Напишите текст" rows={4} /></label>
          <div className="control-group">
            <span className="control-label">Стиль текста</span>
            <div className="segmented-control text-style-control" aria-label="Стиль текста">
              {textStyles.map((style) => (
                <button
                  key={style.value}
                  className={(item.textStyle ?? 'gramatika') === style.value ? 'is-active' : ''}
                  aria-pressed={(item.textStyle ?? 'gramatika') === style.value}
                  onClick={() => onUpdate({ textStyle: style.value })}
                >{style.label}</button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <label className="field-label">Подпись<textarea value={item.caption} onChange={(event) => onUpdate({ caption: event.target.value })} placeholder="Добавьте подпись к изображению" rows={3} /></label>
      )}
      {layoutMode === 'panorama' && item.type !== 'text' && !isPanoramaHero && (
        <div className="control-group">
          <span className="control-label">Размер в панораме</span>
          <div className="segmented-control size-group-control" style={{ gridTemplateColumns: `repeat(${groupCount + 1}, 1fr)` }}>
            <button className={!item.sizeGroup ? 'is-active' : ''} onClick={() => onUpdate({ sizeGroup: undefined })}>Авто</button>
            {Array.from({ length: groupCount }, (_, index) => index + 1).map((group) => (
              <button key={group} className={item.sizeGroup === group ? 'is-active' : ''} onClick={() => onUpdate({ sizeGroup: group })}>{group}</button>
            ))}
          </div>
        </div>
      )}
      {layoutMode === 'panorama' && isPanoramaHero && item.type !== 'text' && <p className="item-inspector__hint">Размер главного кадра настраивается отдельно от остальных изображений ниже.</p>}
    </section>
  )
}

export function Sidebar({
  items,
  selectedItem,
  mediaPreparation,
  settings,
  layoutMode,
  onAddFiles,
  onAddText,
  onSelectItem,
  onReorderItems,
  onMoveItem,
  onUpdateItem,
  onRemoveItem,
  onChangeSettings,
  onChangePanoramaSettings,
  onLayoutModeChange,
  onShuffleItems,
  previewImages,
  onPreviewImageChange,
  onPreviewImageClear,
  onPreview,
  isSettingsOpen,
}: SidebarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isListOpen, setIsListOpen] = useState(false)

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (files.length) void onAddFiles(files)
    event.target.value = ''
  }

  return (
    <aside className="sidebar">
      <LayoutModeControl value={layoutMode} onChange={onLayoutModeChange} />
      {layoutMode === 'panorama' && <PreviewImagesControl images={previewImages} onChange={onPreviewImageChange} onClear={onPreviewImageClear} />}
      <section className="media-panel" aria-label="Медиа">
        <div className="section-heading">
          <span>Медиа</span>
          <span className="section-heading__actions">
            <button className="section-heading__shuffle" type="button" onClick={onShuffleItems}><ShuffleIcon />Перемешать</button>
            <button className="section-heading__toggle" type="button" onClick={() => setIsListOpen((current) => !current)} aria-expanded={isListOpen}>
              {isListOpen ? 'Свернуть' : `Показать (${items.length})`}
            </button>
          </span>
        </div>
        {isListOpen && <div className="media-list" role="list">
          {items.map((item, index) => (
            <ItemRow
              key={item.id}
              item={item}
              index={index}
              isSelected={selectedItem?.id === item.id}
              isFirst={index === 0}
              isLast={index === items.length - 1}
              isHero={layoutMode === 'panorama' ? index === 0 : settings.heroEnabled && index === 0 && item.type !== 'text'}
              onSelect={() => onSelectItem(item.id)}
              onMove={(direction) => onMoveItem(item.id, direction)}
              onReorder={onReorderItems}
              onRemove={() => onRemoveItem(item.id)}
            />
          ))}
        </div>}
        <div className="media-actions">
          <input ref={inputRef} className="visually-hidden" id="media-upload" type="file" accept="image/*,video/*" multiple disabled={mediaPreparation !== null} onChange={handleFileChange} />
          <button className="text-button" disabled={mediaPreparation !== null} onClick={() => inputRef.current?.click()}><AddIcon />Добавить медиа</button>
          <button className="text-button" onClick={onAddText}><AddIcon />Текстовый блок</button>
        </div>
        <p className="media-actions__note" role="status" aria-live="polite">
          {mediaPreparation
            ? `Готовлю превью: ${mediaPreparation.current} из ${mediaPreparation.total}…`
            : 'Фото загружаются без сжатия. Для видео создаётся постер первого кадра.'}
        </p>
      </section>
      <ItemInspector
        item={selectedItem}
        onUpdate={(updates) => {
          if (selectedItem) onUpdateItem(selectedItem.id, updates)
        }}
        onRemove={() => {
          if (selectedItem) onRemoveItem(selectedItem.id)
        }}
        layoutMode={layoutMode}
        groupCount={settings.panorama.groupCount}
        isPanoramaHero={layoutMode === 'panorama' && selectedItem?.id === items[0]?.id}
      />
      {isSettingsOpen && (
        <section id="composition-settings" className="settings-panel" aria-label="Настройки композиции">
          <div className="section-heading"><span>Композиция</span></div>
          {layoutMode === 'panorama' ? (
            <>
              <RangeControl label="Размерных групп" value={settings.panorama.groupCount} min={1} max={5} suffix="" onChange={(groupCount) => onChangePanoramaSettings({ groupCount })} />
              <RangeControl label="Контраст размеров" value={settings.panorama.groupContrast} min={0} max={150} valueLabel={`${settings.panorama.groupContrast}%`} hint="После 100% маленькие карточки уменьшаются дальше; крупные не растут." emphasizedTick={100} onChange={(groupContrast) => onChangePanoramaSettings({ groupContrast })} />
              {items[0]?.type !== 'text' && <RangeControl label="Размер главной картинки" value={settings.panorama.heroScale} min={50} max={150} valueLabel={`${settings.panorama.heroScale}%`} onChange={(heroScale) => onChangePanoramaSettings({ heroScale })} />}
              <RangeControl label="Ширина ленты" value={settings.panorama.spanPercent} min={50} max={150} step={5} valueLabel={`${settings.panorama.spanPercent}% · ${settings.panorama.spanPercent / 50} экр.`} onChange={(spanPercent) => onChangePanoramaSettings({ spanPercent })} />
            </>
          ) : (
            <>
              <RangeControl label="Плотность" value={settings.density} min={0} max={150} onChange={(density) => onChangeSettings({ density })} />
              <RangeControl label="Перекрытие по горизонтали" value={settings.horizontalOverlap} min={-50} max={150} onChange={(horizontalOverlap) => onChangeSettings({ horizontalOverlap })} />
              <RangeControl label="Перекрытие по вертикали" value={settings.verticalOverlap} min={-50} max={150} onChange={(verticalOverlap) => onChangeSettings({ verticalOverlap })} />
              <ScaleModeControl value={settings.scaleMode} onChange={(scaleMode) => onChangeSettings({ scaleMode })} />
              <InteractionModeControl value={settings.interactionMode} onChange={(interactionMode) => onChangeSettings({ interactionMode })} />
              <HeroControl enabled={settings.heroEnabled} onChange={(heroEnabled) => onChangeSettings({ heroEnabled })} />
              {settings.heroEnabled && <RangeControl label="Масштаб главного" value={settings.heroScale} min={40} max={120} onChange={(heroScale) => onChangeSettings({ heroScale })} />}
              <RangeControl label="Общий масштаб" value={settings.globalScale} min={60} max={160} onChange={(globalScale) => onChangeSettings({ globalScale })} />
              <RangeControl label="Увеличение при наведении" value={settings.hoverScale} min={100} max={180} onChange={(hoverScale) => onChangeSettings({ hoverScale })} />
            </>
          )}
          <label className="check-control"><input type="checkbox" checked={settings.showGrid} onChange={(event) => onChangeSettings({ showGrid: event.target.checked })} /><span>Точечная сетка</span></label>
          <label className="color-control"><span>Цвет точек</span><span><input type="color" value={settings.gridColor} onChange={(event) => onChangeSettings({ gridColor: event.target.value })} /><output>{settings.gridColor.toUpperCase()}</output></span></label>
          <label className="color-control"><span>Фон</span><span><input type="color" value={settings.background} onChange={(event) => onChangeSettings({ background: event.target.value })} /><output>{settings.background.toUpperCase()}</output></span></label>
        </section>
      )}
      <footer className="sidebar__footer">
        <button className="button button--dark" onClick={onPreview}><PanelCollapseIcon />Свернуть</button>
      </footer>
    </aside>
  )
}
