/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2026 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Shared between main, preload and renderer for Fake/Custom Badges.

export const BADGES_API = "https://kittycord-badges.kittycord.workers.dev";

export const enum KittyBadgesIpc {
    LOGIN_START = "KITTY_BADGES_LOGIN_START",
    LOGIN_STATUS = "KITTY_BADGES_LOGIN_STATUS",
    LOGIN_CANCEL = "KITTY_BADGES_LOGIN_CANCEL",
    LOGOUT = "KITTY_BADGES_LOGOUT",
    ME = "KITTY_BADGES_ME",
    SET = "KITTY_BADGES_SET",
    LOOKUP = "KITTY_BADGES_LOOKUP",
    CATALOG = "KITTY_BADGES_CATALOG",
    DELETE_ACCOUNT = "KITTY_BADGES_DELETE_ACCOUNT"
}

export interface CatalogBadge {
    id: string;
    name: string;
    /** hash on Discord's badge-icons CDN, or "kitty" */
    icon: string;
    flag?: number;
    premium?: boolean;
    kitty?: boolean;
}

export interface MyBadge {
    id: string;
    verified: boolean;
}

export interface MeResponse {
    user_id: string;
    badges: MyBadge[];
    available: string[];
}

export interface LoginStatus {
    loggedIn: boolean;
    userId?: string;
    login?: {
        state: "pending" | "failed";
        userCode?: string;
        expiresAt?: number;
        error?: string;
    };
}

/** user id -> [badge id, verified (1) or custom (0)][] */
export type BadgeLookup = Record<string, [string, 0 | 1][]>;
