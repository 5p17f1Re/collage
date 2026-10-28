import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const source = await readFile(fileURLToPath(new URL('../src/lib/layout.ts', import.meta.url)), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { generatePanoramaLayout } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

// The starter collage includes two fixed-width text cards. In a short strip,
// placing those late used to shrink every image and leave most of the stage empty.
const ratios = [
  1454 / 1938, 792 / 530, 1118 / 1200, 764 / 1200, 1212 / 1200,
  1762 / 1200, 1262 / 1200, 1364 / 1200, 1178 / 1200, 1226 / 1200,
  950 / 1200, 900 / 1200, 1528 / 1200, 1620 / 1200, 762 / 1200,
  2050 / 1200, 1424 / 1200, 1600 / 1200, 1902 / 1200, 952 / 1200,
  1014 / 1200,
  1050 / 1200, 554 / 1200, 554 / 1200, 848 / 1200, 2102 / 1200,
  1762 / 1200,
]
const items = [
  ...ratios.map((aspectRatio, index) => ({ id: `image-${index}`, type: 'image', aspectRatio })),
  { id: 'text-a', type: 'text', aspectRatio: 1 },
  { id: 'text-b', type: 'text', aspectRatio: 1 },
]
const textMetrics = { 'text-a': { width: 300, height: 72 }, 'text-b': { width: 300, height: 72 } }

function emptyFraction(layouts, world, stageHeight) {
  const cards = Object.values(layouts)
  const top = (stageHeight - Math.min(720, stageHeight)) / 2
  let empty = 0, sampled = 0
  for (let y = top + 8; y < top + Math.min(720, stageHeight) - 8; y += 16) {
    for (let x = 8; x < world.width - 8; x += 16) {
      empty += !cards.some(card => Math.abs(x - card.x) < card.width / 2 && Math.abs(y - card.y) < (card.height ?? 0) / 2)
      sampled++
    }
  }
  return empty / sampled
}

test('short strips with fixed text keep the starter media readable and placed', () => {
  assert.equal(items.length, 29)
  for (const [width, stageHeight] of [[390, 717], [626, 880]]) {
    for (const spanPercent of [50, 60, 75, 85]) {
      const settings = { panorama: { spanPercent, heroScale: 150, cardGap: 4, groupCount: 3, groupContrast: 60, inertia: 40 } }
      const { layouts, world } = generatePanoramaLayout(items, settings, 2648, width, textMetrics, stageHeight)
      assert.equal(Object.keys(layouts).length, items.length)
      assert.ok(emptyFraction(layouts, world, stageHeight) < 0.32, `${width}px / ${spanPercent}% left too much empty space`)
      const cards = Object.values(layouts)
      for (const card of cards) {
        assert.ok(card.x - card.width / 2 >= 0 && card.x + card.width / 2 <= world.width)
        assert.ok(card.y - (card.height ?? 0) / 2 >= (world.height - Math.min(720, world.height)) / 2)
        assert.ok(card.y + (card.height ?? 0) / 2 <= (world.height + Math.min(720, world.height)) / 2)
      }
      for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) {
        const a = cards[i], b = cards[j]
        const overlapX = Math.min(a.x + a.width / 2, b.x + b.width / 2) - Math.max(a.x - a.width / 2, b.x - b.width / 2)
        const overlapY = Math.min(a.y + (a.height ?? 0) / 2, b.y + (b.height ?? 0) / 2) - Math.max(a.y - (a.height ?? 0) / 2, b.y - (b.height ?? 0) / 2)
        assert.ok(overlapX <= 0 || overlapY <= 0, `${width}px / ${spanPercent}% overlaps cards`)
      }
      assert.equal(layouts['text-a'].width, 300)
      assert.equal(layouts['text-b'].width, 300)
    }
  }
})
