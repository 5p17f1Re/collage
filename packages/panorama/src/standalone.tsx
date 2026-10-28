import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { Panorama } from './Panorama'
import { PanoramaEditor } from './Editor'
import type { PanoramaEditorProps } from './Editor'
import { createPanoramaData, parsePanoramaData } from './config'
import type { PanoramaData } from './config'
export { createPanoramaData, parsePanoramaData, DEFAULT_PANORAMA } from './config'
export { prepareMedia } from './media'
const roots = new WeakMap<Element, Root>()
function attach(container: Element) {
  if (roots.has(container)) throw new Error('В контейнере уже есть Панорама; используйте update или destroy')
  const root = createRoot(container); roots.set(container, root); return root
}
export function mountPanorama(container: Element, initialData: PanoramaData = createPanoramaData()) {
  let data = parsePanoramaData(initialData), destroyed = false
  const root = attach(container)
  root.render(<Panorama data={data} />)
  return {
    update(next: PanoramaData) { if (destroyed) throw new Error('Экземпляр удалён'); data = parsePanoramaData(next); root.render(<Panorama data={data} />) },
    destroy() { if (!destroyed) { destroyed = true; root.unmount(); roots.delete(container) } },
  }
}
export function mountEditor(container: Element, props: PanoramaEditorProps) {
  let data = parsePanoramaData(props.initialData ?? createPanoramaData()), destroyed = false, revision = 0
  const root = attach(container)
  const render = () => root.render(<PanoramaEditor key={revision} {...props} initialData={data} onChange={next => { data=next; props.onChange?.(next) }} />)
  render()
  return {
    getData: () => parsePanoramaData(data),
    update(next: PanoramaData) { if (destroyed) throw new Error('Экземпляр удалён'); data=parsePanoramaData(next); revision++; render() },
    destroy() { if (!destroyed) { destroyed=true; root.unmount(); roots.delete(container) } },
  }
}
