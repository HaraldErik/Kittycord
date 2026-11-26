/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2026 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { APPLE_EMOJI_FILES } from "./appleEmojiFiles";
import { registerKittyPlugin } from "./registry";

const PACKAGE_VERSION = "16.0.0";
const BASE_URL = `https://cdn.jsdelivr.net/npm/emoji-datasource-apple@${PACKAGE_VERSION}/img/apple/64/`;

// Lookup key = codepoints without any FE0F variation selector, so Discord's and the package's naming agree
const stripVariation = (codepoints: string) =>
    codepoints
        .split("-")
        .map(cp => parseInt(cp, 16).toString(16)) // "0023" -> "23"
        .filter(cp => cp !== "fe0f")
        .join("-");

let files: Map<string, string> | null = null;

function lookup(surrogate: string): string | null {
    if (!files) {
        files = new Map();
        for (const file of APPLE_EMOJI_FILES.split(" ")) files.set(stripVariation(file), file);
    }

    const key = stripVariation(Array.from(surrogate, c => c.codePointAt(0)!.toString(16)).join("-"));
    const file = files.get(key);
    return file ? `${BASE_URL}${file}.png` : null;
}

// Replaces Discord's emoji image URL function for unicode emoji. Anything Apple has no image for (very new emoji)
// keeps Discord's normal emoji.
registerKittyPlugin({
    name: "AppleEmoji",
    description: "Replaces all emoji images in Discord with Apple's iOS emoji",
    tags: ["Appearance", "Chat"],
    patches: [
        {
            find: '"no emoji for"',
            replacement: {
                match: /(function \i\((\i)\)\{)(if\(\i\.has\(\2\)\)return"";try\{)/,
                replace: "$1const kittyApple=$self.getUrl($2);if(kittyApple)return kittyApple;$3"
            }
        }
    ],
    getUrl: lookup
});
