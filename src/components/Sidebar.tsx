import { useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import type { CollageItem, CollageSettings, InteractionMode, ScaleMode, TextCardSize } from '../types'
import { AddIcon, ArrowDownIcon, ArrowUpIcon, DragIcon, EyeIcon, ShuffleIcon } from './icons'

interface SidebarProps {
  items: CollageItem[]
  selectedItem: CollageItem | undefined
  settings: CollageSettings
  onAddFiles: (files: File[]) => void
  onAddText: () => void
  onSelectItem: (itemId: string) => void
  onReorderItems: (sourceId: string, targetId: string) => void
  onMoveItem: (itemId: string, direction: -1 | 1) => void
  onUpdateItem: (itemId: string, updates: Partial<CollageItem>) => void
  onRemoveItem: (itemId: string) => void
  onChangeSettings: (updates: Partial<CollageSettings>) => void
  onShuffle: () => void
  onShuffleItems: () => void
  onPreview: () => void
  isSettingsOpen: boolean
}

function RangeControl({
  label,
  value,
  min,
  max,
  suffix = '%',
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  suffix?: string
  onChange: (value: number) => void
}) {
  return (
    <label className="range-control">
      <span className="range-control__label"><span>{label}</span><output>{value}{suffix}</output></span>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
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
          {isHero && <span className="item-row__hero-label">Главный</span>}
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
}: {
  item: CollageItem | undefined
  onUpdate: (updates: Partial<CollageItem>) => void
  onRemove: () => void
}) {
  if (!item) return null

  const textCardSizes: Array<{ value: TextCardSize; label: string }> = [
    { value: 'small', label: 'S' },
    { value: 'medium', label: 'M' },
    { value: 'large', label: 'L' },
  ]

  return (
    <section className="item-inspector" aria-label="Параметры выбранного объекта">
      <div className="section-heading"><span>Выбранный объект</span><button className="text-button text-button--danger" onClick={onRemove}>Удалить</button></div>
      {item.type === 'text' ? (
        <>
          <label className="field-label">Текст<textarea value={item.text ?? ''} onChange={(event) => onUpdate({ text: event.target.value })} placeholder="Напишите текст" rows={4} /></label>
          <div className="control-group">
            <span className="control-label">Размер блока</span>
            <div className="segmented-control segmented-control--three">
              {textCardSizes.map((size) => <button key={size.value} className={item.textSize === size.value ? 'is-active' : ''} onClick={() => onUpdate({ textSize: size.value })}>{size.label}</button>)}
            </div>
          </div>
        </>
      ) : (
        <label className="field-label">Подпись<textarea value={item.caption} onChange={(event) => onUpdate({ caption: event.target.value })} placeholder="Добавьте подпись к изображению" rows={3} /></label>
      )}
    </section>
  )
}

export function Sidebar({
  items,
  selectedItem,
  settings,
  onAddFiles,
  onAddText,
  onSelectItem,
  onReorderItems,
  onMoveItem,
  onUpdateItem,
  onRemoveItem,
  onChangeSettings,
  onShuffle,
  onShuffleItems,
  onPreview,
  isSettingsOpen,
}: SidebarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isListOpen, setIsListOpen] = useState(true)

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (files.length) onAddFiles(files)
    event.target.value = ''
  }

  return (
    <aside className="sidebar">
      <header className="sidebar__header"><span>COLLAGE LAB</span><span className="sidebar__count">{items.length}</span></header>
      <section className="media-panel" aria-label="Порядок композиции">
        <div className="section-heading">
          <span>Порядок</span>
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
              isHero={settings.heroEnabled && index === 0 && item.type !== 'text'}
              onSelect={() => onSelectItem(item.id)}
              onMove={(direction) => onMoveItem(item.id, direction)}
              onReorder={onReorderItems}
              onRemove={() => onRemoveItem(item.id)}
            />
          ))}
        </div>}
        <div className="media-actions">
          <input ref={inputRef} className="visually-hidden" id="media-upload" type="file" accept="image/*,video/*" multiple onChange={handleFileChange} />
          <button className="text-button" onClick={() => inputRef.current?.click()}><AddIcon />Добавить медиа</button>
          <button className="text-button" onClick={onAddText}><AddIcon />Текстовый блок</button>
        </div>
      </section>
      <ItemInspector
        item={selectedItem}
        onUpdate={(updates) => {
          if (selectedItem) onUpdateItem(selectedItem.id, updates)
        }}
        onRemove={() => {
          if (selectedItem) onRemoveItem(selectedItem.id)
        }}
      />
      {isSettingsOpen && (
        <section id="composition-settings" className="settings-panel" aria-label="Настройки композиции">
          <div className="section-heading"><span>Композиция</span></div>
          <RangeControl label="Плотность" value={settings.density} min={0} max={150} onChange={(density) => onChangeSettings({ density })} />
          <RangeControl label="Перекрытие по горизонтали" value={settings.horizontalOverlap} min={-50} max={150} onChange={(horizontalOverlap) => onChangeSettings({ horizontalOverlap })} />
          <RangeControl label="Перекрытие по вертикали" value={settings.verticalOverlap} min={-50} max={150} onChange={(verticalOverlap) => onChangeSettings({ verticalOverlap })} />
          <ScaleModeControl value={settings.scaleMode} onChange={(scaleMode) => onChangeSettings({ scaleMode })} />
          <InteractionModeControl value={settings.interactionMode} onChange={(interactionMode) => onChangeSettings({ interactionMode })} />
          <HeroControl enabled={settings.heroEnabled} onChange={(heroEnabled) => onChangeSettings({ heroEnabled })} />
          <RangeControl label="Общий масштаб" value={settings.globalScale} min={60} max={160} onChange={(globalScale) => onChangeSettings({ globalScale })} />
          <RangeControl label="Увеличение при наведении" value={settings.hoverScale} min={100} max={180} onChange={(hoverScale) => onChangeSettings({ hoverScale })} />
          <label className="check-control"><input type="checkbox" checked={settings.showGrid} onChange={(event) => onChangeSettings({ showGrid: event.target.checked })} /><span>Точечная сетка</span></label>
          <label className="color-control"><span>Цвет точек</span><span><input type="color" value={settings.gridColor} onChange={(event) => onChangeSettings({ gridColor: event.target.value })} /><output>{settings.gridColor.toUpperCase()}</output></span></label>
          <label className="color-control"><span>Фон</span><span><input type="color" value={settings.background} onChange={(event) => onChangeSettings({ background: event.target.value })} /><output>{settings.background.toUpperCase()}</output></span></label>
        </section>
      )}
      <footer className="sidebar__footer">
        <button className="button button--quiet" onClick={onShuffle}><ShuffleIcon />Перемешать</button>
        <button className="button button--dark" onClick={onPreview}><EyeIcon />Чистый просмотр</button>
      </footer>
    </aside>
  )
}
