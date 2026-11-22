/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2026 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Kitty Performance Fix
//
// On Linux the browser encodes screenshares in software (no NVENC/hardware path in Chromium on NVIDIA),
// and the encoder runs on the same CPU your game needs. Measured on this machine, 1080p60:
//   VP9 ~10 ms/frame, H264 ~6 ms/frame, VP8 ~5 ms/frame (VP9 also needs ~60% more total CPU).
// So: don't let Discord pick VP9/AV1/H265 for encoding, and don't ask the screen capturer for more
// frames than the stream is set to (every captured frame costs a compositor copy on Wayland).

import { Logger } from "@equicord/types/utils";
import { Settings, State } from "renderer/settings";

import { addPatch } from "./shared";

const logger = new Logger("KittyPerformanceFix");

const EXPENSIVE_CODECS = new Set(["AV1", "H265", "VP9"]);

addPatch({
    patches: [
        {
            find: "lastOverrideCodecDenylist.length",
            replacement: {
                match: /(let \i=)(\i\(\i\))(?=,\i=this\.lastOverrideCodecDenylist\.length)/,
                replace: "$1$self.preferCheapCodecs($2)"
            }
        }
    ],

    preferCheapCodecs(codecs: { name: string; encode: boolean }[]) {
        if (!Settings.store.kittyPerformanceFix) return codecs;
        try {
            const filtered = codecs.map(c => (EXPENSIVE_CODECS.has(c.name) ? { ...c, encode: false } : c));
            // never leave Discord without any encoder
            return filtered.some(c => c.encode) ? filtered : codecs;
        } catch (e) {
            logger.error("Failed to filter codecs", e);
            return codecs;
        }
    }
});

// Cap the frame rate the screen capturer is opened with to the stream's frame rate.
const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia;
navigator.mediaDevices.getDisplayMedia = function (opts) {
    try {
        if (Settings.store.kittyPerformanceFix && opts && typeof opts.video === "object") {
            const fps = Number(State.store.screenshareQuality?.frameRate ?? 60) || 60;
            opts.video = { ...opts.video, frameRate: { ideal: fps, max: fps } };
        }
    } catch (e) {
        logger.error("Failed to cap capture frame rate", e);
    }
    return originalGetDisplayMedia.call(this, opts);
};
