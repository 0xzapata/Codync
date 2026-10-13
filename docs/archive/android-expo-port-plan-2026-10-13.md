# Android port of the Codync iPhone app with Expo

> Plan record dated 2026-10-13. This is a proposal: nothing below is implemented or verified in the checkout. The work items are beads in `.beads/issues.jsonl` on the same branch (`bd init --prefix codync --from-jsonl`, then `bd show codync-j9c`).

## Decision

Feasible. Build a new Expo app at `apps/android/` and move the pure TypeScript the desktop already has into `apps/shared/core/` so both clients share one implementation of the wire models, sync and the E2E channel. The Swift UI is rewritten screen by screen; nothing Swift is reused. MVP (pair by QR, connect direct or via relay, chat, approvals) is 8 slices, about 10 working days. Parity minus the skips below is about 28 days.

## What exists

| Thing | Size |
|---|---|
| iOS app | 183 Swift files, 28,312 LOC. CodyncKit: Client 2,475, Models 2,117, Design 1,617. CodyncUI: Thread 2,900, Marketplace 2,317, Call 2,034, Store 1,985, Bots 1,308, Screen 1,178, chrome 1,265, Routines 586. App 891, Views 3,239, Widgets 885, NotificationService 92. |
| Reusable desktop TypeScript | ~2.5k LOC of pure logic with node tests: `shared/{models,compat,mirror-window,composer-drafts,files}.ts`, `renderer/client/host-client.ts`, `store/{bot-store,bot-sync,bot-mirror,memory-store,file-downloads,cloud,computer-order}.ts`, `views/thread/{bot-exchange,markdown-blocks,composer-keyboard}.ts`. |
| Protocol | `docs/reference/remote-relay.md` plus shared vectors `docs/reference/fixtures/remote-relay-vectors.json`, already checked by Rust, Swift and the cloud TS. |
| Third-party on iOS | WebRTC 153 (remote screen, realtime voice), SwiftTerm 1.18 (agent setup terminal), Clerk iOS 1.5.6 (accounts). |

## Architecture

- `apps/shared/core/`: zero-dependency TypeScript (no react, electron, window, localStorage). Wire models, sync and mirror logic, channel crypto and transport. Desktop and Android import it through a tsconfig path alias `@core/*`; no npm workspace. Ceiling: two consumers; move to workspaces when a third appears. Tests run with `node --test --experimental-strip-types`, so only erasable TS syntax (no enums, namespaces, decorators).
- `apps/android/`: Expo (current SDK, docs on 2026-10-13 list SDK 57 / RN 0.86), dev client from day one (WebRTC, speech, widgets never run in Expo Go), Expo Router, strict TS, New Architecture. `app.config.ts` reads `CODYNC_ENV=dev|main` and `apps/shared/Config/{env}.plist`: name "Codync Dev"/"Codync", package `com.pokai.codync.android[.dev]`, scheme `codync-dev`/`codync`, cloud URL, version = `MARKETING_VERSION`.
- Transport: React Native `WebSocket` to `ws://host:port/channel?v=1`, racing every direct URL for 1.5 s, else `wss://{cloud}/v1/relay/device/{computerId}?v=1` with a `Codync-Sig` header. Crypto in pure JS: `@noble/curves` (Ed25519, X25519), `@noble/ciphers` (ChaCha20-Poly1305 IETF), `@noble/hashes` (SHA-256, HKDF), `expo-crypto` for random bytes. Swap the AEAD to a native binding only if measured too slow on Hermes.
- Keys: Ed25519 device key and X25519 push key seeds in `expo-secure-store`; computers and the mirror cache in AsyncStorage or SQLite.
- UI: port the iOS screens one at a time following `docs/design/ui-conventions.md`; Material idioms where iOS relies on system Liquid Glass; system menus and sheets, never hand-built dropdowns.

## Server changes Android needs

| Where | Today | Change |
|---|---|---|
| `host/src/remote/channel.rs:567-569` | `pair` accepts platform `ios` or `macos` only, else 400 and close 4002 | Accept `android`. Minor version bump. This host version becomes the Android app's `minHost`. |
| `host/src/api/events.rs:36-45,81`, `host/src/hub.rs:63,519`, `host/src/remote/push.rs:110` | Events subscription with `client=="ios"` holds pushes while a phone is connected | Count `android` too, rename to phone clients. Android must send `client:"android"`, never `"ios"`. |
| `cloud/src/routes/account.ts:61` | `POST /v1/devices` platform enum `ios|macos|linux|windows` | Add `android` (account path only; QR pairing does not touch the cloud). |
| `relay/src/index.ts:29,76-80,101-110,219+` and `host/src/remote/push.rs:146-156` | APNs only: hex token, bundle `com.pokai.Codync.ios`, APNs-shaped batch body | FCM HTTP v1 path with a platform on the ticket, data-only high-priority messages carrying the same sealed payload. |
| `host/src/update/install.rs:128` | `platform=="ios"` gates host updates on the App Store | No change. |

## Library choices

