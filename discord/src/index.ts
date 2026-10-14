// GitHub roles for the Codync Discord. The member signs in with Discord; we read the GitHub account they
// connected in Discord (Discord verifies it, so nobody can claim someone else's). A merged pull request on
// the repo earns the Contributor role, an opened issue the Reporter role.

export interface Env {
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  DISCORD_BOT_TOKEN: string;
  GITHUB_TOKEN: string;
  GUILD_ID: string;
  CONTRIBUTOR_ROLE_ID: string;
  REPORTER_ROLE_ID: string;
  REPO: string;
  INVITE: string;
}

const DISCORD = "https://discord.com/api/v10";

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const redirect = `${url.origin}/callback`;
    if (url.pathname === "/") return signIn(env, redirect);
    if (url.pathname !== "/callback") return page(404, "Not found", "");
    try {
      return await claim(req, url, env, redirect);
    } catch (e) {
      console.error("claim failed", { error: String(e) });
      return page(502, "Something went wrong", "Try again in a minute.");
    }
  },
};

function signIn(env: Env, redirect: string): Response {
  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    response_type: "code",
    scope: "identify connections",
    redirect_uri: redirect,
    state,
  });
  return new Response(null, {
    status: 302,
    headers: {
      Location: `https://discord.com/oauth2/authorize?${params}`,
      "Set-Cookie": `state=${state}; Path=/callback; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}

async function claim(req: Request, url: URL, env: Env, redirect: string): Promise<Response> {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = req.headers.get("Cookie")?.match(/(?:^|;\s*)state=([^;]+)/)?.[1];
  if (!code || !state || state !== cookie) return page(400, "This link expired", "Open it again from Discord.");

  const { access_token } = await json<{ access_token: string }>(`${DISCORD}/oauth2/token`, {
    method: "POST",
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirect,
    }),
  });
  const user = { headers: { Authorization: `Bearer ${access_token}` } };
  const [me, connections] = await Promise.all([
    json<{ id: string }>(`${DISCORD}/users/@me`, user),
    json<{ type: string; id: string; verified: boolean }[]>(`${DISCORD}/users/@me/connections`, user),
  ]);
  const connection = connections.find((c) => c.type === "github" && c.verified);
  if (!connection) {
    return page(200, "Connect GitHub to Discord first", "Discord → User Settings → Connections → GitHub, then open this link again.");
  }

  // The connection's id is the GitHub user id; its name can be stale after a rename.
  const github = { headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, "User-Agent": "codync-discord" } };
  const { login } = await json<{ login: string }>(`https://api.github.com/user/${connection.id}`, github);
  const roles = [
    { name: "Contributor", id: env.CONTRIBUTOR_ROLE_ID, query: "is:pr is:merged" },
    { name: "Reporter", id: env.REPORTER_ROLE_ID, query: "is:issue" },
  ];
  const counts = await Promise.all(roles.map(async ({ query }) => {
    const q = encodeURIComponent(`repo:${env.REPO} ${query} author:${login}`);
    return (await json<{ total_count: number }>(`https://api.github.com/search/issues?q=${q}&per_page=1`, github)).total_count;
  }));
  const earned = roles.filter((_, i) => counts[i] > 0);
  if (earned.length === 0) {
    return page(200, `Nothing from @${login} in ${env.REPO} yet`, "Open this link again once you open an issue or a pull request of yours is merged.");
  }

  for (const role of earned) {
    const res = await fetch(`${DISCORD}/guilds/${env.GUILD_ID}/members/${me.id}/roles/${role.id}`, {
      method: "PUT",
      headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, "X-Audit-Log-Reason": `GitHub @${login}` },
    });
    if (res.status === 404) return page(200, "Join the server first", "Then open this link again.", env.INVITE);
    if (!res.ok) throw new Error(`role ${role.name} ${res.status}: ${await res.text()}`);
  }
  const names = earned.map((r) => r.name).join(" and ");
  console.log("roles granted", { discord: me.id, github: login, roles: names });
  return page(200, `You're a ${names}`, `Thanks for your work on Codync, @${login}.`);
}

async function json<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${url} ${res.status}: ${await res.text()}`);
  return res.json<T>();
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

function page(status: number, title: string, body: string, link?: string): Response {
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Codync Discord</title>
<style>body{font:16px system-ui;display:grid;place-content:center;min-height:90vh;margin:0 16px;text-align:center;color:#111;background:#fff}
@media(prefers-color-scheme:dark){body{color:#eee;background:#111}}p{opacity:.7}</style>
<h1>${escape(title)}</h1><p>${escape(body)}</p>${link ? `<p><a href="${escape(link)}">${escape(link)}</a></p>` : ""}`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
