#!/usr/bin/env bash
# 建置 test/ 驗證用 Wails v3 app 至 test/bin/ (該目錄不入 git).
#
#   - Windows (amd64): CGO_ENABLED=0 靜態連結交叉編譯, 附 -H windowsgui 避免主控台視窗,
#     產出單一 exe, 可直接複製至 Windows 執行 (前提為系統具 WebView2 runtime).
#   - macOS (本機 arch): 正常 cgo 建置, 系統 framework 為動態載入 (平台限制), 仍為單一
#     執行檔.
#
# 執行前先重新產生 Wails bindings, 確保 frontend/bindings (未入 git) 與目前 Go 端介面
# 一致.
set -e

cd "$(dirname "$0")"

echo "==> 產生 Wails bindings"
wails3 generate bindings -b ./...

mkdir -p bin

echo "==> 建置 Windows amd64 (靜態連結, CGO_ENABLED=0)"
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build \
  -ldflags "-H windowsgui -s -w" \
  -o bin/fsbrowser-test-windows-amd64.exe \
  .

echo "==> 建置 macOS $(go env GOARCH) (cgo)"
CGO_ENABLED=1 go build \
  -o "bin/fsbrowser-test-macos-$(go env GOARCH)" \
  .

echo "==> 建置產物"
ls -lh bin/
file bin/* 2>/dev/null || true
