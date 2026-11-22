import { CATALOG, getBadge, isVerified } from "./catalog";

export interface Env {
    DB: D1Database;
    DISCORD_CLIENT_ID: string;
    DISCORD_CLIENT_SECRET: string;
    DISCORD_API: string;
    RL_AUTH?: RateLimit;
    RL_WRITE?: RateLimit;
    RL_READ?: RateLimit;
}

interface RateLimit {
    limit(opts: { key: string }): Promise<{ success: boolean }>;
}

const SESSION_TTL = 30 * 24 * 3600;
const AUTH_TTL = 10 * 60;
const MAX_SESSIONS_PER_USER = 5;
const MAX_BODY = 1024;
const MAX_LOOKUP = 50;
const MAX_CODE_ATTEMPTS = 5;

const SNOWFLAKE = /^\d{15,21}$/;
const B64URL_43 = /^[A-Za-z0-9_-]{43}$/;
const B64URL_32 = /^[A-Za-z0-9_-]{32}$/;
const B64URL_22 = /^[A-Za-z0-9_-]{22}$/;
const BADGE_ID = /^[a-z0-9_]{1,40}$/;
// no 0/O/1/I/L so it's hard to misread
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const now = () => Math.floor(Date.now() / 1000);
const enc = new TextEncoder();

function b64url(bytes: Uint8Array) {
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function randomB64url(bytes: number) {
    return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

async function sha256b64url(input: string) {
    return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(input))));
}

function safeEqual(a: string, b: string) {
    const x = enc.encode(a);
    const y = enc.encode(b);
    if (x.length !== y.length) return false;
    return crypto.subtle.timingSafeEqual(x, y);
}

function makeUserCode() {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const chars = [...bytes].map(b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
    return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

const normalizeCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

const BASE_HEADERS = {
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "cross-origin-resource-policy": "same-origin"
};

function json(data: unknown, status = 200, cache = "no-store") {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...BASE_HEADERS, "content-type": "application/json", "cache-control": cache }
    });
}

const fail = (status: number, error: string) => json({ error }, status);

function page(title: string, body: string, status = 200) {
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font:16px system-ui;background:#1e1f22;color:#dbdee1;display:grid;place-items:center;min-height:100vh;margin:0}main{background:#2b2d31;padding:32px;border-radius:12px;max-width:420px;text-align:center}h1{margin-top:0;font-size:20px}input{font:20px monospace;letter-spacing:3px;text-align:center;text-transform:uppercase;padding:8px;width:11em;border-radius:6px;border:1px solid #444;background:#1e1f22;color:#fff}button{margin-top:16px;font:inherit;padding:8px 20px;border:0;border-radius:6px;background:#ff6fbf;color:#000;cursor:pointer}small{color:#949ba4}</style></head><body><main>${body}</main></body></html>`;
    return new Response(html, {
        status,
        headers: {
            ...BASE_HEADERS,
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
            "content-security-policy":
                "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
            "x-frame-options": "DENY"
        }
    });
}

// All values interpolated into pages are our own constants or validated; still escape anything dynamic.
const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
    if (!req.headers.get("content-type")?.startsWith("application/json")) return null;
    const text = await req.text();
    if (text.length > MAX_BODY) return null;
    try {
        const v = JSON.parse(text);
        return v && typeof v === "object" && !Array.isArray(v) ? v : null;
    } catch {
        return null;
    }
}

function clientKey(req: Request) {
    return req.headers.get("cf-connecting-ip") ?? "unknown";
}

async function limited(limiter: RateLimit | undefined, key: string) {
    if (!limiter) return false;
    return !(await limiter.limit({ key })).success;
}

interface Session {
    userId: string;
}

async function authenticate(req: Request, env: Env): Promise<Session | null> {
    const m = req.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9_-]{43})$/);
    if (!m) return null;
    const row = await env.DB.prepare("SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?")
        .bind(await sha256b64url(m[1]), now())
        .first<{ user_id: string }>();
    return row ? { userId: row.user_id } : null;
}

async function userBadges(env: Env, userId: string) {
    const [user, badges] = await env.DB.batch([
        env.DB.prepare("SELECT public_flags, premium_type FROM users WHERE id = ?").bind(userId),
        env.DB.prepare("SELECT badge_id FROM badges WHERE user_id = ? ORDER BY added_at, badge_id").bind(userId)
    ]);
    const u = (user.results[0] as { public_flags: number; premium_type: number } | undefined) ?? {
        public_flags: 0,
        premium_type: 0
    };
    const chosen = (badges.results as { badge_id: string }[]).map(r => r.badge_id);
    return {
        badges: chosen
            .map(id => getBadge(id))
            .filter(b => b != null)
            .map(b => ({ id: b.id, verified: isVerified(b, u.public_flags, u.premium_type) })),
        available: CATALOG.filter(b => isVerified(b, u.public_flags, u.premium_type)).map(b => b.id)
    };
}

