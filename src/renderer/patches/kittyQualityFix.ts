/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2026 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Kitty Quality Stream Fix
//
// Chromium's WebRTC bandwidth estimator starts at ~300 kbps and ramps up slowly. While it is
// "bandwidth limited" the encoder silently scales the stream down, so every stream (yours and the
// ones you watch) starts at 270-540p and takes ~8 s to reach 1080p. Windows' native Discord client
// ships its own WebRTC with a high start bitrate, which is why it doesn't happen there.
// Fix: tell the bandwidth estimator to start high via `x-google-start-bitrate` in the SDP.

import { Logger } from "@equicord/types/utils";
import { Settings } from "renderer/settings";

const logger = new Logger("KittyQualityFix");

// kbps. The estimator still backs off straight away if the connection can't take it.
const START_BITRATE_KBPS = 6000;

const MEDIA_CODECS = new Set(["VP8", "VP9", "H264", "H265", "AV1", "HEVC"]);

export function setVideoStartBitrate(sdp: string, kbps: number): string {
    const nl = sdp.includes("\r\n") ? "\r\n" : "\n";
    const sections = sdp.split(/(?=^m=)/m);

    return sections
        .map(section => {
            if (!section.startsWith("m=video")) return section;

            const lines = section.split(/\r?\n/);
            const pts: string[] = [];
            for (const line of lines) {
                const m = line.match(/^a=rtpmap:(\d+) ([\w-]+)\//);
                if (m && MEDIA_CODECS.has(m[2].toUpperCase())) pts.push(m[1]);
            }

            const hint = `x-google-start-bitrate=${kbps}`;
            for (const pt of pts) {
                const idx = lines.findIndex(l => l.startsWith(`a=fmtp:${pt} `));
                if (idx !== -1) {
                    if (!lines[idx].includes("x-google-start-bitrate")) lines[idx] += `;${hint}`;
                } else {
                    // codecs like VP8 have no fmtp line at all, add one after the rtpmap
                    const rtp = lines.findIndex(l => l.startsWith(`a=rtpmap:${pt} `));
                    lines.splice(rtp + 1, 0, `a=fmtp:${pt} ${hint}`);
                }
            }
            return lines.join(nl);
        })
        .join("");
}

function munge(desc: RTCSessionDescriptionInit | undefined) {
    if (!desc?.sdp || !Settings.store.kittyQualityFix) return desc;
    try {
        return { type: desc.type, sdp: setVideoStartBitrate(desc.sdp, START_BITRATE_KBPS) };
    } catch (e) {
        logger.error("Failed to patch SDP", e);
        return desc;
    }
}

const proto = RTCPeerConnection.prototype;
const { setLocalDescription, setRemoteDescription } = proto;

proto.setLocalDescription = function (desc?: RTCLocalSessionDescriptionInit) {
    return setLocalDescription.call(this, munge(desc) as any);
};
proto.setRemoteDescription = function (desc: RTCSessionDescriptionInit) {
    return setRemoteDescription.call(this, munge(desc) as any);
};
