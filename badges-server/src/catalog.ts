// The fixed badge catalog. Users can only pick from this list; nothing else is ever accepted or stored.
// `icon` is a hash on Discord's badge-icons CDN, or "kitty" for the bundled Kittycord logo.

export interface CatalogBadge {
    id: string;
    name: string;
    icon: string;
    /** Discord public_flags bit that proves ownership, if Discord exposes one */
    flag?: number;
    /** Premium (Nitro) badge, proven by premium_type */
    premium?: boolean;
    /** Granted to every logged-in Kittycord user */
    kitty?: boolean;
}

export const CATALOG: readonly CatalogBadge[] = [
    { id: "kitty", name: "Kittycord", icon: "kitty", kitty: true },
    { id: "staff", name: "Discord Staff", icon: "5e74e9b61934fc1f67c65515d1f7e60d", flag: 1 << 0 },
    { id: "partner", name: "Partnered Server Owner", icon: "3f9748e53446a137a052f3454e2de41e", flag: 1 << 1 },
    {
        id: "certified_moderator",
        name: "Moderator Programs Alumni",
        icon: "fee1624003e2fee35cb398e125dc479b",
        flag: 1 << 18
    },
    { id: "hypesquad", name: "HypeSquad Events", icon: "bf01d1073931f921909045f3a39fd264", flag: 1 << 2 },
    { id: "hypesquad_house_1", name: "HypeSquad Bravery", icon: "8a88d63823d8a71cd5e390baa45efa02", flag: 1 << 6 },
    { id: "hypesquad_house_2", name: "HypeSquad Brilliance", icon: "011940fd013da3f7fb926e4a1cd2e618", flag: 1 << 7 },
    { id: "hypesquad_house_3", name: "HypeSquad Balance", icon: "3aa41de486fa12454c3761e8e223442e", flag: 1 << 8 },
    { id: "bug_hunter_level_1", name: "Discord Bug Hunter", icon: "2717692c7dca7289b35297368a940dd0", flag: 1 << 3 },
    {
        id: "bug_hunter_level_2",
        name: "Discord Bug Hunter (Gold)",
        icon: "848f79194d4be5ff5f81505cbd0ce1e6",
        flag: 1 << 14
    },
    { id: "active_developer", name: "Active Developer", icon: "6bdc42827a38498929a4920da12695d9", flag: 1 << 22 },
    {
        id: "verified_developer",
        name: "Early Verified Bot Developer",
        icon: "6df5892e0f35b051f8b61eace34f4967",
        flag: 1 << 17
    },
    { id: "early_supporter", name: "Early Supporter", icon: "7060786766c9c840eb3019e725d2b358", flag: 1 << 9 },
    { id: "premium", name: "Nitro Subscriber", icon: "2ba85e8026a8614b640c2837bcdfe21b", premium: true },
    // Discord doesn't expose these, so they can never be verified: always shown as "custom"
    { id: "guild_booster_lvl1", name: "Server Booster (1 month)", icon: "51040c70d4f20a921ad6674ff86fc95c" },
    { id: "guild_booster_lvl2", name: "Server Booster (2 months)", icon: "0e4080d1d333bc7ad29ef6528b6f2fb7" },
    { id: "guild_booster_lvl3", name: "Server Booster (3 months)", icon: "72bed924410c304dbe3d00a6e593ff59" },
    { id: "guild_booster_lvl4", name: "Server Booster (6 months)", icon: "df199d2050d3ed4ebf84d64ae83989f8" },
    { id: "guild_booster_lvl5", name: "Server Booster (9 months)", icon: "996b3e870e8a22ce519b3a50e6bdd52f" },
    { id: "guild_booster_lvl6", name: "Server Booster (1 year)", icon: "991c9f39ee33d7537d9f408c3e53141e" },
    { id: "guild_booster_lvl7", name: "Server Booster (1 year 3 months)", icon: "cb3ae83c15e970e8f3d410bc62cb8b99" },
    { id: "guild_booster_lvl8", name: "Server Booster (1 year 6 months)", icon: "7142225d31238f6387d9f09efaa02759" },
    { id: "guild_booster_lvl9", name: "Server Booster (2 years)", icon: "ec92202290b48d0879b7413d2dde3bab" },
    { id: "legacy_username", name: "Originally known as a legacy username", icon: "6de6d34650760ba5551a79732e98ed60" },
    { id: "quest_completed", name: "Completed a Quest", icon: "7d9ae358c8c5e118768335dbe68b4fb8" }
];

const BY_ID = new Map(CATALOG.map(b => [b.id, b]));

export function getBadge(id: string) {
    return BY_ID.get(id);
}

/** True if the badge can be proven from what Discord tells us about the user. */
export function isVerified(badge: CatalogBadge, publicFlags: number, premiumType: number) {
    if (badge.kitty) return true;
    if (badge.premium) return premiumType > 0;
    if (badge.flag) return (publicFlags & badge.flag) !== 0;
    return false;
}
