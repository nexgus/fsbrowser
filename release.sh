#!/usr/bin/env bash
# release.sh: 建置前端套件, 打包為單一 npm tarball, 上傳 GitHub 並建立 release.
#
# 用法: ./release.sh
#   版本取自 frontend/ 下四個 package.json 的 version, 必須彼此一致 (以
#   npmver.sh 統一修改). 打包產物為 bin/fsbrowser.npm.{版本}+{hash}.tar.gz;
#   工作區有未 commit 變更時檔名加上 -dirty, 且一律不可 release. 預發布版本
#   (帶 semver 預發布尾碼) 亦不可 release, 因為 release 對應的 commit 必須是
#   正式版本. 不可 release 時本腳本仍會留下 tarball 供本機測試使用.
set -euo pipefail
cd "$(dirname "$0")"

FORGECTL=(forgectl -s github)
PROJECT=nexgus/fsbrowser
PACKAGES=(core locales react vue3)

die() { echo "release.sh: $*" >&2; exit 1; }

# 版本: 取自四個 package.json, 檢查一致.
VER=""
for pkg in "${PACKAGES[@]}"; do
    v=$(node -p "require('./frontend/${pkg}/package.json').version")
    if [ -z "$VER" ]; then
        VER="$v"
    elif [ "$VER" != "$v" ]; then
        die "套件版本不一致 (${pkg} 為 ${v}, 先前為 ${VER}); 請先以 npmver.sh 統一"
    fi
done

HASH=$(git rev-parse --short HEAD)
DIRTY=""
[ -z "$(git status --porcelain)" ] || DIRTY="-dirty"

# 建置: locales 僅含原始碼故無建置步驟; npm 依賴比照 build.sh, 僅在
# node_modules 不存在時安裝一次.
for pkg in core react vue3; do
    (cd "frontend/${pkg}" \
        && { [ -d node_modules ] || npm install; } \
        && npm run typecheck && npm run build)
done

# 打包: 以 npm pack 取得各套件的發佈內容 (僅含 package.json files 欄位所列),
# 同層展開為 core/ locales/ react/ vue3/, 使 file:../core 依賴在解壓後直接有效.
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
ROOT="fsbrowser-npm-${VER}"
mkdir -p "${STAGE}/${ROOT}"
for pkg in "${PACKAGES[@]}"; do
    tgz=$(cd "frontend/${pkg}" && npm pack --pack-destination "$STAGE" | tail -n 1)
    mkdir "${STAGE}/${ROOT}/${pkg}"
    tar -xzf "${STAGE}/${tgz}" -C "${STAGE}/${ROOT}/${pkg}" --strip-components 1
done

mkdir -p bin
TARBALL="bin/fsbrowser.npm.${VER}+${HASH}${DIRTY}.tar.gz"
tar -czf "$TARBALL" -C "$STAGE" "$ROOT"
echo "已打包 ${TARBALL}"

# release 前置檢查: dirty 與預發布版本不可 release.
[ -z "$DIRTY" ] || die "工作區有未 commit 變更, ${TARBALL} 不可 release"
echo "$VER" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$' \
    || die "版本 ${VER} 非正式版本, 不可 release"

NOTE="docs/releases/v${VER}.md"
[ -f "$NOTE" ] || die "缺少 release note: $NOTE"

echo "即將 release v${VER} (commit ${HASH})"
"${FORGECTL[@]}" asset upload "$PROJECT" "v${VER}" "$TARBALL"
"${FORGECTL[@]}" release create "$PROJECT" "v${VER}" -n "$NOTE" -c latest
git pull --tags
