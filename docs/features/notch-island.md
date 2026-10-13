# Notch island (desktop)

The desktop app shows working bots in a black shape at the top center of the screen. On a
MacBook it grows out of the notch; on a Mac without a notch, and on Windows and Linux, it hangs
from the top edge. It draws Codync's own bot characters.

Turn it on or off in **Settings → General → System** (*Show in notch* on macOS, *Show at top
of screen* elsewhere) or the menu bar / tray menu's **Settings**. It is on by default. The
setting belongs to the desktop installation (`showIsland` in `host-prefs.json`).

## What it shows

| State | When | Shape |
|---|---|---|
| Hidden | No bot works or waits | Invisible over the notch (a thin strip at a plain top edge still wakes it) |
| Compact | A bot works or needs you | The notch widened: the bot in focus on the left; on the right an orb, how many work, or an amber dot when one needs you |
| Bots | The pointer rests on the island (250 ms, 600 ms over the bare notch) or a click | Up to six bots, working and waiting first, with their current step. A row opens the conversation |
| Approval | A permission card is pending | The bot, what it wants, the command, and the card's options (Allow once, Always allow, Deny…). Open conversation and Later (fold until the island is opened again or another card arrives) |
| Finished | A bot stops working | "*Bot* is done" or "failed" with its last message, for 4 s |

The island folds 500 ms after the pointer leaves it, or 8 s after it was opened without the
pointer on it (VoiceOver). A pending approval stays open until it is answered, expires or is
put off; answering folds the island. Answers go through the same `respondPermission` call as the
chat's permission card.

## How it works

- **Window** (`apps/desktop/src/main/island.ts`): a fixed 720 × 360 transparent, frameless,
  non-focusable window at the top center of the notch's display (else the main display). macOS:
  a non-activating panel at the main-menu level + 3, so it covers the menu bar, every Space and
  full-screen apps. Windows: a toolbar window (out of Alt+Tab). It never resizes; the shape
  animates inside it with CSS (spring open, plain close).
- **Click-through**: the window takes the mouse only over the shape (+8 pt); the renderer
  reports the shape's target rect on every change. macOS and Windows: the main process polls
  the pointer (60 Hz near the panel, ~7 Hz elsewhere), toggles `setIgnoreMouseEvents` and tells
  the renderer when the pointer enters or leaves. Linux (X11) only reports the pointer over the
  app's own windows, so the window is shaped to the island instead (`setShape`, kept at the old
  outline until a shrink's animation ends) and the renderer's own mouseenter/mouseleave is the
  hover.
- **Notch size**: Electron has no notch API, so `osascript -l JavaScript` reads each
  `NSScreen`'s `safeAreaInsets.top` and `auxiliaryTopLeftArea` / `auxiliaryTopRightArea`; the
  notch is the width between them (a 14" MacBook Pro: 185 × 32 pt). It is read again when
  displays change.
- **Data**: the chat window owns the stores. `useIslandSummary` (next to the tray's summary)
  sends bots and pending permission cards when they change; the island window renders them
  (`views/island/`, state in `IslandModel`, pure rules in `shared/island.ts`). Buttons travel back
  as `WindowCommand`s (`openBot`, `respondPermission`) to the chat window, which calls the host.
  The island has no host connection of its own.

## Platforms and other clients

- **Linux on Wayland**: not available (a window can't place itself at the top or stay above
  others), so the setting is hidden. On X11 the transparent corners need a compositing window
  manager (GNOME, KDE and most desktops have one); without one they show as a solid margin.
- **iPhone**: Live Activities and the Dynamic Island already cover this
  ([notifications and Live Activities](../design/push-and-live-activity.md)); no change.
- **Terminal UI**: a terminal can't draw over other apps; its roster already shows working and
  waiting bots.
