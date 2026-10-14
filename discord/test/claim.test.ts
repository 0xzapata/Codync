// Claim flow against stubbed Discord and GitHub: only a verified GitHub connection earns roles, a merged PR
// the Contributor role and an opened issue the Reporter role.
import assert from "node:assert/strict";
import worker from "../src/index.ts";

const env = {
  DISCORD_CLIENT_ID: "app", DISCORD_CLIENT_SECRET: "secret", DISCORD_BOT_TOKEN: "bot", GITHUB_TOKEN: "gh",
  GUILD_ID: "guild", CONTRIBUTOR_ROLE_ID: "contributor", REPORTER_ROLE_ID: "reporter",
  REPO: "leepokai/Codync", INVITE: "https://discord.gg/invite",
};

function stub(connections: object[], { prs = 0, issues = 0, member = true } = {}) {
  const roles: string[] = [];
  globalThis.fetch = (async (input: string, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/oauth2/token")) return Response.json({ access_token: "user" });
    if (url.endsWith("/users/@me")) return Response.json({ id: "42" });
    if (url.endsWith("/users/@me/connections")) return Response.json(connections);
    if (url.endsWith("/user/7")) return Response.json({ login: "octo" });
    if (url.includes("/search/issues")) {
      const q = decodeURIComponent(url);
      assert.match(q, /repo:leepokai\/Codync .* author:octo/);
      return Response.json({ total_count: q.includes("is:pr is:merged") ? prs : issues });
    }
    if (url.includes("/roles/")) {
      assert.equal(init?.method, "PUT");
      roles.push(url.split("/").pop()!);
      return new Response(null, { status: member ? 204 : 404 });
    }
    throw new Error(`unexpected ${url}`);
  }) as typeof fetch;
  return roles;
}

const callback = async (state = "s", cookie = "s") => {
  const res = await worker.fetch(new Request(`https://discord.test/callback?code=c&state=${state}`, { headers: { Cookie: `state=${cookie}` } }), env);
  return { status: res.status, text: await res.text() };
};

const start = await worker.fetch(new Request("https://discord.test/"), env);
assert.equal(start.status, 302);
const state = start.headers.get("Set-Cookie")!.match(/state=([^;]+)/)![1];
assert.equal(new URL(start.headers.get("Location")!).searchParams.get("state"), state);

const github = { type: "github", id: "7", verified: true };
let roles = stub([github], { prs: 1 });
assert.equal((await callback("s", "forged")).status, 400);
assert.match((await callback()).text, /You're a Contributor</);
assert.deepEqual(roles, ["contributor"]);

roles = stub([github], { issues: 2 });
assert.match((await callback()).text, /You're a Reporter</);
assert.deepEqual(roles, ["reporter"]);

roles = stub([github], { prs: 3, issues: 1 });
assert.match((await callback()).text, /You're a Contributor and Reporter/);
assert.deepEqual(roles, ["contributor", "reporter"]);

roles = stub([{ ...github, verified: false }], { prs: 1 });
assert.match((await callback()).text, /Connect GitHub/);
assert.deepEqual(roles, []);
roles = stub([github]);
assert.match((await callback()).text, /Nothing from @octo/);
assert.deepEqual(roles, []);
stub([github], { prs: 1, member: false });
assert.match((await callback()).text, /Join the server first/);
console.log("claim tests ok");
