/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2026 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button, Heading, Paragraph, Text } from "@equicord/types/components";
import { Margins } from "@equicord/types/utils";
import { showToast, useEffect, useState } from "@equicord/types/webpack/common";
import type { CatalogBadge, LoginStatus, MeResponse } from "shared/kittyBadges";

import { setOwnBadges } from "../../patches/kittyBadges";
import { SimpleErrorBoundary } from "../SimpleErrorBoundary";
import { SettingsComponent } from "./Settings";
import { VesktopSettingsSwitch } from "./VesktopSettingsSwitch";

const CDN = "https://cdn.discordapp.com/badge-icons/";

export const KittyBadgesSettings: SettingsComponent = ({ settings }) => {
    const [status, setStatus] = useState<LoginStatus>({ loggedIn: false });
    const [me, setMe] = useState<MeResponse | null>(null);
    const [catalog, setCatalog] = useState<CatalogBadge[]>([]);
    const [busy, setBusy] = useState(false);

    const refreshStatus = async () => setStatus(await VesktopNative.kittyBadges.loginStatus());

    useEffect(() => {
        void refreshStatus();
        VesktopNative.kittyBadges.catalog().then(setCatalog, () => {});
        // while a browser login is pending, keep checking
        const t = setInterval(refreshStatus, 1500);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        if (!status.loggedIn) return setMe(null);
        VesktopNative.kittyBadges.me().then(m => {
            setMe(m);
            if (m) setOwnBadges(m);
        });
    }, [status.loggedIn]);

    const run = async (fn: () => Promise<unknown>, error: string) => {
        setBusy(true);
        try {
            await fn();
        } catch {
            showToast({ text: error, variant: "critical" });
        } finally {
            setBusy(false);
            void refreshStatus();
        }
    };

    const update = async (action: "add" | "remove", badge: string) => {
        const next = await VesktopNative.kittyBadges.set(action, badge);
        if (!next) throw new Error("failed");
        setMe(next);
        setOwnBadges(next);
    };

    const toggle = (id: string, on: boolean) => run(() => update(on ? "add" : "remove", id), "Couldn't update badges");

    const addReal = () =>
        run(async () => {
            for (const id of me?.available ?? []) {
                if (!me?.badges.some(b => b.id === id)) await update("add", id);
            }
        }, "Couldn't add badges");

    return (
        <SimpleErrorBoundary>
            <div>
                <VesktopSettingsSwitch
                    title="Show Kitty Badges"
                    description="Show other Kittycord users' custom badges on profiles. Looks up the profiles you view on the Kittycord badge server (it only sees user IDs)."
                    value={settings.kittyBadges}
                    onChange={v => (settings.kittyBadges = v)}
                />

                {!status.loggedIn && (
                    <>
                        <Paragraph className={Margins.bottom8}>
                            Log in with Discord to choose your own badges. The login happens on discord.com in your
                            browser, Kittycord and its server never see your password or Discord token.
                        </Paragraph>
                        {status.login?.state === "pending" ? (
                            <>
                                <Heading tag="h5" className={Margins.bottom8}>
                                    Your code: {status.login.userCode}
                                </Heading>
                                <Paragraph className={Margins.bottom8}>
                                    Approve the login in your browser, then type this code on the page that opens. Don't
                                    type a code someone else gave you.
                                </Paragraph>
                                <Button onClick={() => run(() => VesktopNative.kittyBadges.loginCancel(), "Error")}>
                                    Cancel
                                </Button>
                            </>
                        ) : (
                            <>
                                {status.login?.state === "failed" && (
                                    <Paragraph className={Margins.bottom8}>{status.login.error}</Paragraph>
                                )}
                                <Button
                                    disabled={busy}
                                    onClick={() =>
                                        run(() => VesktopNative.kittyBadges.loginStart(), "Couldn't start login")
                                    }
                                >
                                    Log in with Discord
                                </Button>
                            </>
                        )}
                    </>
                )}

                {status.loggedIn && (
                    <>
                        <Paragraph className={Margins.bottom8}>
                            Logged in. Badges marked (custom) aren't backed by your real Discord account and are shown
                            to other Kittycord users with a "(custom)" label.
                        </Paragraph>
                        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                            <Button disabled={busy || !me} onClick={addReal}>
                                Add all my real badges
                            </Button>
                            <Button
                                disabled={busy}
                                onClick={() => run(() => VesktopNative.kittyBadges.logout(), "Error")}
                            >
                                Log out
                            </Button>
                            <Button
                                disabled={busy}
                                variant="dangerPrimary"
                                onClick={() =>
                                    run(async () => {
                                        if (await VesktopNative.kittyBadges.deleteAccount())
                                            showToast({ text: "Your badge data was deleted", variant: "success" });
                                    }, "Couldn't delete")
                                }
                            >
                                Delete my data
                            </Button>
                        </div>
                        {catalog.map(badge => {
                            const owned = me?.badges.some(b => b.id === badge.id) ?? false;
                            const real = me?.available.includes(badge.id) ?? false;
                            return (
                                <VesktopSettingsSwitch
                                    key={badge.id}
                                    disabled={busy || !me}
                                    title={
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                            {/^[0-9a-f]{32}$/.test(badge.icon) && (
                                                <img src={`${CDN}${badge.icon}.png`} width={22} height={22} alt="" />
                                            )}
                                            {badge.name}
                                            <Text size="xs" color="text-muted">
                                                {real ? "(verified)" : "(custom)"}
                                            </Text>
                                        </span>
                                    }
                                    value={owned}
                                    onChange={v => toggle(badge.id, v)}
                                />
                            );
                        })}
                    </>
                )}
            </div>
        </SimpleErrorBoundary>
    );
};
