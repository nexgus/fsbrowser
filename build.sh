#!/usr/bin/env bash
# 建置 examples/cmd/{react,vue3} 這兩個 Wails v3 範例 app 至 examples/bin/ (該目錄不入 git).
#
#   - Windows (amd64): CGO_ENABLED=0 靜態連結交叉編譯, 附 -H windowsgui 避免主控台視窗,
#     產出單一 exe, 可直接複製至 Windows 執行 (前提為系統具 WebView2 runtime).
#   - macOS (本機 arch): 正常 cgo 建置, 系統 framework 為動態載入 (平台限制), 仍為單一
#     執行檔.
#
# Go 端以 go:embed 內嵌各範例的 frontend/dist, 故必須先建置前端; 同時重新產生 Wails
# bindings, 確保各範例的 frontend/bindings (未入 git) 與目前 Go 端介面一致.
#
# 各範例前端以本機路徑相依連向 frontend/ 底下的元件套件, 而套件的進入點是其建置產物
# (dist, 未入 git), 因此本腳本先建置元件套件, 再建置範例前端; 否則範例內嵌到的會是上一
# 次留下的舊產物. 語言包套件直接發佈原始碼, 無須建置.
#
# npm 依賴不會每次重裝: node_modules 不存在時本腳本自行執行一次 npm install, 已存在則
# 直接沿用 (依賴清單有變動時請自行重跑 npm install).
set -e

cd "$(dirname "$0")"

# 尋找 wails3: 優先取 PATH 中的, 否則退回 go install 的預設位置 (GOBIN, 未設時為
# GOPATH/bin); 兩處皆無時報錯, 不依賴使用者的 PATH 設定.
find_wails3() {
  if command -v wails3 >/dev/null 2>&1; then
    command -v wails3
    return
  fi
  local gobin
  gobin="$(go env GOBIN)"
  [ -z "${gobin}" ] && gobin="$(go env GOPATH)/bin"
  if [ -x "${gobin}/wails3" ]; then
    echo "${gobin}/wails3"
    return
  fi
  echo "Error: wails3 not found; install it with: go install github.com/wailsapp/wails/v3/cmd/wails3@latest" >&2
  exit 1
}

WAILS3="$(find_wails3)"

mkdir -p examples/bin

# $1: 元件套件目錄名 (core / react / vue3), 對應 frontend/<pkg>/
build_package() {
  local pkg="$1"
  local dir="frontend/${pkg}"

  if [ ! -d "${dir}/node_modules" ]; then
    echo "==> [pkg:${pkg}] Installing dependencies (node_modules not found)"
    (cd "${dir}" && npm install)
  fi

  echo "==> [pkg:${pkg}] Building package (dist)"
  (cd "${dir}" && npm run build)
}

# $1: app 名稱 (react / vue3), 對應 examples/cmd/<app>/
build_app() {
  local app="$1"
  local dir="examples/cmd/${app}"

  echo "==> [${app}] Generating Wails bindings"
  (cd "${dir}" && "${WAILS3}" generate bindings -b ./...)

  if [ ! -d "${dir}/frontend/node_modules" ]; then
    echo "==> [${app}] Installing frontend dependencies (node_modules not found)"
    (cd "${dir}/frontend" && npm install)
  fi

  echo "==> [${app}] Building frontend (typecheck + vite build)"
  (cd "${dir}/frontend" && npm run build)

  echo "==> [${app}] Building Windows amd64 (static link, CGO_ENABLED=0)"
  (cd "${dir}" && GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build \
    -ldflags "-H windowsgui -s -w" \
    -o "../../bin/${app}-windows-amd64.exe" \
    .)

  # cgo 編譯與連結一律指定部署目標 11.0: clang 未指定時以 SDK 版本為部署目標, 與 Go
  # 連結端的最低版本 (11.0) 不一致而產生大量 ld 警告; 對齊後亦確保產物相容 macOS 11 以上.
  echo "==> [${app}] Building macOS $(go env GOARCH) (cgo)"
  (cd "${dir}" && CGO_ENABLED=1 \
    CGO_CFLAGS="-mmacosx-version-min=11.0" \
    CGO_LDFLAGS="-mmacosx-version-min=11.0" \
    go build \
    -o "../../bin/${app}-darwin-$(go env GOARCH)" \
    .)
}

# core 需先於 react 與 vue3: 後兩者的建置要讀取 core 產物中的型別宣告.
build_package core
build_package react
build_package vue3

build_app react
build_app vue3

echo "==> Build artifacts"
ls -lh examples/bin/
file examples/bin/* 2>/dev/null || true
