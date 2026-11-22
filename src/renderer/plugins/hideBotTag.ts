/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2026 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { registerKittyPlugin } from "./registry";

// Hides the "APP" / "BOT" tag next to bots (messages, member list, profiles).
// The patch makes Discord's tag component render nothing when its type is BOT.
registerKittyPlugin({
    name: "HideBotTag",
    description: "Hides the APP/BOT tag on Discord bots",
    tags: ["Appearance", "Chat"],
    patches: [
        {
            find: ".STAFF_ONLY_DM:",
            replacement: {
                match: /(?<=type:\i.*?)\.BOT:(?=default:)/,
                replace: "$&return null;"
            }
        }
    ]
});
