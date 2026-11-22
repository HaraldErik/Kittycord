/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2026 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Replaces the Discord logo on the Home / Direct Messages button (top of the server list) with the Kittycord logo.

import { KITTY_SVG } from "shared/kittyLogo";

export { KITTY_SVG };

const HOME_BUTTON = '[data-list-item-id="guildsnav___home"]';

const css = `
${HOME_BUTTON} [class*="childWrapper"] {
    background-image: url("data:image/svg+xml,${encodeURIComponent(KITTY_SVG)}") !important;
    background-repeat: no-repeat !important;
    background-position: center !important;
    background-size: 75% !important;
}
${HOME_BUTTON} [class*="childWrapper"] svg {
    opacity: 0 !important;
}
`;

function inject() {
    const style = document.createElement("style");
    style.id = "kittycord-home-icon";
    style.textContent = css;
    document.head.append(style);
}

if (document.head) inject();
else document.addEventListener("DOMContentLoaded", inject, { once: true });
