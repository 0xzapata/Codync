import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

// Every layer that covers the whole window sits above the ones under it, so a layer that is
// fading out (still mounted for its exit timer) must not keep taking their clicks. Menus are the
// topmost (`z-index: 300`) and fade at the same time as the sheet they were opened from, which is
// exactly how a click on a sheet's Close used to be swallowed while Escape still worked.
const sheet = readFileSync(fileURLToPath(new URL('../components/overlay.css', import.meta.url)), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')

/** Rules, as `[selectors, body]`, so a selector list with commas stays one entry. */
function rules(css: string): [string[], string][] {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, head, body]) => [
    head.split(',').map((s) => s.trim()).filter(Boolean),
    body,
  ])
}

/** Selectors of the rules that declare a full-window layer (`position: fixed; inset: 0`). */
function fullWindowLayers(css: string): string[] {
  return rules(css)
    .filter(([, body]) => /position:\s*fixed/.test(body) && /inset:\s*0/.test(body))
    .flatMap(([selectors]) => selectors.filter((s) => s.startsWith('.')))
}

/** Class selectors guarded by `pointer-events: none` while the layer is not `.shown`. */
function guardedWhileHidden(css: string): Set<string> {
  const guarded = new Set<string>()
  for (const [selectors, body] of rules(css)) {
    if (!/pointer-events:\s*none/.test(body)) continue
    for (const selector of selectors) {
      const match = /^(\.[\w-]+):not\(\.shown\)$/.exec(selector)
      if (match) guarded.add(match[1])
    }
  }
  return guarded
}

test('every full-window overlay layer stops taking clicks while it fades out', () => {
  const layers = fullWindowLayers(sheet)
  assert.deepEqual(
    [...layers].sort(),
    ['.anchored', '.dialog', '.modal-card'],
    'overlay.css should define exactly the menu, dialog and sheet layers as full-window',
  )
  const guarded = guardedWhileHidden(sheet)
  for (const layer of layers) {
    assert.ok(
      guarded.has(layer),
      `${layer} covers the window, so it needs a \`${layer}:not(.shown) { pointer-events: none }\` rule`,
    )
  }
})
