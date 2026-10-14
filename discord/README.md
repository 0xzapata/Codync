# Codync Discord

Cloudflare Worker at `https://discord.codync.dev` that gives the GitHub roles on the Codync Discord.

1. `/` sends the member to Discord sign-in (`identify connections`).
2. `/callback` reads the GitHub account connected in their Discord profile (verified by Discord, so nobody can
   claim someone else's) and resolves its login by GitHub user id.
3. A merged pull request on `leepokai/Codync` earns **Contributor**, an opened issue **Reporter**; the bot adds
   each role earned. No GitHub connection, or neither: nothing changes.

`.github/workflows/contributor.yml` comments the link on a contributor's first merged pull request and first issue.

## Setup

- Discord application **Codync** (Developer Portal): OAuth2 redirect `https://discord.codync.dev/callback`; bot not public.
  Install the bot in the server with Manage Roles, and keep its role above Contributor and Reporter.
- `wrangler.toml` holds the public values (client id, guild, role ids, repo, invite).

```bash
npm ci
npx wrangler secret put DISCORD_CLIENT_SECRET
npx wrangler secret put DISCORD_BOT_TOKEN
npx wrangler secret put GITHUB_TOKEN   # classic token, no scopes (public read only)
npm run deploy
```

## Test

```bash
npm run typecheck
npm test
```
