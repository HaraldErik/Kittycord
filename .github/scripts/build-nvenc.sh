#!/usr/bin/env bash
# Builds the experimental NVENC VA-API driver (MIT, https://github.com/nitkanikita21/nvenc-vaapi-driver) at a
# pinned commit into build/nvenc, which electron-builder ships as <resources>/nvenc.
set -euo pipefail

COMMIT=58fc3427a5b97701a6e70f266c1296fb7782f7c4
WORK="${RUNNER_TEMP:-/tmp}"
OUT="$PWD/build/nvenc"

sudo apt-get install -y libva-dev libclang-dev

git clone https://github.com/nitkanikita21/nvenc-vaapi-driver "$WORK/nvd"
git -C "$WORK/nvd" checkout "$COMMIT"

# The driver's build script wants NVIDIA's SDK libraries just to link. Tiny stand-ins with the real sonames make
# the driver depend on the user's real libnvidia-encode.so.1 (shipped by their NVIDIA driver) at runtime.
STUBS="$WORK/nvstubs"
mkdir -p "$STUBS"
printf 'int NvEncodeAPICreateInstance(void*p){return 1;}\nint NvEncodeAPIGetMaxSupportedVersion(void*p){return 1;}\n' > "$STUBS/enc.c"
echo 'void kc_stub(void){}' > "$STUBS/cuvid.c"
gcc -shared -fPIC -Wl,-soname,libnvidia-encode.so.1 -o "$STUBS/libnvidia-encode.so" "$STUBS/enc.c"
gcc -shared -fPIC -Wl,-soname,libnvcuvid.so.1 -o "$STUBS/libnvcuvid.so" "$STUBS/cuvid.c"

NVIDIA_VIDEO_CODEC_SDK_PATH="$STUBS" cargo build --release --manifest-path "$WORK/nvd/Cargo.toml"

SO="$WORK/nvd/target/release/libnvidia_nvenc_drv_video.so"
readelf -d "$SO" | grep NEEDED
mkdir -p "$OUT"
cp "$SO" "$OUT/nvidia_nvenc_drv_video.so"
cp "$WORK"/nvd/LICENSE* "$OUT/"
ls -la "$OUT"
