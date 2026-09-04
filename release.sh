#!/usr/bin/env bash
# release.sh: 建置前端套件, 打包為單一 npm tarball, 上傳 GitHub 並建立 release.
#
# 用法: ./release.sh
#   版本取自 frontend/ 下四個 package.json 的 version, 必須彼此一致 (以
#   npmver.sh 統一修改, 亦可執行不帶參數的 npmver.sh 查詢目前版本).
#   Go 端的兩個子目錄 module 另以 fsb/v{版本} 與 fsdrv/v{版本} 兩個前綴 tag
#   發佈, 前綴為 Go 解析子目錄 module 的必要條件, 缺少時外部專案無法 go get.
#   打包產物為 bin/fsbrowser.npm.{版本}+{hash}.tar.gz;
#   工作區有未 commit 變更時檔名加上 -dirty, 且一律不可 release. 預發布版本
#   (帶 semver 預發布尾碼) 亦不可 release, 因為 release 對應的 commit 必須是
#   正式版本. 不可 release 時本腳本仍會留下 tarball 供本機測試使用.
set -euo pipefail
cd "$(dirname "$0")"

FORGECTL=(forgectl -s github)
PROJECT=nexgus/fsbrowser
PACKAGES=(core locales react vue3)
# Go 子目錄 module 的目錄名; fsb 排在前面, 因 fsdrv 的 require 指向 fsb 的同版本.
GOMODULES=(fsb fsdrv)

# Go module 的 require 中需隨版本同步的相依; 格式為 "go.mod 路徑:module 路徑".
# 三個 Go module 與四個 npm 套件由同一組 tag 一起發佈, 版號必須一致.
GOREQUIRES=(
    "fsdrv/go.mod:github.com/nexgus/fsbrowser/fsb"
    "examples/go.mod:github.com/nexgus/fsbrowser/fsb"
    "examples/go.mod:github.com/nexgus/fsbrowser/fsdrv"
)

# 取出某個 go.mod 中指定 module 的 require 版本; 未宣告時輸出空字串.
go_require_version() {
    awk -v m="$2" '$1 == m { print $2; exit }' "$1"
}

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

# Go module 的 require 版號須與前端套件一致; 脫節時 fsdrv 會指向不存在的 fsb 版本.
for entry in "${GOREQUIRES[@]}"; do
    f="${entry%%:*}"
    mod="${entry#*:}"
    v=$(go_require_version "$f" "$mod")
    [ "$v" = "v${VER}" ] \
        || die "${f} 中 ${mod} 為 ${v:-未宣告}, 應為 v${VER}; 請先以 npmver.sh 統一"
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

# 子目錄 module 的前綴 tag. forgectl 只建立主 tag v{版本}, 故此處自行處理.
# 已存在的 tag 若指向其他 commit 即中止, 避免覆寫既有版本.
for mod in "${GOMODULES[@]}"; do
    TAG="${mod}/v${VER}"
    if git rev-parse -q --verify "refs/tags/${TAG}" >/dev/null; then
        [ "$(git rev-list -n 1 "$TAG")" = "$(git rev-parse HEAD)" ] \
            || die "tag ${TAG} 已存在且不指向目前 commit"
    else
        git tag "$TAG"
    fi
    git push origin "$TAG"
done

"${FORGECTL[@]}" asset upload "$PROJECT" "v${VER}" "$TARBALL"
"${FORGECTL[@]}" release create "$PROJECT" "v${VER}" -n "$NOTE" -c latest
git pull --tags
