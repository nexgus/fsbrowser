// test 是驗證用的最小 Wails v3 app: 以 fsb/memfs 作為檔案操作介面的實作, 註冊
// fsbrowser 的橋接層 service, 用來驗證 wails3 generate bindings 的產生路徑與
// 前端呼叫可行性 (計劃書第 10 章 P1 階段). 本 app 不含任何實際 UI 元件, 前端僅為
// 一頁極簡 HTML + 原生 JS.
package main

import (
	"embed"
	"log"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"

	"github.com/nexgus/fsbrowser/fsb"
	"github.com/nexgus/fsbrowser/fsb/memfs"
	"github.com/nexgus/fsbrowser/service"
)

//go:embed all:frontend
var assets embed.FS

// buildTestTree 建構一棵涵蓋各種項目種類的示範目錄樹, 供前端頁面呼叫 List 時有內容可看.
func buildTestTree() *memfs.FS {
	mt := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	return memfs.New(memfs.Dir{
		"home": memfs.Dir{
			"user": memfs.Dir{
				"readme.txt":   memfs.File{Size: 128, ModTime: mt},
				".hidden.txt":  memfs.File{Size: 4, ModTime: mt},
				"docs":         memfs.Dir{"notes.txt": memfs.File{Size: 16, ModTime: mt}},
				"link-to-docs": memfs.Symlink{Target: "/home/user/docs"},
				"broken-link":  memfs.Symlink{Target: "/home/user/nowhere"},
				"a.sock":       memfs.Special{Kind: fsb.KindSocket},
			},
		},
	}, memfs.WithHome("/home/user"), memfs.WithRoots([]string{"/"}))
}

func main() {
	app := application.New(application.Options{
		Name:        "fsbrowser-test",
		Description: "fsbrowser P1 bindings 與建置驗證用最小 app",
		Services: []application.Service{
			application.NewService(service.New(buildTestTree())),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:  "fsbrowser test",
		Width:  900,
		Height: 600,
		URL:    "/",
	})

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
