/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2026 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Replaces the Discord logo on the Home / Direct Messages button (top of the server list) with the Kittycord logo.

export const KITTY_SVG = `<svg width="16" height="16" viewBox="0 0 16 16" version="1.1" xmlns="http://www.w3.org/2000/svg"> <defs> <linearGradient id="kittyGradient" x1="8" y1="0.5" x2="9" y2="15" gradientUnits="userSpaceOnUse"> <stop offset="0" style="stop-color:#e8173c;stop-opacity:1"/> <stop offset="1" style="stop-color:#ff6fbf;stop-opacity:1"/> </linearGradient> <mask id="kittyMask" maskUnits="userSpaceOnUse" x="0" y="0" width="16" height="16"> <path d="M 2.5,6.2 L 2.0,1.0 L 6.0,3.9 Z" fill="#fff" stroke="#fff" stroke-width="0.5" stroke-linejoin="round"/> <path d="M 13.5,6.2 L 14.0,1.0 L 10.0,3.9 Z" fill="#fff" stroke="#fff" stroke-width="0.5" stroke-linejoin="round"/> <path transform="translate(8 9.2) scale(0.8) translate(-8 -8.2)" fill="#fff" d="m 10.930026,12.868486 c 0.97359,-0.319091 1.81374,-0.813894 2.46664,-1.695064 -3.57376,2.156012 -7.10904,2.09 -10.676021,0.01496 0.29103,0.433488 0.641477,0.762823 1.050544,1.010021 0.407856,0.246489 0.840667,0.447868 1.277207,0.676773 -0.18826,0.245373 -0.41157,0.501925 -0.59557,0.786183 -0.175147,0.270848 -0.373721,0.365724 -0.693798,0.326872 -1.206061,-0.146313 -2.290283,-0.565316 -3.18932202,-1.441714 -0.02604,-0.02548 -0.05053,-0.05267 -0.077,-0.07753 -0.367034,-0.345088 -0.520259,-0.730265 -0.48868,-1.287426 0.149332,-2.6374045 0.779676,-5.1328065 1.88324502,-7.50301 0.05409,-0.1161858 0.14648,-0.2280129 0.247564,-0.302887 0.881557,-0.6532335 1.848341,-1.1044529 2.917681,-1.2994999 0.20409,-0.037255 0.41123,-0.06515 0.61793,-0.074721 0.0845,-0.00392 0.17068,0.052561 0.25426,0.1157013 C 4.653936,2.560616 3.446294,3.0949082 2.384227,3.9876628 6.033766,2.1727979 9.662026,2.082985 13.300476,3.9416638 c -0.97261,-0.8205282 -2.09699,-1.3290016 -3.27327,-1.7308285 0.0876,-0.188602 0.21038,-0.2248839 0.39822,-0.2066316 1.27298,0.1234869 2.40973,0.6119581 3.44732,1.3718026 0.0975,0.071298 0.18831,0.1760858 0.24075,0.2867207 0.80512,1.7015865 1.34778,3.4919755 1.65542,5.3620855 0.14291,0.869213 0.21646,1.7444605 0.23103,2.6247765 0.002,0.123747 -0.0486,0.271224 -0.12134,0.370125 -0.67797,0.918307 -1.58168,1.485493 -2.64573,1.769194 -0.41106,0.109558 -0.83968,0.14856 -1.26172,0.209166 -0.0651,0.0092 -0.16431,-0.015 -0.20348,-0.06307 -0.28109,-0.343938 -0.55065,-0.69797 -0.83764,-1.066457 z m -5.63706,-2.351724 c 0.46648,-0.0013 0.74307,-0.10434 0.98586,-0.314845 0.39681,-0.3443485 0.54482,-0.7979915 0.57539,-1.3246055 0.0342,-0.588902 -0.18492,-1.026935 -0.65359,-1.325763 -0.48351,-0.30825 -0.98883,-0.333729 -1.4782,-0.0131 -0.785522,0.51462 -0.933074,1.738722 -0.30803,2.4764055 0.27349,0.322743 0.61327,0.498493 0.87857,0.501918 z m 5.1491,0.02271 c 0.16035,-0.03842 0.32823,-0.05669 0.47989,-0.118536 0.93599,-0.381226 1.23401,-1.6931665 0.58684,-2.5579105 -0.50437,-0.673794 -1.44402,-0.734516 -2.01859,-0.124232 -0.38011,0.403613 -0.49867,0.897412 -0.43384,1.449992 0.0859,0.732393 0.69985,1.3247575 1.3857,1.3506865 z"/> <g stroke="#000" stroke-width="0.45" stroke-linecap="round" fill="none"> <path d="M 6.3,10.75 Q 4.6,10.35 2.9,10.55"/> <path d="M 6.3,11.4 Q 4.7,11.4 3.2,11.85"/> <path d="M 9.7,10.75 Q 11.4,10.35 13.1,10.55"/> <path d="M 9.7,11.4 Q 11.3,11.4 12.8,11.85"/> </g> <path d="M 7.25,10.55 L 8.75,10.55 L 8,11.35 Z" fill="#000" stroke="#000" stroke-width="0.3" stroke-linejoin="round"/> </mask> </defs> <rect x="0" y="0" width="16" height="16" fill="url(#kittyGradient)" mask="url(#kittyMask)"/> <path d="M 3.1,4.9 L 2.85,2.3 L 4.8,3.75 Z" fill="#ffb3dc" fill-opacity="0.9" stroke="#ffb3dc" stroke-width="0.3" stroke-linejoin="round"/> <path d="M 12.9,4.9 L 13.15,2.3 L 11.2,3.75 Z" fill="#ffb3dc" fill-opacity="0.9" stroke="#ffb3dc" stroke-width="0.3" stroke-linejoin="round"/> </svg>`;

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
