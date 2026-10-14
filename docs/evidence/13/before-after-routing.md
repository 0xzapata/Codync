# PR #13 before/after: unmentioned thread reply routing

Provenance: real host dispatcher via `host/src/chat/group/tests.rs`
(`unmentioned_thread_reply_reaches_only_its_author`, child of the
`chat::group::tests` module), run with `cargo test group` on this branch
after the merge of `fork/main` @ v2.16.2. Output pairs below are the test's
own INPUT/OUTPUT prints plus the prompt-file assertion.

## Case

- Group members: a, b. Thread root authored by b ("Proposal from b").
- User sends "Please continue" in that thread, no mentions.

## Before (pre-fix behaviour)

- Both members were considered for a turn, so `a/prompts.jsonl` existed
  (an unmentioned member got a turn).

## After (this branch)

INPUT: members=[a,b], root.author=b, user=Please continue
OUTPUT: [("b", "reply: group")]
- `a/prompts.jsonl` does NOT exist: unmentioned member a got no turn.
- Replies in thread: exactly [b].

## Full routing suite on this branch

See `group-routing-tests.txt`: 17 passed, 0 failed (includes the
line-30-of-40 mention, 4096 cap, root-context, and bot-mention tests).
Full host suite: 284 passed, 0 failed in lib; team_e2e 8/8; the one
`routines_e2e` timeout failure (`a_hung_routine...`) is unrelated to this
branch (touches no routine code) and passes alone on rerun (7.6s OK).
Desktop: typecheck clean, 147 tests passed. Clippy + fmt clean.

## Demo FakeHost parity (real code, not a mock claim)

`FakeHost.converse` previously answered with `members.slice(0, 2)` for an
unmentioned thread: the same input returned two members before, all routed
members after. The `groupResponders` unit tests in
`apps/desktop/src/renderer/lib/group-responders.test.ts` pin the parity
(main/owned/orphaned threads, mention boundaries incl. CJK, @all/@everyone,
regex-punctuation names). Desktop suite: 147 passed, 0 failed.
