/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2026 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Experimental NVIDIA NVENC screenshare encoding on Linux.
//
// Chromium can only hardware-encode through VA-API, and NVIDIA has no VA-API encoder. We ship a small VA-API
// driver that forwards to NVENC (https://github.com/nitkanikita21/nvenc-vaapi-driver, MIT, alpha quality), built
// by CI into <resources>/nvenc. It is only used when the "NVIDIA NVENC" setting is enabled.

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const NVENC_DRIVER_NAME = "nvidia_nvenc";
const DRIVER_FILE = `${NVENC_DRIVER_NAME}_drv_video.so`;

/** Directory containing the NVENC VA-API driver, or null if it isn't installed. */
export function findNvencDriverDir(): string | null {
    if (process.platform !== "linux") return null;

    const candidates = [join(process.resourcesPath ?? "", "nvenc"), join(homedir(), ".local", "lib", "dri")];
    return candidates.find(dir => existsSync(join(dir, DRIVER_FILE))) ?? null;
}