// ---- auth ----

async function authStart(req: Request, env: Env, url: URL) {
    if (await limited(env.RL_AUTH, clientKey(req))) return fail(429, "rate_limited");
    const body = await readJson(req);
    const challenge = body?.challenge;
    if (typeof challenge !== "string" || !B64URL_43.test(challenge)) return fail(400, "bad_request");

    const id = randomB64url(16);
    const state = randomB64url(24);
    const userCode = makeUserCode();
    const t = now();

    await env.DB.prepare("DELETE FROM auth_requests WHERE expires_at < ?").bind(t).run();
    await env.DB.prepare(
        "INSERT INTO auth_requests (id, state, challenge, user_code, expires_at) VALUES (?, ?, ?, ?, ?)"
    )
        .bind(id, state, challenge, userCode, t + AUTH_TTL)
        .run();

    const authorize = new URL("https://discord.com/oauth2/authorize");
    authorize.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("scope", "identify");
    authorize.searchParams.set("redirect_uri", `${url.origin}/auth/callback`);
    authorize.searchParams.set("state", state);

    return json({ id, user_code: userCode, url: authorize.toString(), expires_in: AUTH_TTL });
}

async function discordExchange(env: Env, code: string, redirectUri: string) {
    const basic = btoa(`${env.DISCORD_CLIENT_ID}:${env.DISCORD_CLIENT_SECRET}`);
    const headers = { authorization: `Basic ${basic}`, "content-type": "application/x-www-form-urlencoded" };

    const tokenRes = await fetch(`${env.DISCORD_API}/oauth2/token`, {
        method: "POST",
        headers,
        body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri })
    });
    if (!tokenRes.ok) return null;
    const token = (await tokenRes.json()) as { access_token?: string; scope?: string };
    if (typeof token.access_token !== "string") return null;

    try {
        const meRes = await fetch(`${env.DISCORD_API}/users/@me`, {
            headers: { authorization: `Bearer ${token.access_token}` }
        });
        if (!meRes.ok) return null;
        const me = (await meRes.json()) as { id?: unknown; public_flags?: unknown; premium_type?: unknown };
        if (typeof me.id !== "string" || !SNOWFLAKE.test(me.id)) return null;
        const int = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < 2 ** 31 ? v : 0);
        return { id: me.id, publicFlags: int(me.public_flags), premiumType: int(me.premium_type) };
    } finally {
        // We never keep Discord's token: revoke it right away.
        await fetch(`${env.DISCORD_API}/oauth2/token/revoke`, {
            method: "POST",
            headers,
            body: new URLSearchParams({ token: token.access_token, token_type_hint: "access_token" })
        }).catch(() => {});
    }
}

async function authCallback(req: Request, env: Env, url: URL) {
    if (await limited(env.RL_AUTH, clientKey(req))) return page("Slow down", "<h1>Too many attempts</h1>", 429);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state || !B64URL_32.test(state) || code.length > 200)
        return page("Login failed", "<h1>Login failed</h1><p>Start again from Kittycord.</p>", 400);

    // Claim the request atomically so the state can only ever be used once
    const claimed = await env.DB.prepare(
        "UPDATE auth_requests SET status = 'exchanging' WHERE state = ? AND status = 'pending' AND expires_at > ?"
    )
        .bind(state, now())
        .run();
    if (!claimed.meta.changes)
        return page("Login failed", "<h1>Login expired</h1><p>Start again from Kittycord.</p>", 400);

    const user = await discordExchange(env, code, `${url.origin}/auth/callback`).catch(() => null);
    if (!user) {
        await env.DB.prepare("DELETE FROM auth_requests WHERE state = ?").bind(state).run();
        return page("Login failed", "<h1>Discord login failed</h1><p>Start again from Kittycord.</p>", 400);
    }

    await env.DB.prepare(
        "UPDATE auth_requests SET status = 'authorized', user_id = ?, public_flags = ?, premium_type = ? WHERE state = ?"
    )
        .bind(user.id, user.publicFlags, user.premiumType, state)
        .run();

    return confirmPage(state);
}

function confirmPage(state: string, error?: string) {
    return page(
        "Confirm Kittycord login",
        `<h1>Confirm login</h1>
<p>Type the code shown in <b>Kittycord</b> to finish linking your Discord account.</p>
<p><small>If you didn't just start this from Kittycord, close this tab. Don't type anyone else's code.</small></p>
${error ? `<p style="color:#f38ba8">${esc(error)}</p>` : ""}
<form method="post" action="/auth/confirm" autocomplete="off">
<input type="hidden" name="state" value="${esc(state)}">
<input name="code" maxlength="9" placeholder="XXXX-XXXX" required autofocus>
<br><button type="submit">Confirm</button></form>`
    );
}

