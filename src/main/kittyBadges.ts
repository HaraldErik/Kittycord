/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2026 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Fake/Custom Badges, main process half.
//
// The Discord login happens in the user's own browser on discord.com, so Kittycord never sees a Discord
// password or token. The server only ever hands back our own session token, which lives here in the main
// process (encrypted with the OS keyring when available) and is never exposed to the Discord page.

import { createHash, randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { app, ipcMain, safeStorage, shell } from "electron";
import { BADGES_API, BadgeLookup, CatalogBadge, KittyBadgesIpc, LoginStatus, MeResponse } from "shared/kittyBadges";

import { validateSender } from "./utils/ipcWrappers";

interface Session {
    token: string;
    expiresAt: number;
    userId: string;
}

const SNOWFLAKE = /^\d{15,21}$/;
const BADGE_ID = /^[a-z0-9_]{1,40}$/;
const SESSION_FILE = () => join(app.getPath("userData"), "kitty-badges-session.bin");

let session: Session | null = null;
let loadedFromDisk = false;
let loginAbort: AbortController | null = null;
let loginInfo: LoginStatus["login"];

function loadSession() {
    if (loadedFromDisk) return;
    loadedFromDisk = true;
    try {
        const file = SESSION_FILE();
        if (!existsSync(file)) return;
        const raw = readFileSync(file);
        const text = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(raw) : raw.toString("utf8");
        const parsed = JSON.parse(text) as Session;
        if (parsed.expiresAt > Date.now() / 1000 && /^[\w-]{43}$/.test(parsed.token)) session = parsed;
    } catch {
        session = null;
    }
}

function saveSession(s: Session | null) {
    session = s;
    const file = SESSION_FILE();
    if (!s) return rmSync(file, { force: true });
    mkdirSync(app.getPath("userData"), { recursive: true });
    const text = JSON.stringify(s);
    writeFileSync(file, safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(text) : text, { mode: 0o600 });
    try {
        chmodSync(file, 0o600);
    } catch {}
}

async function api<T>(method: string, path: string, opts: { body?: unknown; auth?: boolean } = {}) {
    const headers: Record<string, string> = {};
    if (opts.body !== undefined) headers["content-type"] = "application/json";
    if (opts.auth) {
        loadSession();
        if (!session) throw new Error("not_logged_in");
        headers.authorization = `Bearer ${session.token}`;
    }
    const res = await fetch(BADGES_API + path, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: AbortSignal.timeout(10_000),
        redirect: "error"
    });
    if (res.status === 401 && opts.auth) saveSession(null);
    const data = (await res.json().catch(() => null)) as T;
    return { status: res.status, data };
}

const b64url = (b: Buffer) => b.toString("base64url");

async function loginStart() {
    loginAbort?.abort();
    const abort = (loginAbort = new AbortController());

    const verifier = b64url(randomBytes(32));
    const challenge = b64url(createHash("sha256").update(verifier).digest());
    const { status, data } = await api<{ id: string; user_code: string; url: string; expires_in: number }>(
        "POST",
        "/auth/start",
        { body: { challenge } }
    );
    if (status !== 200 || !data) throw new Error("Could not start login");

    // Only ever open a real Discord authorization page that sends the user back to our server
    const url = new URL(data.url);
    if (
        url.origin !== "https://discord.com" ||
        url.pathname !== "/oauth2/authorize" ||
        url.searchParams.get("scope") !== "identify" ||
        !url.searchParams.get("redirect_uri")?.startsWith(`${BADGES_API}/`)
    )
        throw new Error("Unexpected login URL");

    const expiresAt = Math.floor(Date.now() / 1000) + data.expires_in;
    loginInfo = { state: "pending", userCode: data.user_code, expiresAt };
    shell.openExternal(url.toString());

    void (async () => {
        while (!abort.signal.aborted && Date.now() / 1000 < expiresAt) {
            await new Promise(r => setTimeout(r, 2000));
            if (abort.signal.aborted) return;
            try {
                const res = await api<{ status: string; token: string; expires_at: number; user_id: string }>(
                    "POST",
                    "/auth/claim",
                    { body: { id: data.id, verifier } }
                );
                if (res.status === 200 && res.data?.status === "ok") {
                    saveSession({ token: res.data.token, expiresAt: res.data.expires_at, userId: res.data.user_id });
                    loginInfo = undefined;
                    return;
                }
                if (res.status !== 202 && res.status !== 429) break;
            } catch {
                // network blip, keep trying until the request expires
            }
        }
        if (!abort.signal.aborted) loginInfo = { state: "failed", error: "Login expired or failed" };
    })();

    return { userCode: data.user_code, expiresAt };
}

function status(): LoginStatus {
    loadSession();
    return { loggedIn: !!session, userId: session?.userId, login: loginInfo };
}

function handle(event: KittyBadgesIpc, cb: (...args: any[]) => any) {
    ipcMain.handle(event, (e, ...args) => {
        validateSender(e.senderFrame, event);
        return cb(...args);
    });
}

handle(KittyBadgesIpc.LOGIN_START, loginStart);
handle(KittyBadgesIpc.LOGIN_STATUS, status);
handle(KittyBadgesIpc.LOGIN_CANCEL, () => {
    loginAbort?.abort();
    loginInfo = undefined;
});
handle(KittyBadgesIpc.LOGOUT, async () => {
    try {
        await api("POST", "/auth/logout", { auth: true });
    } catch {}
    saveSession(null);
});
handle(KittyBadgesIpc.DELETE_ACCOUNT, async () => {
    const res = await api("DELETE", "/me", { auth: true });
    if (res.status === 200) saveSession(null);
    return res.status === 200;
});
handle(KittyBadgesIpc.ME, async () => {
    const res = await api<MeResponse>("GET", "/me", { auth: true });
    return res.status === 200 ? res.data : null;
});
handle(KittyBadgesIpc.SET, async (action: unknown, badge: unknown) => {
    if ((action !== "add" && action !== "remove") || typeof badge !== "string" || !BADGE_ID.test(badge))
        throw new Error("bad arguments");
    const res = await api<MeResponse>("POST", "/badges", { auth: true, body: { action, badge } });
    return res.status === 200 ? res.data : null;
});
handle(KittyBadgesIpc.LOOKUP, async (users: unknown) => {
    if (!Array.isArray(users) || users.length === 0 || users.length > 50 || !users.every(u => SNOWFLAKE.test(u)))
        throw new Error("bad arguments");
    const res = await api<BadgeLookup>("GET", `/badges?users=${[...new Set(users)].join(",")}`);
    return res.status === 200 ? res.data : {};
});
handle(KittyBadgesIpc.CATALOG, async () => {
    const res = await api<CatalogBadge[]>("GET", "/catalog");
    return res.status === 200 ? res.data : [];
});