| Capability | Choice | Native module? |
|---|---|---|
| Crypto | `@noble/curves`, `@noble/ciphers`, `@noble/hashes`, `expo-crypto` | No (upgrade path: `react-native-quick-crypto` or `react-native-libsodium`) |
| Secure keys | `expo-secure-store` | No |
| QR scan | `expo-camera` `CameraView onBarcodeScanned` | No |
| Deep link | `expo-linking` + `scheme` in app config | Rebuild after scheme change |
| Push | `expo-notifications` + background task (`expo-task-manager`) or Notifee, FCM v1 | Yes |
| Terminal | xterm.js in `react-native-webview` | Yes |
| Remote screen, realtime voice | `react-native-webrtc` + `@config-plugins/react-native-webrtc` pinned to the Expo SDK major | Yes |
| Speech | `expo-speech` (TTS), `expo-speech-recognition` (STT) | STT yes |
| Widgets | `react-native-android-widget` | Yes |
| APK | `expo prebuild` + `gradlew assembleRelease` in CI, or `eas build --profile preview` with `buildType: apk` | n/a |

## Slices

| # | Slice | Depends on | Days | Priority |
|---|---|---|---|---|
| 1 | Extract framework-free core from desktop into `apps/shared/core` | | 1 | P1 |
| 2 | Channel crypto in TS passing the shared vectors | 1 | 1 | P1 |
| 3 | Host: accept `platform:"android"`, phone push-mute guard | | 0.5 | P1 |
| 4 | Scaffold `apps/android` (dev client, dev/main envs) | | 0.5 | P1 |
| 5 | Channel transport + pairing in core, integration-tested against a real host | 2, 3 | 2 | P1 |
| 6 | Android pairing UI, stored computers, connection state, update-needed card | 4, 5 | 1 | P1 |
| 7 | Bot list and read-only thread using the shared mirror | 1, 6 | 2 | P1 |
| 8 | Composer, send, stop, approvals, reactions (chat MVP) | 7 | 1.5 | P1 |
| 9 | Attachments: chunked upload, download, share | 8 | 1 | P2 |
| 10 | Push: FCM in relay, host fields, app background decrypt | 8 | 3 | P2 |
| 11 | Account sign-in (Clerk), cloud computers, access requests with SAS | 6 | 2 | P2 |
| 12 | Settings, bot/group editors, memory, usage, routines, marketplace | 8 | 4 | P2 |
| 13 | Agent setup terminal (xterm.js) over the term subscription | 12 | 1.5 | P3 |
| 14 | Remote screen viewer (WebRTC) | 7 | 3 | P3 |
| 15 | Voice: dictation + TTS, then realtime calls | 8 | 2 | P3 |
| 16 | Release pipeline (APK on tag), versioning, docs | 8 | 1 | P2 |
| 17 | Home-screen widget (optional) | 7 | 1 | P3 |

MVP = slices 1 to 8. Slices 3, 4 and 1 can start in parallel.

## Skipped or deferred, with reasons

- Live Activity: ActivityKit only; Android has no system-rendered equivalent. Ordinary push covers needs-input, done, failed.
- Sign in with Apple: Google via Clerk is enough on Android.
- Computer use: a byproduct of chat rendering plus remote-screen takeover; no separate work.
- Offline mailbox (`mbox.*`): optional in protocol v1; queue client-side.
- Play Store: an APK attached to the GitHub release first; AAB later.

## Risks

- ChaCha20-Poly1305 in pure JS on Hermes may be slow for a 16 MiB history catch-up. Slice 2 measures on a device; the AEAD sits behind one interface so a native binding is a drop-in.
- `@config-plugins/react-native-webrtc` must match the Expo SDK major exactly, and Android WebRTC defaults to software codecs; hardware H.264 is an explicit opt-in.
- Data-only FCM can be delayed by Doze and OEM battery managers; delivery is not real time.
- Clerk `CLERK_AUTHORIZED_PARTIES` may need the Android app; unverified until slice 11.
- Every future UI change now has three clients (CLAUDE.md:44). The shared core removes duplicated logic, not duplicated UI.
- xterm.js in a WebView has a known Android soft-keyboard bug (input buffered until double Enter); a plain input row is the fallback.

## Rules to respect in the Codync repo

- Every merge touching `apps/` or `host/` bumps the version (`apps/project.yml`, `host/Cargo.toml` + lock, `apps/desktop/package.json` + lock, and `apps/android/app.json` once it exists) and commits `build: bump version to X.Y.Z`. Relay and cloud changes do not bump.
- The Android version string equals `MARKETING_VERSION`, otherwise `hello.minApp` is meaningless.
- Conventional commits, stage only your own changes, several agents share `dev`.

## Beads

Epic `codync-j9c`. Slices `codync-j9c.1` to `codync-j9c.17` follow the table above: `.1` core extraction, `.2` crypto, `.3` host platform gate, `.4` scaffold, `.5` transport and pairing, `.6` pairing UI, `.7` roster and thread, `.8` chat MVP, `.9` attachments, `.10` push, `.11` accounts, `.12` RPC screens, `.13` terminal, `.14` remote screen, `.15` voice, `.16` release pipeline, `.17` widget. Ready without blockers: `.1`, `.3`, `.4`.