async function authConfirm(req: Request, env: Env) {
    if (await limited(env.RL_AUTH, clientKey(req))) return page("Slow down", "<h1>Too many attempts</h1>", 429);
    if (!req.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded"))
        return page("Error", "<h1>Bad request</h1>", 400);
    const text = await req.text();
    if (text.length > MAX_BODY) return page("Error", "<h1>Bad request</h1>", 400);
    const form = new URLSearchParams(text);
    const state = form.get("state") ?? "";
    const input = normalizeCode(form.get("code") ?? "");
    if (!B64URL_32.test(state) || input.length !== 8) return page("Error", "<h1>Bad request</h1>", 400);

    // Count the attempt first, so parallel guesses can't beat the limit
    const bumped = await env.DB.prepare(
        "UPDATE auth_requests SET code_attempts = code_attempts + 1 WHERE state = ? AND status = 'authorized' AND expires_at > ? AND code_attempts < ?"
    )
        .bind(state, now(), MAX_CODE_ATTEMPTS)
        .run();
    if (!bumped.meta.changes) {
        await env.DB.prepare("DELETE FROM auth_requests WHERE state = ? AND code_attempts >= ?")
            .bind(state, MAX_CODE_ATTEMPTS)
            .run();
        return page("Login failed", "<h1>Login expired</h1><p>Start again from Kittycord.</p>", 400);
    }

    const row = await env.DB.prepare(
        "SELECT user_code, user_id, public_flags, premium_type FROM auth_requests WHERE state = ?"
    )
        .bind(state)
        .first<{ user_code: string; user_id: string; public_flags: number; premium_type: number }>();
    if (!row) return page("Login failed", "<h1>Login expired</h1>", 400);

    if (!safeEqual(normalizeCode(row.user_code), input)) return confirmPage(state, "That code doesn't match.");

    const t = now();
    await env.DB.batch([
        env.DB.prepare(
            `INSERT INTO users (id, public_flags, premium_type, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)
             ON CONFLICT(id) DO UPDATE SET public_flags = ?2, premium_type = ?3, updated_at = ?4`
        ).bind(row.user_id, row.public_flags, row.premium_type, t),
        env.DB.prepare("UPDATE auth_requests SET status = 'confirmed' WHERE state = ?").bind(state)
    ]);

    return page("Done", "<h1>You're logged in 🐱</h1><p>You can close this tab and go back to Kittycord.</p>");
}

async function authClaim(req: Request, env: Env) {
    // the client polls this every couple of seconds while the user logs in, so it uses the looser read limit
    if (await limited(env.RL_READ, clientKey(req))) return fail(429, "rate_limited");
    const body = await readJson(req);
    const id = body?.id;
    const verifier = body?.verifier;
    if (typeof id !== "string" || !B64URL_22.test(id) || typeof verifier !== "string" || !B64URL_43.test(verifier))
        return fail(400, "bad_request");

    const row = await env.DB.prepare(
        "SELECT status, challenge, user_id FROM auth_requests WHERE id = ? AND expires_at > ?"
    )
        .bind(id, now())
        .first<{ status: string; challenge: string; user_id: string | null }>();
    if (!row) return fail(404, "expired");
    if (!safeEqual(await sha256b64url(verifier), row.challenge)) return fail(403, "forbidden");
    if (row.status !== "confirmed" || !row.user_id) return json({ status: "pending" }, 202);

    // single use: whoever deletes the row gets the session
    const del = await env.DB.prepare("DELETE FROM auth_requests WHERE id = ? AND status = 'confirmed'").bind(id).run();
    if (!del.meta.changes) return fail(404, "expired");

    const token = randomB64url(32);
    const t = now();
    await env.DB.batch([
        env.DB.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)").bind(
            await sha256b64url(token),
            row.user_id,
            t,
            t + SESSION_TTL
        ),
        env.DB.prepare(
            "DELETE FROM sessions WHERE user_id = ?1 AND (expires_at < ?2 OR token_hash NOT IN (SELECT token_hash FROM sessions WHERE user_id = ?1 ORDER BY created_at DESC LIMIT ?3))"
        ).bind(row.user_id, t, MAX_SESSIONS_PER_USER)
    ]);

    return json({ status: "ok", token, expires_at: t + SESSION_TTL, user_id: row.user_id });
}

// ---- badges ----

async function getMe(req: Request, env: Env) {
    const session = await authenticate(req, env);
    if (!session) return fail(401, "unauthorized");
    return json({ user_id: session.userId, ...(await userBadges(env, session.userId)) });
}

