// Rebrands the upstream Equibop package.json as Kittycord at build time.
// Keeping this out of the source tree means upstream merges never conflict on package.json.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));

pkg.name = "kittycord";
pkg.desktopName = "kittycord";
pkg.description = "Kittycord is a custom Discord desktop app (fork of Equibop)";
pkg.homepage = "https://github.com/HaraldErik/Kittycord";
pkg.author = "HaraldErik <191792037+HaraldErik@users.noreply.github.com>";

const b = pkg.build;
b.appId = "io.github.haralderik.kittycord";
b.productName = "Kittycord";
b.executableName = "kittycord";
b.publish = { provider: "github", owner: "HaraldErik", repo: "Kittycord" };

// pacman release number: bumps on every build so pacman/yay see a newer package even when upstream's version didn't change
b.pacman = { ...b.pacman, fpm: [...(b.pacman?.fpm ?? []), `--iteration=${process.env.KITTY_REL || 1}`] };

b.linux.icon = "build/icon.png";
b.linux.maintainer = "HaraldErik <191792037+HaraldErik@users.noreply.github.com>";
b.linux.target = [
    { target: "AppImage", arch: ["x64"] },
    { target: "pacman", arch: ["x64"] },
    { target: "tar.gz", arch: ["x64"] }
];
Object.assign(b.linux.desktop.entry, {
    Name: "Kittycord",
    Keywords: "discord;vencord;equicord;electron;chat;kittycord",
    StartupWMClass: "kittycord"
});

writeFileSync("package.json", JSON.stringify(pkg, null, 4) + "\n");
console.log(`Branded as ${pkg.name} ${pkg.version}`);

// Rebrand user-visible "Equibop" text at build time (not in git, so upstream merges never conflict).
// \bEquibop\b skips identifiers (DefaultEquibopSettings, EquibopState...). Lowercase `equibop` (protocol scheme,
// loader dir, storage keys) is functional and left alone, as are URLs (preceded by "/") and the patch owner name.
const SKIP = new Set(["src/renderer/patches/shared.ts"]);
function walk(dir) {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(tsx?|html)$/.test(name) && !SKIP.has(path.replaceAll("\\", "/"))) {
            const text = readFileSync(path, "utf8");
            const out = text.replace(/(?<![/\w.-])Equibop\b(?!\.exe|[\w.-]*:\/\/)/g, "Kittycord");
            if (out !== text) writeFileSync(path, out);
        }
    }
}
walk("src");

// Linux autostart entry: its file name and icon name must match the installed app
const autoStart = "src/main/autoStart.ts";
writeFileSync(
    autoStart,
    readFileSync(autoStart, "utf8")
        .replace("equibop.desktop", "kittycord.desktop")
        .replace("Icon=equibop", "Icon=kittycord")
);

walk("static/views");
console.log("Rebranded source text");
