# AVGVST Panorama 1.0.0

Готовый клиентский блок Панорамы и редактор. Код подключается один раз, на странице можно создать несколько независимых экземпляров. Материалы и настройки сохраняются в конфигурации каждого добавленного блока. Тестовых изображений в пакете нет.

## Проверить за пять минут

Требуется Node.js 22.12+ и npm **только для локального примера и сборки**. В папке пакета:

```sh
npm ci
npm run demo
```

Открыть http://127.0.0.1:5196. Внизу — два редактора A/B. Загрузить фото, добавить текст, сохранить черновик, обновить страницу, открыть предпросмотр и опубликовать. Вверху появится соответствующий публичный блок. У второго блока свои данные. Сборка уже находится в `dist/`; пересобрать её можно через `npm run build`.

Локальный сервер из `scripts/demo-server.mjs` сохраняет файлы и JSON в `.demo-data/`, слушает только 127.0.0.1. Это запускаемый пример адаптера без production-авторизации. На сайте подключаются его существующие авторизация, загрузка и сохранение. Папка `.demo-data/` в поставку не входит.

## Российский сайт: HTML / CSS / JS / jQuery / PHP

Разместить `dist/` среди статических ресурсов сайта, сохранив структуру папок. Подключить CSS и JS один раз:

```html
<link rel="stylesheet" href="/assets/panorama/styles.css">
<div id="collage-a"></div>
<div id="collage-b"></div>
<script src="/assets/panorama/panorama.js"></script>
<script>
  // dataA/dataB — опубликованные конфигурации, полученные из сайта.
  const a = AvgvstPanorama.mountPanorama(document.getElementById('collage-a'), dataA);
  const b = AvgvstPanorama.mountPanorama(document.getElementById('collage-b'), dataB);
  // a.update(newData); a.destroy();
</script>
```

React, ReactDOM и GSAP включены в этот JS. PHP-серверу Node.js не нужен. jQuery может управлять внешним контейнером, но не DOM внутри смонтированного компонента. При удалении блока вызвать `destroy()`.

Редактор в админке подключается тем же файлом:

```js
const editor = AvgvstPanorama.mountEditor(container, {
  blockId: 'block-42',
  initialData: savedDraft,
  adapter: siteAdapter,
  onChange(data) { /* при необходимости отметить блок изменённым в CMS */ }
});
// editor.getData(); editor.update(otherDraft); editor.destroy();
```

`update()` редактора загружает новую конфигурацию и сбрасывает его локальное состояние. Не вызывать его после каждого `onChange`. Сохранять конфигурацию в записи конкретного блока, а не в общем глобальном объекте сайта.

## Европа / Казахстан: Next.js / Express / TypeScript

Установить архив npm из поставки: `npm install ./avgvst-panorama-1.0.0.tgz`. В React-сборке React/ReactDOM являются внешними зависимостями, вторая копия React не включается. Поддерживаемые peer-версии указаны в `package.json`.

```tsx
'use client'
import { Panorama, PanoramaEditor } from '@avgvst/panorama'
import type { PanoramaData, EditorAdapter } from '@avgvst/panorama'
// CSS подключить один раз в app/layout.tsx или pages/_app.tsx:
import '@avgvst/panorama/styles.css'

export function CollectionBlock({ data }: { data: PanoramaData }) {
  return <Panorama data={data} />
}
export function AdminBlock({ id, draft, adapter }: {
  id: string; draft: PanoramaData; adapter: EditorAdapter
}) {
  return <PanoramaEditor key={id} blockId={id} initialData={draft} adapter={adapter} />
}
```

`initialData` применяется при создании редактора. Для явного переключения сохранённой версии сменить `key` вместе с версией записи. Обычные обновления React-родителя не стирают локальные правки.

Запускаемый пример: при работающем `npm run demo` перейти в `examples/next`, выполнить `npm ci`, затем `npm run dev`. Он откроется на http://127.0.0.1:5197 и проксирует тестовое API на 5196. Производственная сборка примера: `npm run build`. Пакет не требует именно той версии Next.js, которая закреплена в примере.

## Данные блока

```js
const data = AvgvstPanorama.createPanoramaData();
data.items = [
  { id: 'photo-1', type: 'image', name: 'Описание изображения', caption: '',
    source: '/media/photo-1.webp', placeholder: '/media/photo-1-small.webp', aspectRatio: 1.5 },
  { id: 'text-1', type: 'text', name: 'История', caption: '',
    text: 'Текст карточки', textStyle: 'wremena', aspectRatio: 1 }
];
```