async function postBadge(req: Request, env: Env) {
    const session = await authenticate(req, env);
    if (!session) return fail(401, "unauthorized");
    if (await limited(env.RL_WRITE, session.userId)) return fail(429, "rate_limited");

    const body = await readJson(req);
    const action = body?.action;
    const badge = body?.badge;
    if (
        (action !== "add" && action !== "remove") ||
        typeof badge !== "string" ||
        !BADGE_ID.test(badge) ||
        !getBadge(badge)
    )
        return fail(400, "bad_request");

    if (action === "add") {
        await env.DB.prepare("INSERT OR IGNORE INTO badges (user_id, badge_id, added_at) VALUES (?, ?, ?)")
            .bind(session.userId, badge, now())
            .run();
    } else {
        await env.DB.prepare("DELETE FROM badges WHERE user_id = ? AND badge_id = ?").bind(session.userId, badge).run();
    }
    return json({ user_id: session.userId, ...(await userBadges(env, session.userId)) });
}

async function getBadges(req: Request, env: Env, url: URL) {
    if (await limited(env.RL_READ, clientKey(req))) return fail(429, "rate_limited");
    const ids = [...new Set((url.searchParams.get("users") ?? "").split(","))];
    if (ids.length === 0 || ids.length > MAX_LOOKUP || !ids.every(id => SNOWFLAKE.test(id)))
        return fail(400, "bad_request");

    const placeholders = ids.map(() => "?").join(",");
    const { results } = await env.DB.prepare(
        `SELECT u.id AS user_id, u.public_flags, u.premium_type, b.badge_id
         FROM users u JOIN badges b ON b.user_id = u.id
         WHERE u.id IN (${placeholders}) ORDER BY b.added_at, b.badge_id`
    )
        .bind(...ids)
        .all<{ user_id: string; public_flags: number; premium_type: number; badge_id: string }>();

    const out: Record<string, [string, 0 | 1][]> = {};
    for (const r of results) {
        const badge = getBadge(r.badge_id);
        if (!badge) continue;
        (out[r.user_id] ??= []).push([badge.id, isVerified(badge, r.public_flags, r.premium_type) ? 1 : 0]);
    }
    return json(out, 200, "public, max-age=30");
}

async function deleteMe(req: Request, env: Env) {
    const session = await authenticate(req, env);
    if (!session) return fail(401, "unauthorized");
    if (await limited(env.RL_WRITE, session.userId)) return fail(429, "rate_limited");
    await env.DB.batch([
        env.DB.prepare("DELETE FROM badges WHERE user_id = ?").bind(session.userId),
        env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(session.userId),
        env.DB.prepare("DELETE FROM users WHERE id = ?").bind(session.userId)
    ]);
    return json({ ok: true });
}

async function logout(req: Request, env: Env) {
    const m = req.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9_-]{43})$/);
    if (m)
        await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?")
            .bind(await sha256b64url(m[1]))
            .run();
    return json({ ok: true });
}

export default {
    async fetch(req: Request, env: Env): Promise<Response> {
        const url = new URL(req.url);
        const route = `${req.method} ${url.pathname}`;

        try {
            switch (route) {
                case "GET /":
                    return page(
                        "Kittycord Badges",
                        "<h1>Kittycord Badges 🐱</h1><p>API for the Kittycord Fake/Custom Badges plugin. Source: github.com/HaraldErik/Kittycord</p>"
                    );
                case "GET /catalog":
                    return json(CATALOG, 200, "public, max-age=300");
                case "POST /auth/start":
                    return await authStart(req, env, url);
                case "GET /auth/callback":
                    return await authCallback(req, env, url);
                case "POST /auth/confirm":
                    return await authConfirm(req, env);
                case "POST /auth/claim":
                    return await authClaim(req, env);
                case "POST /auth/logout":
                    return await logout(req, env);
                case "GET /me":
                    return await getMe(req, env);
                case "DELETE /me":
                    return await deleteMe(req, env);
                case "POST /badges":
                    return await postBadge(req, env);
                case "GET /badges":
                    return await getBadges(req, env, url);
            }
        } catch (e) {
            // never leak internals
            console.error("unhandled", e instanceof Error ? e.message : "error");
            return fail(500, "internal_error");
        }

        const known = [
            "/",
            "/catalog",
            "/auth/start",
            "/auth/callback",
            "/auth/confirm",
            "/auth/claim",
            "/auth/logout",
            "/me",
            "/badges"
        ];
        return known.includes(url.pathname) ? fail(405, "method_not_allowed") : fail(404, "not_found");
    }
} satisfies ExportedHandler<Env>;
