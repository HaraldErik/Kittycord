/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2026 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Registers Kittycord's own plugins in Equicord's Plugins tab, with the Kittycord icon as their source badge
// (like the Vencord / Equicord icons on their plugins).
//
// Equicord's plugin list is compiled into the separately downloaded Equicord bundle, so we add to its live
// registry at startup. main/utils/patchEquicordRenderer.ts exposes the private PluginMeta object and adds the
// icon; if Equicord's code ever changes so that fails, the plugins are skipped instead of breaking the tab.

import { Logger } from "@equicord/types/utils";

const logger = new Logger("KittyPlugins");

interface KittyPluginDef {
    name: string;
    description: string;
    tags?: string[];
    patches?: any[];
    start?(): void;
    stop?(): void;
    settings?: any;
    [key: string]: any;
}

export function registerKittyPlugin(def: KittyPluginDef) {
    const { Plugins } = Vencord;
    const plugins = Plugins.plugins as Record<string, any>;
    const meta = (globalThis as any).__kittycordPluginMeta as Record<string, unknown> | undefined;

    if (!meta) return logger.warn(`Not registering ${def.name}: Equicord's plugin metadata isn't reachable`);
    if (plugins[def.name]) return logger.warn(`${def.name} is already registered`);

    // The author id is falsy on purpose: Equicord then shows a plain "Kittycord" author instead of looking up a user
    const plugin = { authors: [{ name: "Kittycord", id: 0n }], ...def };

    meta[def.name] = { folderName: `src/kittycordplugins/${def.name}`, userPlugin: true };
    plugins[def.name] = plugin;

    // Equicord already ran its own patch setup, so enabled plugins have to add their patches themselves.
    if (Plugins.isPluginEnabled(def.name)) {
        for (const patch of plugin.patches ?? []) Plugins.addPatch(patch, def.name);
    }
}