Полная конфигурация: `schemaVersion: 1`, `items`, `seed`, `settings: { panorama, background, showGrid, gridColor }`. `createPanoramaData()` возвращает новые независимые значения по умолчанию. `parsePanoramaData(value)` проверяет и копирует данные. Типы — `dist/types/` и `src/config.ts`.

`items[0]` — главный материал. Изображения и видео имеют постоянный `source`; у видео есть `poster`, у подготовленных медиа — `placeholder`. Пропорции `aspectRatio` сохраняются после обработки. Стиль текстовой карточки хранится в её `textStyle` (`gramatika`/`wremena`). Внутри блока ID уникальны; разные блоки могут иметь одинаковые ID материалов.

Настройки в `settings.panorama`: `spanPercent` 50–250 с шагом 5 (100), `heroScale` 50–250 с шагом 5 (150), `cardGap` 0/4/8/12/16 (4), `groupCount` 1–7 (3), `groupContrast` 0–250 с шагом 5 (60), `inertia` 0–100 (40). Цвета — `#RRGGBB`. Пустой публичный блок не отображается. Ссылки на материалы могут быть HTTP(S), `/…`, `./…`, `../…`; `blob:` и `data:` не принимаются как сохранённые адреса.

При короткой ленте с текстовыми карточками упаковка дополнительно резервирует место под текст, если исходная раскладка оставляет большую пустую площадь. Выбранная ширина ленты при этом не меняется.

## Три операции адаптера сайта

Команда реализует объект `EditorAdapter` (тип экспортируется из пакета):

| Операция | Что нужно вернуть / сделать |
|---|---|
| `uploadMedia(prepared, { blockId, signal })` | Сохранить `prepared.file`, `prepared.placeholder`, для видео `prepared.poster`. Вернуть `{ source, placeholder, poster? }` с постоянными URL. |
| `saveDraft(blockId, data, { signal })` | Сохранить полный снимок данных в черновике этого блока. Публичные данные не менять. |
| `publish(blockId, data, { signal })` | Атомарно опубликовать именно переданный снимок. Не публиковать случайно более старый сохранённый черновик. |

Редактор считает действие успешным только после выполнения Promise. Ошибка показывается сотруднику; UI не сообщает об успешной публикации заранее. `signal` отменяется при удалении редактора. Пример HTTP-адаптера — `examples/html/adapter.js`; маршруты в нём демонстрационные. Физическое хранение, привязки страниц, права и защита загрузок остаются в системе сайта. Сервер должен проверять права, данные и файлы независимо от проверки в браузере.

## Сжатие всех изображений

Все фото проходят `prepareMedia()` **до вызова uploadMedia**, включая пакетное добавление и замену: WebP, большая сторона до 1600 px без увеличения, quality 0.88, учёт поворота и прозрачности. Заглушка — до 96 px, blur 1.4, quality 0.42. Поддерживаются JPEG, PNG, WebP и AVIF, которые декодирует браузер. SVG/GIF/HEIC нужно предварительно преобразовать; ошибка не маскируется успешной загрузкой.

Видео не перекодируется. Браузер создаёт WebP-постер до 640 px и заглушку до 96 px. Если формат не читается или кадр не получен за 10 секунд, загрузка сообщает ошибку. Для распространения используйте совместимые с целевыми браузерами MP4/WebM.

Альтернативная серверная обработка: `import { optimizeImage } from '@avgvst/panorama/media'`. Она использует Sharp и возвращает байты основного WebP, заглушки и размеры. Это вариант для серверных импортов в обход редактора; повторно пережимать уже подготовленные браузером файлы не нужно. Параметры одинаковые, но байты и размытие canvas/Sharp могут различаться.

## Проверки и состав

- `npm run build` — standalone, React entry, типы, CSS, шрифты.
- `npm test` — конфигурация, изоляция значений, обработка изображений Sharp.
- `npx playwright install chromium`, затем `npm run test:browser` — отдельный локальный сервер, пакетная загрузка и сценарии двух блоков. При установленном Chrome: `PANORAMA_BROWSER_CHANNEL=chrome npm run test:browser`.
- `npm run pack:handoff` — архив передачи и npm-пакет в `artifacts/`.

Результаты фактических проверок — `docs/QA.md`. Подробности композиции и стилей — `docs/SPECIFICATION.md`. Сторонние лицензии — `LICENSES.md` и `licenses/`.
