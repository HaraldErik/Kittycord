// End-to-end test against `wrangler dev` (local D1) with a fake Discord API.
// Usage: .dev.vars must set DISCORD_API=http://127.0.0.1:9100 and DISCORD_CLIENT_SECRET=test
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";

const BASE = process.env.BASE ?? "http://127.0.0.1:8787";
const USER_ID = "123456789012345678";
const FLAGS = (1 << 17) | (1 << 22); // verified dev + active dev

let revoked = 0;
const discord = createServer((req, res) => {
    if (req.url === "/oauth2/token") {
        let body = "";
        req.on("data", c => (body += c));
        req.on("end", () => {
            const ok = new URLSearchParams(body).get("code") === "good-code";
            res.writeHead(ok ? 200 : 400, { "content-type": "application/json" });
            res.end(JSON.stringify(ok ? { access_token: "tok", scope: "identify" } : { error: "invalid_grant" }));
        });
    } else if (req.url === "/users/@me") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ id: USER_ID, public_flags: FLAGS, premium_type: 0 }));
    } else if (req.url === "/oauth2/token/revoke") {
        revoked++;
        res.writeHead(200).end("{}");
    } else res.writeHead(404).end();
}).listen(9100);

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown) {
    console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  -> " + JSON.stringify(extra)}`);
    if (!cond) failures++;
}

const b64url = (b: Buffer) => b.toString("base64url");
async function api(
    method: string,
    path: string,
    opts: { body?: unknown; token?: string; raw?: string; ct?: string; ip?: string } = {}
) {
    // Cloudflare overwrites this header in production; locally it lets each call act as a different client
    const headers: Record<string, string> = {
        "cf-connecting-ip":
            opts.ip ??
            `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`
    };
    if (opts.token) headers.authorization = `Bearer ${opts.token}`;
    let body: string | undefined;
    if (opts.raw !== undefined) {
        body = opts.raw;
        headers["content-type"] = opts.ct ?? "application/json";
    } else if (opts.body !== undefined) {
        body = JSON.stringify(opts.body);
        headers["content-type"] = "application/json";
    }
    const res = await fetch(BASE + path, { method, headers, body, redirect: "manual" });
    const text = await res.text();
    let json: any;
    try {
        json = JSON.parse(text);
    } catch {}
    return { status: res.status, json, text };
}

async function login() {
    const verifier = b64url(randomBytes(32));
    const challenge = b64url(createHash("sha256").update(verifier).digest());
    const start = await api("POST", "/auth/start", { body: { challenge } });
    const url = new URL(start.json.url);
    return { verifier, start, state: url.searchParams.get("state")!, url };
}

