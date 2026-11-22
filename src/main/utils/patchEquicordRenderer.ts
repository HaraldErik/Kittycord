/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2026 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Small, optional rewrites of Equicord's downloaded renderer script so Kittycord's own plugins can show up in
// the Plugins tab with the Kittycord icon. Every rewrite is independent and silently skipped if Equicord's
// (minified) code no longer matches, in which case Kittycord's plugins just don't register.

import { KITTY_ICON } from "shared/kittyLogo";

export function patchEquicordRenderer(source: string) {
    let out = source;

    // 1. Expose Equicord's private PluginMeta object (the Plugins tab crashes for plugins missing from it)
    out = out.replace(
        /([\w$]+)=\{(\[[\w$]+\.name\]:\{folderName:")/,
        (_, name, rest) => `${name}=globalThis.__kittycordPluginMeta={${rest}`
    );

    // 2. Plugin card source badge: add the Kittycord icon for plugins from src/kittycordplugins
    const card = out.match(/([\w$]+)\.folderName\.startsWith\("src\/plugins\/"\)\?\?!1/);
    if (card) {
        out = out.replace(
            /\{condition:[\w$]+,src:"https:\/\/equicord\.org\/assets\/favicon\.png",alt:"Equicord",title:"Equicord Plugin"\}/,
            entry =>
                `{condition:${card[1]}.folderName.startsWith("src/kittycordplugins/"),src:globalThis.__kittycordIcon,alt:"Kittycord",title:"Kittycord Plugin"},${entry}`
        );
    }

    return `globalThis.__kittycordIcon=${JSON.stringify(KITTY_ICON)};${out}`;
}
