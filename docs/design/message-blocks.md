# Message blocks (design draft)

Status: **draft**. Nothing here is built. Tracked in
[#6](https://github.com/0xzapata/Codync/issues/6); the `diagram` block waits for the spike in
[#8](https://github.com/0xzapata/Codync/issues/8), and `html` for
[#9](https://github.com/0xzapata/Codync/issues/9).

This page defines an optional `data.blocks` field on an `agent` entry, so a bot can send more
than markdown text: code with a copy button, tables, diagrams and small native panels. Today a
message is one string in `data.text`, parsed as markdown on each client (see
[chat messages](../features/chat-messages.md)).

## Where it goes

- `Entry.data` is already an untyped `serde_json::Value` on the host
  (`host/src/store/model.rs:164-175`). A new optional field needs no host struct change.
- Additive fields need no version floor change (`docs/reference/compatibility.md`, "Additive
  changes"). The wire-shape test must record the new paths
  (`CODYNC_UPDATE_WIRE_SHAPE=1 cargo test --test e2e wire_shape`).
- **Do not add a new entry `kind`.** The desktop `isChat()` (`apps/desktop/src/shared/models.ts`)
  hides unknown kinds, so old clients would show nothing.
- **`data.text` stays.** It holds a plain-markdown version of the whole message. A client that
  does not know `blocks` shows `text` and loses nothing. A client that knows `blocks` shows the
  blocks and ignores `text`.

## Shape

```ts
data.blocks?: Block[]

type Block =
  | { type: 'markdown'; text: string }
  | { type: 'code'; language?: string; text: string }
  | { type: 'table'; header: string[]; rows: string[][]; alt: string }
  | { type: 'diagram'; alt: string;
      png: { data: string; w: number; h: number; scale: 2 | 3 };   // base64, required
      svg?: string;                                                 // desktop only, optional
      source?: { format: 'mermaid'; text: string } }                // shown as text, never parsed
  | { type: 'ui'; alt: string; root: string;
      elements: Record<string, { type: string; props?: object; children?: string[] }> }
  | { type: 'html'; alt: string; /* see #9 */ }
```

Rules for every block:

1. A block a client does not know is skipped, and `data.text` is not affected.
2. Every block except `markdown` and `code` carries `alt`: a plain-text description for old
   clients, screen readers and failed renders.
3. A block that fails to render shows its `alt`, not an error.

## Size

The host's WebSocket frame limit is exactly 1 MiB (`MAX_WS_MESSAGE`,
`host/src/remote/channel.rs:30`; iOS enforces the same figure). An entry travels as one JSON
frame, and base64 makes binary data a third larger.

- An entry's whole `data` is at most **768 KB**.
- The host **rejects**, never truncates, an entry over the cap.
- Larger images may later use the chunked file path (`bots.rs`, 256 KiB chunks). Out of scope
  for v1.

## `diagram`

Status: **draft, pending the spike (#8).**

- The **host renders** the diagram. Apps never parse Mermaid.
- **PNG is required.** iOS has no public API to draw an SVG string at runtime, and Mermaid draws
  its default labels as HTML (`foreignObject`) that a sanitiser strips, so an SVG may arrive
  without text. Host config `htmlLabels: false` should keep labels as SVG `<text>`; the spike
  confirms it.
- PNG limits: at most **512 KB raw** and **2000 px** per side.
- **SVG is optional and desktop only.** The host sanitises it with an allowlist of elements
  (strip `script`, `foreignObject`, `on*` attributes, external `href`/`xlink:href`, `@import`).
  Clients show it as an image, never inline in the DOM. At most **256 KB**.
- `alt` describes the content (the nodes and the flow), not only a title.
- `source` is shown as a code block. It is never parsed or rendered by a client.
- Open: the host needs one pinned headless browser to render. The owner decides whether that
  dependency is acceptable.

## `ui`

A small native panel, in the style of Vercel's json-render: a flat `root` id plus an `elements`
map, each element a `type`, `props` and child ids.

- Components come **only from a fixed catalog** that each app implements natively. The first
  catalog is the owner's decision.
- **Any unknown component rejects the whole block**, and the message shows `alt`. Never drop
  single components: a dropped warning could mislead the reader.
- A spec is data. No expressions, no scripts, no URLs that the client fetches by itself.
- Buttons in v1 only send a fixed chat message back. Nothing acts on the host directly.
- Copy the **pattern**, not the library: json-render is Apache-2.0 but pre-1.0, has no Swift
  renderer, and its core needs zod (about 94 KB gzipped). Each app validates with a small
  hand-written check and renders by hand (React, SwiftUI).

## `html`

Deferred and last. See [#9](https://github.com/0xzapata/Codync/issues/9) for the plan: each
artifact loads as its own document with its own CSP (desktop: a custom scheme; iOS: a
non-persistent web view), in a sandbox with no network and no bridge to the app. `srcdoc` does
not work on desktop because it inherits the app CSP (`apps/desktop/src/renderer/index.html:5`).
Worth building only if agents need interactive pages that `ui` cannot express.

## Order of work

1. Markdown gaps on both apps: code copy button, highlighting, task lists
   ([#7](https://github.com/0xzapata/Codync/issues/7)). Needs no schema.
2. `diagram`, after the spike.
3. `ui`, with a small catalog.
4. `html`, only if needed.

## Open questions

- Which components go in the first `ui` catalog?
- Is a host-side headless browser acceptable for `diagram`?
- Do agents need interactive pages, or is a static display enough? (Decides whether `html`
  is ever built.)
