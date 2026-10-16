# PR #14 verification evidence

Code revision tested: `fb3316d` on `forky/desktop-welcome-motion`.
Baseline (the fix reverted): `fork/main`'s `AccountWelcomeView.tsx`, bundled the same way.

Korbit's review asked for runtime evidence rather than regex tests, since those prove the tokens
are *used*, not how the screen behaves. This directory answers that.

## Method

The real component was rendered, not a model of it:

- `AccountWelcomeView.tsx` is bundled with the repo's own esbuild (jsx automatic, the repo's
  `theme.css` and `assets/google.svg`), with the Electron bridge (`window.codync`) stubbed so the
  account store resolves to a ready, signed-out account.
- Served over plain HTTP and driven in headless **Chrome 155** over CDP. Reduce Motion is applied
  with `Emulation.setEmulatedMedia`, and the same page is measured twice in one browser session.
- The entrance is sampled per animation frame with `Page.addScriptToEvaluateOnNewDocument`, so the
  first frames are captured rather than the settled state.

Not the Electron app itself: this is the real component and real CSS in a browser. The Electron
shell is not exercised, which is the remaining gap noted at the bottom.

## 1. Reduce Motion zeroes the tokens and stops the animation

Computed styles on the mounted screen:

| | `--layout` | running animations |
|---|---|---|
| reduce **off** | `0.3s linear(0, 0.0712, … 1)` | 2 |
| reduce **on** | `0s` | **0** |

The crew's own transition duration follows: `0.3s` off, `0s` on.

## 2. The entrance scale now actually animates

Bytes of the avatar's rendered width, sampled per frame from the first paint. This is the bug #5
called "unconfirmed", and the A/B is a single variable (the fix line only):

| | distinct sizes | ramp |
|---|---|---|
| **pre-fix** | **2** | `27.6 -> 92` (a hard jump) |
| **fixed** | **19** | `27.6 -> 31.41 -> 38.75 -> 47.69 -> 56.87 -> 65.42 -> 72.8 -> 78.49 -> … -> 92.18` |

Pre-fix, `scale(0.3)` sat inside the `transform` that the idle bob rewrites every frame, so the
transition never interpolated. The scale also overshoots to `1.00198` mid-flight, which is the
`--spring` token doing its job, where the old hard-coded curve could not.

## 3. Reduced motion pins the entrance

Sampled the same way, with reduce **on** (opacity is the crew's outer box, scale the element the
fix added; pre-fix there was no nested element, which is why only the width trace in §2 can show
the pre-fix behavior):

| | opacity | scale |
|---|---|---|
| pre-fix | `1` (static) | no nested element to measure; see §2 |
| fixed | `1` (static) | exactly `1` (distinct: 1) |

## 4. The `bubble-in` keyframe stopped ignoring Reduce Motion

Animation durations reported by `document.getAnimations()`:

| | reduce **on** |
|---|---|
| **pre-fix** | `bubble-in -> 450 ms` (played anyway) |
| **fixed** | `bubble-in -> 0 ms` |

With reduce off, the fix runs `transition:opacity`, `transition:scale` and `transition:transform`
at `300 ms` each.

## Screenshots

`welcome-motion-full.png` (reduce off) and `welcome-motion-reduced.png` (reduce on), 520x813,
captured after the entrance settles.

They show the settled layout, so they **cannot** demonstrate motion; the traces above are the
evidence for that. Both captures render the same text (`Fix the flaky login test`, `Done. …`, the
headline and the buttons): with reduce on the reply is already `Done.` at paint time, and with it
off the 1600 ms timer has elapsed by capture time, so the two settle to the same state. I could
not view these images myself (no vision-capable model in this environment), so they are attached
as captures rather than as a verified visual check, and they are not load-bearing evidence here.

## Not verified here

- The Electron app itself (menu bar, window chrome, real window size). The component and its CSS
  are the real ones; the shell is not.
- Reduced motion as it composes with the system setting end to end on macOS.
