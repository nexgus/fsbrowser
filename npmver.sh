#!/usr/bin/env bash
# npmver.sh: 將 frontend/ 下四個 npm 套件, 以及 go.mod 中跨 module 的 require
# 版號, 統一改為指定版本.
#
# 用法: ./npmver.sh [版本]
#   省略版本時僅列出目前的版本, 不做任何修改.
#   版本可帶或不帶 v 前綴; 允許 semver 預發布尾碼 (僅供開發期使用, release.sh
#   會拒絕該類版本). 透過 npm version 同步更新各套件的 package.json 與
#   package-lock.json; 不建立 git tag, 也不做任何 git 操作.
#   本專案的三個 Go module 與四個 npm 套件由同一組 tag 一起發佈, 故 fsdrv 與
#   examples 對 fsb / fsdrv 的 require 版號必須隨之更新, 否則外部消費端會解析到
#   不存在的版本; 版號的唯一入口即為本腳本.
set -euo pipefail
cd "$(dirname "$0")"

PACKAGES=(core locales react vue3)

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

die() { echo "npmver.sh: $*" >&2; exit 1; }

show_versions() {
    for pkg in "${PACKAGES[@]}"; do
        node -p "p=require('./frontend/${pkg}/package.json'); p.name + ' ' + p.version"
    done
    for entry in "${GOREQUIRES[@]}"; do
        f="${entry%%:*}"
        mod="${entry#*:}"
        echo "${f}: ${mod} $(go_require_version "$f" "$mod")"
    done
}

[ $# -le 1 ] || die "用法: ./npmver.sh [版本]"

if [ $# -eq 0 ]; then
    show_versions
    exit 0
fi

VER="${1#v}"
echo "$VER" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$' \
    || die "版本 ${1} 不是合法的 semver"

for pkg in "${PACKAGES[@]}"; do
    (cd "frontend/${pkg}" \
        && npm version "$VER" --no-git-tag-version --allow-same-version >/dev/null)
done

for entry in "${GOREQUIRES[@]}"; do
    go mod edit -require="${entry#*:}@v${VER}" "${entry%%:*}"
done

show_versions
