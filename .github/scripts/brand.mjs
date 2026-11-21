// Rebrands the upstream Equibop package.json as Kittycord at build time.
// Keeping this out of the source tree means upstream merges never conflict on package.json.
import { readFileSync, writeFileSync } from "node:fs";

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
