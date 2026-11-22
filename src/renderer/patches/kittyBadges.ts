/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2026 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Fake/Custom Badges: shows other Kittycord users' chosen badges on their profile.
// Lookups go through the main process (it talks to our badge server); see main/kittyBadges.ts.

import { Logger } from "@equicord/types/utils";
import { Settings } from "renderer/settings";
import { BadgeLookup, CatalogBadge, MeResponse } from "shared/kittyBadges";

import { KITTY_SVG } from "./kittyBranding";

const logger = new Logger("KittyBadges");

const CDN = "https://cdn.discordapp.com/badge-icons/";
const ICON_HASH = /^[0-9a-f]{32}$/;
const KITTY_ICON = `data:image/svg+xml,${encodeURIComponent(KITTY_SVG)}`;

const FRESH_MS = 60_000;
const RETRY_MS = 15_000;
const BATCH_MAX = 50;

let catalog = new Map<string, CatalogBadge>();
let catalogRequested = false;

interface Entry {
    badges: [string, 0 | 1][];
    expires: number;
}
const cache = new Map<string, Entry>();
const queued = new Set<string>();
const inflight = new Set<string>();
let timer: ReturnType<typeof setTimeout> | undefined;

function emitChange() {
    try {
        Vencord.Webpack.findStore("UserProfileStore")?.emitChange();
    } catch (e) {
        logger.error("Failed to refresh profiles", e);
    }
}

function iconFor(badge: CatalogBadge) {
    if (badge.icon === "kitty") return KITTY_ICON;
    // the server can only pick from Discord's own badge icon CDN
    return ICON_HASH.test(badge.icon) ? `${CDN}${badge.icon}.png` : undefined;
}

async function loadCatalog() {
    if (catalogRequested) return;
    catalogRequested = true;
    try {
        const list = await VesktopNative.kittyBadges.catalog();
        catalog = new Map(list.map(b => [b.id, b]));
        emitChange();
    } catch (e) {
        catalogRequested = false;
        logger.error("Failed to load badge catalog", e);
    }
}

async function flush() {
    timer = undefined;
    const ids = [...queued].slice(0, BATCH_MAX);
    ids.forEach(id => (queued.delete(id), inflight.add(id)));

    try {
        const res: BadgeLookup = await VesktopNative.kittyBadges.lookup(ids);
        const expires = Date.now() + FRESH_MS;
        for (const id of ids) cache.set(id, { badges: res[id] ?? [], expires });
        emitChange();
    } catch (e) {
        logger.error("Badge lookup failed", e);
        for (const id of ids) cache.set(id, { badges: [], expires: Date.now() + RETRY_MS });
    } finally {
        ids.forEach(id => inflight.delete(id));
    }

    if (queued.size) timer = setTimeout(flush, 100);
}

function request(userId: string) {
    if (queued.has(userId) || inflight.has(userId)) return;
    queued.add(userId);
    timer ??= setTimeout(flush, 100);
}

/** Called after the user changes their own badges so their profile updates immediately. */
export function setOwnBadges(me: MeResponse) {
    cache.set(me.user_id, {
        badges: me.badges.map(b => [b.id, b.verified ? 1 : 0]),
        expires: Date.now() + FRESH_MS
    });
    emitChange();
}

Vencord.Api.Badges.addProfileBadge({
    id: "kittycord-badges",
    shouldShow: () => Settings.store.kittyBadges,
    getBadges({ userId }) {
        if (!userId) return [];
        if (catalog.size === 0) void loadCatalog();

        const entry = cache.get(userId);
        if (!entry || entry.expires < Date.now()) request(userId);
        if (!entry) return [];

        return entry.badges.flatMap(([id, verified]) => {
            const badge = catalog.get(id);
            const iconSrc = badge && iconFor(badge);
            if (!badge || !iconSrc) return [];
            return {
                id: `kittycord-${id}`,
                description: verified ? badge.name : `${badge.name} (custom)`,
                iconSrc
            };
        });
    }
});
