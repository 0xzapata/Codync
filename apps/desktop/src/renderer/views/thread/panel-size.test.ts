import assert from 'node:assert/strict'
import { test } from 'node:test'
import { threadPanelSize } from './panel-size.ts'

test('a new reply panel keeps the existing responsive default', () => {
  assert.equal(threadPanelSize(null, 680).width, 306)
  assert.equal(threadPanelSize(null, 1200).width, 420)
})

test('a saved width fits both conversations and returns when the window grows', () => {
  const preferred = 600
  assert.deepEqual(threadPanelSize(preferred, 680), { min: 280, max: 359, width: 359 })
  assert.equal(threadPanelSize(preferred, 1200).width, preferred)
  assert.equal(threadPanelSize(-200, 1200).width, 280)
  assert.equal(threadPanelSize(2000, 1200).width, 879)
})

test('invalid stored widths use the default instead of breaking the layout', () => {
  for (const value of [undefined, '600', {}, NaN, Infinity, -Infinity]) {
    assert.equal(threadPanelSize(value, 1200).width, 420)
  }
})
