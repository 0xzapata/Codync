# PR #12 verification evidence

**UI status: UNVERIFIED.** This PR remains a draft.

Code revision tested: `796124fd5c7131b8f04e36cf643778ca768319b1` on `forky/desktop-thread-panel`.
Comparison baseline for future captures: `5225a9038da7ce7fab6bc33305207645f12218b4`.
These files contain previously captured check output from that code revision, not a new test run.

## Available files

- [tests.txt](tests.txt): actual `npm test` output and exit code, showing 143 passed and 0 failed. Includes the handler-level resize/save/cancel regression test.
- [typecheck.txt](typecheck.txt): actual `npm run typecheck` output and exit code 0.

The handler test substitutes React hooks and invokes handlers directly. It does not establish native pointer hit testing, rendered layout, real React scheduling, or visual accessibility behavior.

## Missing required UI evidence

- Before/after screenshots from the real desktop app at the named baseline and changed revision.
- A recording under approximately 20 seconds showing the thread divider resize and the sidebar behavior.
- Screenshot/DOM diagnosis naming the layer covering the modal Close/checkmark controls, followed by the shared fix and a recording of ordinary clicks working.
- The changed behavior with Reduce Motion both ON and OFF.
- Real-app checks for narrow windows, keyboard resizing, pointer cancellation, reopening, nested modals, and the 9 px divider hit area.

Live inspection did not execute: automatic approval review could not load its configured `codex-auto-review` model. This failure is not a finding about the app or a security rejection. No alternative capture route was used to bypass that check.

Before attaching any image or recording, inspect its frames for secrets, tokens and private chats. Use a safe test conversation in the real app. List each final artifact in the PR description with the behavior it proves. Test output alone does not satisfy the UI evidence requirement.

