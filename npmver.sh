#!/usr/bin/env bash
# npm_version.sh: 將 frontend/ 下四個 npm 套件的版本統一改為指定版本.
#
# 用法: ./npm_version.sh [版本]
#   省略版本時僅列出四個套件當前的版本, 不做任何修改.
#   版本可帶或不帶 v 前綴; 允許 semver 預發布尾碼 (僅供開發期使用, release.sh
#   會拒絕該類版本). 透過 npm version 同步更新各套件的 package.json 與
#   package-lock.json; 不建立 git tag, 也不做任何 git 操作.
set -euo pipefail
cd "$(dirname "$0")"

PACKAGES=(core locales react vue3)

die() { echo "npmver.sh: $*" >&2; exit 1; }

show_versions() {
    for pkg in "${PACKAGES[@]}"; do
        node -p "p=require('./frontend/${pkg}/package.json'); p.name + ' ' + p.version"
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

show_versions
