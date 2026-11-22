/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2026 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { SettingsComponent } from "./Settings";
import { VesktopSettingsSwitch } from "./VesktopSettingsSwitch";

export const KittyNvencToggle: SettingsComponent = ({ settings }) => {
    // Linux only: it relies on VA-API
    if (!navigator.userAgent.includes("Linux")) return null;

    const hasDriver = VesktopNative.app.hasNvencDriver();

    return (
        <VesktopSettingsSwitch
            title="NVIDIA NVENC Encoding (Experimental)"
            description={
                "EXPERIMENTAL, off by default. Encodes your screenshare on your NVIDIA GPU's dedicated video encoder " +
                "instead of the CPU, which can lower the FPS hit while gaming. Uses an alpha-quality driver, so streams " +
                "may fail to start, freeze or look wrong. If that happens, turn this off. Requires an NVIDIA GPU, " +
                "Hardware Acceleration and a restart." +
                (hasDriver ? "" : " The NVENC driver was not found in this install, so this setting does nothing.")
            }
            disabled={!settings.hardwareAcceleration}
            value={settings.kittyNvenc}
            onChange={v => (settings.kittyNvenc = v)}
        />
    );
};
