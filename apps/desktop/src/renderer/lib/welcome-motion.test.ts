import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

// `prefers-reduced-motion` zeroes the motion tokens in `theme.css`, so a transition or animation
// that hard-codes its own duration or curve ignores Reduce Motion entirely. The welcome screen is
// the first thing a new user sees and the only place this had drifted, so it is pinned here.
const source = readFileSync(fileURLToPath(new URL('../views/AccountWelcomeView.tsx', import.meta.url)), 'utf8')

/** `transition`/`animation` values, whatever the quote style. */
function motionValues(): string[] {
  return [...source.matchAll(/\b(?:transition|animation):\s*[`']([^`']*)[`']/g)].map(([, value]) => value)
}

test('the welcome screen takes its motion from the tokens so Reduce Motion zeroes it', () => {
  const values = motionValues()
  assert.ok(values.length >= 3, 'expected the welcome screen to declare its motion inline')

  for (const value of values) {
    assert.match(
      value,
      /var\(--(layout|fade|morph|hover|press|conversation-motion)\)/,
      `'${value}' hard-codes its timing; use a motion token so Reduce Motion applies`,
    )
  }
})

test('no hard-coded durations or curves are left on the welcome screen', () => {
  for (const value of motionValues()) {
    // Staggered delays are computed per item and are not a duration; ignore the interpolations.
    const withoutDelays = value.replace(/\$\{[^}]*\}/g, '')
    assert.doesNotMatch(
      withoutDelays,
      /cubic-bezier\(|\d*\.?\d+m?s\b/,
      `'${value}' should come from a token, not a literal duration or curve`,
    )
  }
})

test('the crew entrance animates a property the idle bob does not rewrite', () => {
  // The bob rewrites `transform` every animation frame, so the entrance scale cannot be a `scale`
  // transition inside it (that never fires) or a sibling `scale` property (which composes outside
  // `transform` and would scale the per-item offsets too). It scales on a nested element.
  assert.doesNotMatch(
    source,
    /transform: `[^`]*\$\{shown \? 1 : 0\.3\}/,
    'the entrance scale must not live inside the per-frame `transform`',
  )
  assert.doesNotMatch(
    source,
    /^\s*scale:/m,
    'a sibling `scale` composes outside `transform`, scaling the offsets; nest it instead',
  )
  assert.match(source, /scale:\s*shown \? '1' : '0\.3'/, 'the entrance should scale on a nested element')
})