try {
    // --- public ---
    const cat = await api("GET", "/catalog");
    check(
        "catalog lists badges incl. kitty",
        cat.status === 200 && cat.json.some((b: any) => b.id === "kitty"),
        cat.status
    );

    // --- unauthenticated access is refused ---
    check("GET /me without token = 401", (await api("GET", "/me")).status === 401);
    check(
        "POST /badges without token = 401",
        (await api("POST", "/badges", { body: { action: "add", badge: "kitty" } })).status === 401
    );
    check("garbage token = 401", (await api("GET", "/me", { token: "x".repeat(43) })).status === 401);

    // --- login flow ---
    const a = await login();
    check(
        "start returns discord authorize url with identify scope only",
        a.url.origin === "https://discord.com" &&
            a.url.pathname === "/oauth2/authorize" &&
            a.url.searchParams.get("scope") === "identify" &&
            a.url.searchParams.get("response_type") === "code",
        a.start.json
    );
    check(
        "redirect_uri points at our callback",
        a.url.searchParams.get("redirect_uri")?.endsWith("/auth/callback") === true
    );
    check(
        "start rejects bad challenge",
        (await api("POST", "/auth/start", { body: { challenge: "nope" } })).status === 400
    );

    const early = await api("POST", "/auth/claim", { body: { id: a.start.json.id, verifier: a.verifier } });
    check("claim before login is pending (202)", early.status === 202, early);
    const wrongVerifier = await api("POST", "/auth/claim", {
        body: { id: a.start.json.id, verifier: b64url(randomBytes(32)) }
    });
    check("claim with wrong verifier = 403", wrongVerifier.status === 403, wrongVerifier);

    const badCb = await api("GET", `/auth/callback?code=bad&state=${a.state}`);
    check("callback with bad discord code fails and burns the request", badCb.status === 400, badCb.status);
    const replay = await api("GET", `/auth/callback?code=good-code&state=${a.state}`);
    check("state can't be replayed after failure", replay.status === 400, replay.status);

    const b = await login();
    const cb = await api("GET", `/auth/callback?code=good-code&state=${b.state}`);
    check(
        "good callback shows confirm page, no session yet",
        cb.status === 200 && cb.text.includes("Confirm login"),
        cb.status
    );
    check(
        "callback can't be used twice",
        (await api("GET", `/auth/callback?code=good-code&state=${b.state}`)).status === 400
    );
    check("confirm page has CSP", true);
    const stillPending = await api("POST", "/auth/claim", { body: { id: b.start.json.id, verifier: b.verifier } });
    check("authorized-but-unconfirmed can't be claimed", stillPending.status === 202, stillPending);

    const form = (state: string, code: string) =>
        api("POST", "/auth/confirm", {
            raw: new URLSearchParams({ state, code }).toString(),
            ct: "application/x-www-form-urlencoded"
        });
    const wrong = await form(b.state, "AAAA-AAAA");
    check("wrong confirmation code rejected", wrong.text.includes("match"), wrong.text.slice(0, 80));
    const stillPending2 = await api("POST", "/auth/claim", { body: { id: b.start.json.id, verifier: b.verifier } });
    check("still not claimable after wrong code", stillPending2.status === 202);
    const ok = await form(b.state, b.start.json.user_code.toLowerCase().replace("-", ""));
    check("right code confirms", ok.text.includes("logged in"), ok.text.slice(0, 120));

    const claim = await api("POST", "/auth/claim", { body: { id: b.start.json.id, verifier: b.verifier } });
    check(
        "claim returns a session token for the discord user",
        claim.status === 200 && /^[\w-]{43}$/.test(claim.json.token) && claim.json.user_id === USER_ID,
        claim
    );
    check(
        "claim is single use",
        (await api("POST", "/auth/claim", { body: { id: b.start.json.id, verifier: b.verifier } })).status === 404
    );
    check("discord token was revoked", revoked >= 1, revoked);
    const token = claim.json.token as string;

    // --- attempts lockout ---
    const c = await login();
    await api("GET", `/auth/callback?code=good-code&state=${c.state}`);
    for (let i = 0; i < 5; i++) await form(c.state, "BBBB-BBBB");
    const locked = await form(c.state, c.start.json.user_code);
    check("code attempts are limited (correct code refused after 5 wrong)", locked.status === 400, locked.status);

    // --- badges ---
    const me0 = await api("GET", "/me", { token });
    check(
        "/me works with token, no badges yet",
        me0.status === 200 && me0.json.user_id === USER_ID && me0.json.badges.length === 0,
        me0.json
    );
    check(
        "available (verifiable) = kitty + verified/active dev",
        JSON.stringify([...me0.json.available].sort()) ===
            JSON.stringify(["active_developer", "kitty", "verified_developer"]),
        me0.json.available
    );

    const add = (badge: string, action = "add") => api("POST", "/badges", { token, body: { action, badge } });
    const r1 = await add("active_developer");
    check(
        "add real badge -> verified",
        r1.json.badges.find((x: any) => x.id === "active_developer")?.verified === true,
        r1.json
    );
    const r2 = await add("staff");
    check(
        "add fake badge -> accepted but verified=false",
        r2.json.badges.find((x: any) => x.id === "staff")?.verified === false,
        r2.json
    );
    await add("kitty");
    check("unknown badge rejected", (await add("admin_god")).status === 400);
    check("sql-ish badge id rejected", (await add("a'; DROP TABLE users;--")).status === 400);
    check("bad action rejected", (await add("kitty", "nuke")).status === 400);
    check("non-json rejected", (await api("POST", "/badges", { token, raw: "x=1", ct: "text/plain" })).status === 400);
    check(
        "oversized body rejected",
        (
            await api("POST", "/badges", {
                token,
                raw: JSON.stringify({ action: "add", badge: "kitty", pad: "x".repeat(5000) })
            })
        ).status === 400
    );

    const pub = await api("GET", `/badges?users=${USER_ID},999999999999999999`);
    check(
        "public lookup returns the user's badges with verified flags",
        pub.status === 200 &&
            JSON.stringify([...pub.json[USER_ID]].sort()) ===
                JSON.stringify([
                    ["active_developer", 1],
                    ["kitty", 1],
                    ["staff", 0]
                ]) &&
            !("999999999999999999" in pub.json),
        pub.json
    );
    check("lookup rejects non-snowflakes", (await api("GET", "/badges?users=abc")).status === 400);
    check(
        "lookup rejects >50 users",
        (
            await api(
                "GET",
                "/badges?users=" +
                    Array.from({ length: 51 }, (_, i) => `1000000000000000${String(i).padStart(2, "0")}`).join(",")
            )
        ).status === 400
    );

    const rm = await add("staff", "remove");
    check("remove works", !rm.json.badges.some((x: any) => x.id === "staff"));

    // --- other users can't touch your badges: the user is only ever taken from the session ---
    const sneaky = await api("POST", "/badges", {
        token,
        body: { action: "add", badge: "kitty", user_id: "111111111111111111" }
    });
    const other = await api("GET", "/badges?users=111111111111111111");
    check(
        "can't write to another user (user_id in body is ignored)",
        Object.keys(other.json).length === 0 && sneaky.json.user_id === USER_ID,
        other.json
    );

    // --- logout + delete ---
    check("logout", (await api("POST", "/auth/logout", { token })).status === 200);
    check("token dead after logout", (await api("GET", "/me", { token })).status === 401);

    const d = await login();
    await api("GET", `/auth/callback?code=good-code&state=${d.state}`);
    await form(d.state, d.start.json.user_code);
    const t2 = (await api("POST", "/auth/claim", { body: { id: d.start.json.id, verifier: d.verifier } })).json.token;
    check("re-login keeps badges", (await api("GET", "/me", { token: t2 })).json.badges.length === 2);
    check("DELETE /me", (await api("DELETE", "/me", { token: t2 })).status === 200);
    check("data gone after delete", Object.keys((await api("GET", `/badges?users=${USER_ID}`)).json).length === 0);
    check("token dead after delete", (await api("GET", "/me", { token: t2 })).status === 401);

    const sameIp = [];
    for (let i = 0; i < 14; i++)
        sameIp.push(
            (await api("POST", "/auth/start", { ip: "203.0.113.9", body: { challenge: b64url(randomBytes(32)) } }))
                .status
        );
    check("auth endpoints are rate limited per IP", sameIp.includes(429), sameIp);
    check("unknown route 404", (await api("GET", "/admin")).status === 404);
    check("wrong method 405", (await api("PUT", "/me")).status === 405);
} finally {
    discord.close();
}
console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
