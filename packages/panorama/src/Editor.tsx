import { useEffect, useRef, useState } from 'react'
import { createPanoramaData, parsePanoramaData } from './config'
import type { PanoramaData, CollageItem, PanoramaSettings } from './config'
import { prepareMedia } from './media'
import type { PreparedMedia, UploadedMedia, UploadContext } from './media'
import { Panorama } from './Panorama'
export interface EditorAdapter {
  uploadMedia(media: PreparedMedia, context: UploadContext): Promise<UploadedMedia>
  saveDraft(blockId: string, data: PanoramaData, context: { signal: AbortSignal }): Promise<void>
  /** Must publish this exact snapshot atomically, not a previously saved draft. */
  publish(blockId: string, data: PanoramaData, context: { signal: AbortSignal }): Promise<void>
}
export interface PanoramaEditorProps {
  blockId: string
  initialData?: PanoramaData
  adapter: EditorAdapter
  onChange?: (data: PanoramaData) => void
}
const ranges: Array<[keyof PanoramaSettings, string, number, number, number]> = [
  ['spanPercent','Ширина ленты',50,250,5], ['heroScale','Размер главного кадра',50,250,5], ['cardGap','Отступы',0,16,4],
  ['groupCount','Размерные группы',1,7,1], ['groupContrast','Контраст размеров',0,250,5], ['inertia','Энергия движения',0,100,1],
]
export function PanoramaEditor({ blockId, initialData, adapter, onChange }: PanoramaEditorProps) {
  const [data, setData] = useState(() => parsePanoramaData(initialData ?? createPanoramaData()))
  const dataRef = useRef(data)
  const abortRef = useRef<AbortController | null>(null)
  const alive = useRef(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(false)
  useEffect(() => { alive.current = true; return () => { alive.current = false; abortRef.current?.abort() } }, [])
  function change(next: PanoramaData) {
    const validated = parsePanoramaData(next)
    dataRef.current = validated; setData(validated); setMessage('Есть несохранённые изменения'); onChange?.(validated)
  }
  function itemChange(id: string, patch: Partial<CollageItem>) {
    change({ ...dataRef.current, items: dataRef.current.items.map(item => item.id === id ? { ...item, ...patch } : item) })
  }
  async function run(action: (signal: AbortSignal) => Promise<string>) {
    if (abortRef.current) return
    const controller = new AbortController(); abortRef.current = controller; setBusy(true); setError(''); setMessage('')
    try { const result = await action(controller.signal); if (alive.current) setMessage(result) }
    catch (failure) { if (alive.current && !controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Не удалось выполнить действие') }
    finally { abortRef.current = null; if (alive.current) setBusy(false) }
  }
  async function upload(files: File[], replaceId?: string) {
    await run(async signal => {
      const successes: CollageItem[] = [], failures: string[] = []
      for (const file of files) {
        try {
          const prepared = await prepareMedia(file, signal)
          const urls = await adapter.uploadMedia(prepared, { blockId, signal })
          signal.throwIfAborted()
          if (!urls.placeholder || (prepared.type === 'video' && !urls.poster)) throw new Error('Адаптер не вернул адрес заглушки/постера')
          const old = replaceId ? dataRef.current.items.find(item => item.id === replaceId) : undefined
          const item: CollageItem = { id: old?.id ?? crypto.randomUUID(), type: prepared.type, name: old?.name ?? prepared.name,
            caption: old?.caption ?? '', aspectRatio: prepared.aspectRatio, sizeGroup: old?.sizeGroup, ...urls }
          parsePanoramaData({ ...dataRef.current, items: [item] })
          successes.push(item)
        } catch (failure) {
          signal.throwIfAborted()
          failures.push(`${file.name}: ${failure instanceof Error ? failure.message : 'ошибка загрузки'}`)
        }
      }
      if (successes.length && alive.current) {
        const current = dataRef.current
        change({ ...current, seed: (current.seed + 1) % 2147483647,
          items: replaceId ? current.items.map(item => item.id === replaceId ? successes[0] : item) : [...current.items, ...successes] })
      }
      if (failures.length) throw new Error(`Добавлено: ${successes.length}. ${failures.join('; ')}`)
      return `Подготовлено и загружено: ${successes.length}. Сохраните черновик.`
    })
  }
  function move(index: number, offset: number) {
    const items = [...data.items]; const target = index + offset
    if (target < 0 || target >= items.length) return
    ;[items[index], items[target]] = [items[target], items[index]]
    change({ ...data, items })
  }
  return <div className="avgvst-panorama"><section className="panorama-editor" aria-label={`Редактор коллажа ${blockId}`}>
    <div className="editor-actions">
      <button type="button" disabled={busy} onClick={() => run(async signal => { await adapter.saveDraft(blockId, parsePanoramaData(dataRef.current), { signal }); return 'Черновик сохранён' })}>Сохранить черновик</button>
      <button type="button" disabled={busy} onClick={() => setPreview(value => !value)}>{preview ? 'Закрыть предпросмотр' : 'Предпросмотр'}</button>
      <button type="button" disabled={busy} onClick={() => run(async signal => { await adapter.publish(blockId, parsePanoramaData(dataRef.current), { signal }); return 'Опубликовано' })}>Опубликовать</button>
    </div>
    {busy && <p role="status">Обработка…</p>}{message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
    {preview && <div className="editor-preview"><Panorama data={data} eager /></div>}
    <fieldset disabled={busy}>
      <legend>Материалы</legend>
      <label>Добавить фото или видео<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm,video/quicktime,video/x-m4v" onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ''; if (files.length) void upload(files) }} /></label>
      <button type="button" onClick={() => change({ ...data, items: [...data.items, { id: crypto.randomUUID(), type: 'text', name: 'Текст', caption: '', text: '', textStyle: 'gramatika', aspectRatio: 1 }] })}>Добавить текст</button>
      <button type="button" onClick={() => change({ ...data, seed: (data.seed + 1) % 2147483647 })}>Перемешать композицию</button>
      {!data.items.length && <p>Добавьте материалы. Первый станет главным.</p>}
      <ol className="editor-items">{data.items.map((item, index) => <li key={item.id} data-item-id={item.id}>
        <div className="editor-item-heading">{item.type !== 'text' && <img src={item.poster ?? item.placeholder ?? item.source} alt="" loading="lazy" />}
          <strong>{index === 0 ? 'Главный · ' : ''}{item.name || item.type}</strong>
          <button type="button" disabled={index === 0} aria-label={`Поднять ${item.name}`} onClick={() => move(index,-1)}>↑</button>
          <button type="button" disabled={index === data.items.length - 1} aria-label={`Опустить ${item.name}`} onClick={() => move(index,1)}>↓</button>
          <button type="button" onClick={() => change({ ...data, items: data.items.filter(value => value.id !== item.id) })}>Удалить</button>
        </div>
        <label>Название / описание изображения<input value={item.name} onChange={event => itemChange(item.id,{name:event.target.value})} /></label>
        {item.type === 'text' ? <>
          <label>Текст<textarea value={item.text ?? ''} onChange={event => itemChange(item.id,{text:event.target.value})} /></label>
          <label>Стиль текста<select value={item.textStyle} onChange={event => itemChange(item.id,{textStyle:event.target.value as 'gramatika'|'wremena'})}><option value="gramatika">Gramatika</option><option value="wremena">Wremena</option></select></label>
        </> : <><label>Подпись<input value={item.caption} onChange={event => itemChange(item.id,{caption:event.target.value})} /></label>
          <label>Заменить файл<input type="file" accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm,video/quicktime,video/x-m4v" onChange={event => { const file = event.target.files?.[0]; event.target.value=''; if(file) void upload([file],item.id) }} /></label></>}
        <label>Размерная группа<select value={item.sizeGroup ?? ''} onChange={event => itemChange(item.id,{sizeGroup:event.target.value ? Number(event.target.value):undefined})}>
          <option value="">Авто</option>{Array.from({length:data.settings.panorama.groupCount},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}
        </select></label>
      </li>)}</ol>
    </fieldset>
    <fieldset disabled={busy}><legend>Вид этого блока</legend>
      {ranges.map(([key,label,min,max,step]) => <label key={key}>{label}: {data.settings.panorama[key]}<input type="range" min={min} max={max} step={step} value={data.settings.panorama[key]} onChange={event => {
        const value=Number(event.target.value)
        change({ ...data, items:key==='groupCount'?data.items.map(item=>({...item,sizeGroup:item.sizeGroup?Math.min(item.sizeGroup,value):undefined})):data.items,
          settings:{...data.settings,panorama:{...data.settings.panorama,[key]:value}} })
      }} /></label>)}
      <label>Фон<input type="color" value={data.settings.background} onChange={event=>change({...data,settings:{...data.settings,background:event.target.value}})} /></label>
      <label><input type="checkbox" checked={data.settings.showGrid} onChange={event=>change({...data,settings:{...data.settings,showGrid:event.target.checked}})} />Сетка</label>
      <label>Цвет сетки<input type="color" value={data.settings.gridColor} onChange={event=>change({...data,settings:{...data.settings,gridColor:event.target.value}})} /></label>
    </fieldset>
  </section></div>
}
