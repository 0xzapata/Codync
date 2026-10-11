# Usage analytics

Opt-in product analytics in PostHog (US Cloud, project "Codync App", id 649427). Every
device asks once and sends nothing until the user agrees; the answer can be changed in
Settings anytime. The public promise lives in `web/app/privacy/page.tsx`: keep it true.

## Rules

- **Only feature use, never content.** No message text, prompts, code, file names, paths,
  bot names, credentials or agent output. Properties are counts, booleans and public
  catalog names (agent, model, connector catalog name; a custom connector is just `custom`).
- **Consent per device.** The computer's owner decides for that computer (host kv
  `analytics_enabled`, `null` until asked); each iPhone decides for itself
  (`UserDefaults` `analyticsEnabled`). Turning it off drops anything still queued.
- **Identity.** Signed in to a Codync account: the Clerk user id, with a person profile.
  Otherwise a random install id (the host id on a computer, a UUID on the iPhone) and no
  person profile. The first signed-in event sends `$identify` with `$anon_distinct_id` so
  earlier events join the account.
- **No IP or location**: the project discards client IPs and every event sets `$geoip_disable`.
- `env` is `main` or `dev`; filter dev out in PostHog.

## Where events come from

- **Host** (`host/src/analytics.rs`): `api::dispatch` maps successful API calls to events
  (`analytics::observe_call`), so every client is covered once: `bot_created`, `bot_updated`,
  `bots_reordered`, `bot_deleted`, `message_sent`, `turn_stopped`, `session_reset`, `permission_answered`,
  `routine_saved`, `routine_deleted`, `routine_run`, `voice_call_finished`,
  `remote_screen_opened`, `connector_installed`, `skill_installed`. A resent message (same
  `clientNonce`, e.g. a phone replaying after a reconnect) is not counted again. Bot actors
  report `turn_finished` when an agent's turn ends. `client` is `local` (desktop app, terminal UI)
  or `remote` (phones). Each event carries its own `timestamp` and `uuid` (a resent batch counts
  once) and the computer's key (`computer`, a hash of its id); batches go to `/batch/` every 30 s and once more when the
  host stops.
- **Desktop** reports app-level events through the loopback-only `track` method
  (`app_opened`, `onboarding_completed` when the welcome screen is finished, `signed_in`,
  `signed_out`) and sets consent with `setAnalytics`; `hello` carries `analytics: true | false | null`.
  The **terminal UI** reports only `app_opened` (it has no welcome screen or sign-in).
- **iPhone** (`CodyncKit` analytics client, no SDK) sends its own app-level events
  (`app_opened`, `onboarding_completed`, `computer_paired`, `signed_in`, `signed_out`,
  `voice_call_started`) straight to PostHog. Widgets and the notification extension never send.
- **Before the answer**: setup and pairing come before the question, so every client holds
  events in memory until the device answers; a yes sends them, a no drops them. Nothing leaves
  the device before a yes.

## Event properties

Besides `env`, `app_version`, `$os`, `$lib`:

| Event | Properties |
|---|---|
| `bot_created` | `kind` (`bot`/`group`), `agent`, `model` or `members` (count) |
| `message_sent` | `kind`, `agent`, `in_thread`, `attachments` (count) |
| `turn_finished` | `agent`, `outcome` (`done`/`stopped`/`failed`/`incomplete`), `stop_reason` (ACP's, else `other`), `source` (`user`/`routine`/`group`/`bot`), `seconds` |
| `voice_call_finished` | `seconds` |
| `connector_installed` | `connector` (catalog name or `custom`) |
| `skill_installed` | `custom` |
| `computer_paired` | `via` (`qr`/`account`), `computer` |
| every host event | `client` (`local`/`remote`), `computer`, `arch` |

## Metrics

Shared filters: `env = 'main'`, internal accounts excluded, UTC days. A *user* is a PostHog
person: the account when signed in, otherwise one install, so an anonymous iPhone and an
anonymous computer are two users until both sign in. Messages are recorded by the computer,
so an anonymous iPhone's chats count for its computer. To count people rather than devices,
join an iPhone's `computer_paired` to the computer's events on `computer` in SQL.

| Metric | Definition |
|---|---|
| Active user (DAU/WAU/MAU) | Sent ≥1 `message_sent` in the period. Any event at all counts as *present*, not active (`app_opened` on the iPhone fires on every return to the foreground). |
| New user | First event of any kind in the period (the first event after the device said yes, not the install). |
| Activated | Sent ≥1 message from a phone (`message_sent`, `client = remote`) within 7 days of first seen. In the first week of data, 4 of 5 such users came back after 24 h and none of the 6 computer-only ones did. |
| Successful turn rate | `turn_finished` with `outcome = done` ÷ all `turn_finished` with `source = user`, per agent and per `$os`. |
| Frustration rate | (`turn_stopped` + `session_reset`) ÷ `message_sent`, per `$os`. |
| Retained (D1, D7) | Active again on day 1 / any of days 7–13 after their first active day (PostHog retention, `message_sent` both ways). |
| Power user | Active on ≥4 of the last 7 days (stickiness). |
| Feature adoption | Share of WAU with ≥1 of: `voice_call_finished`, `remote_screen_opened`, `connector_installed`, `routine_saved`, `bot_created` with `kind = group`. |
| Up to date | Share of computers active in the period whose last `app_version` is the latest release. |

## Asking

All clients show the same prompt ("Help improve Codync", *Share usage* / *Don't share*)
when onboarding is done and the device hasn't answered, which covers new users right after
the welcome screen and existing users once after updating. The App Store privacy label
declares *Product Interaction*, linked to the user, not used for tracking.
