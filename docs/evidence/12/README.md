# PR #12 verification evidence

Code revision tested: `4fd0b7c` on `forky/desktop-thread-panel`, which is where the modal A/B
and the resizer walkthrough below were measured. The upstream v2.17.1 merge (`9fc004e`) left the
code those measurements cover untouched: `overlay.css` and `overlay-layers.test.ts` are
byte-identical at both revisions.
Baseline for the modal fix: `057d71f` (this branch before the fix).

## The reported modal bug: cause and fix

The cause is not the modal. It is the menu layer that covers it.

`.anchored` (the Codync menu) is `position: fixed; inset: 0; z-index: 300`, so it covers the
whole window, above sheets (`z-index: 100`) and dialogs (`200`). `usePresence` keeps a layer
mounted for its ~120 ms exit after it closes. `overlay.css` already gives
`.modal-card:not(.shown)` and `.dialog:not(.shown)` `pointer-events: none`, so a fading sheet or
dialog cannot take clicks; `.anchored:not(.shown)` was missing from that rule, so a fading menu
kept `pointer-events: auto` and swallowed the click meant for the layer underneath.

That also explains the reported asymmetry: Escape still worked (`useEscape` reads keydown, which
is never hit-tested), while pointer clicks on Close and on an enabled checkmark were discarded.

Fix: one line in `overlay.css`, adding `.anchored:not(.shown)` to the rule that already existed.
`src/renderer/lib/overlay-layers.test.ts` locks the invariant in: every full-window overlay layer
must opt out of clicks while hidden, so a new one cannot reintroduce this.

## How it was measured

`overlay-click-ab.json` is a single-variable A/B run in the running app (Electron, this revision),
driven over CDP with synthesized input (`Input.dispatchMouseEvent` — real hit testing, unlike
`elementFromPoint`, which cannot see `-webkit-app-region`):

- sheet open, dropdown opened, dropdown dismissed with a real click, then a second real click on
  Close **inside the menu's exit window**, once with the rule deleted from the live stylesheet and
  once with it present.
- rule removed (pre-fix): `pointer-events: auto`, the point over Close hits `div.anchored`, the
  click is discarded (`sheetClosedByClickInFadeWindow: false`).
- rule present (fixed): `pointer-events: none`, the same point hits the button, the click lands
  (`true`).

Before/after screenshots are **not attached**. This environment has no vision-capable model to
check captured frames for private conversations, and the repo requires inspecting any image before
attaching it. The DOM/JSON records above carry the same evidence without that risk.

## Walkthrough on the real app (Electron, this revision)

Driven over CDP with synthesized input and real clicks:

- Sidebar divider: drag 266 -> 356 px, then back to 266; `aria-valuenow` tracks the width.
- Modal Close: a real click dismisses the sheet at normal height and with a short viewport.
- Modal checkmark: enabled, reachable, and a real click reports the button as the click target.
  The save is a no-op on an unchanged form (verified: iggy's stored config kept the same values).
- Acceptance: Escape still dismisses the topmost modal; reopening stays clickable; a second Close
  click inside the fade window now lands.

## Thread panel resizer (the original feature)

Checked in the renderer on the same revision (the running app has no conversation with a reply
thread to open, so the seeded demo was used; it runs the same components and CSS):

- Drag: 420 -> 492 px. Keyboard: Home -> 280 (minimum), End -> 692 (maximum).
- An extreme drag clamps at the bound instead of passing it (692).
- Cancelling a drag discards the preview.
- Reduced motion is satisfied by construction: `@media (prefers-reduced-motion: reduce)` sets
  `--layout: 0s`, and `.side-panel.resizing { transition: none }` stops width animation while
  dragging. The live reduced-motion probe did not register a drag in a fresh headless tab, so this
  is established from the CSS rather than from a measurement.

## Files

- `overlay-click-ab.json`: the A/B measurement described above.
- `tests.txt`: `npm test` (156 passed, 0 failed) at `9fc004e`.
- `typecheck.txt`: `npm run typecheck` (exit 0).
- `thread-panel.png`: earlier capture from `cb9c834`; not re-verified here.
