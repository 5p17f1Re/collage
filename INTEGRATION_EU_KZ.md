# Передача командам Европы и Казахстана

Стек: Next.js, Express.js, TypeScript. Готовый пакет и инструкция: [packages/panorama/README.md](packages/panorama/README.md).

1. Установить `avgvst-panorama-1.0.0.tgz`, один раз подключить `@avgvst/panorama/styles.css`.
2. На странице использовать `<Panorama data={published} />`, в клиентской части админки — `<PanoramaEditor blockId={id} initialData={draft} adapter={siteAdapter} />`.
3. Связать адаптер с загрузкой/хранением сайта, черновиком и публикацией. Настройки вида сохраняются вместе с материалами конкретного блока.

React/ReactDOM в React-сборку не включены, используются зависимости Next.js. Поставляются типы и запускаемый пример `examples/next/`. Сжатие всех фото, подготовка превью и независимые экземпляры реализованы. Production-права, хранение и связи с CMS подключает команда сайта. Полный сценарий запуска и API — в README пакета.
