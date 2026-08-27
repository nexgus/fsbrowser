// examples/react 是驗證 React 整合的最小 Wails v3 app: 以 fsb/memfs 作為檔案操作介面的
// 實作, 註冊 fsbrowser 的橋接層 service, 前端掛上 @nexgus/fsb-react 的瀏覽面板 (計劃書
// 第 10 章 P4 階段). 接線模式比照 test/main.go.
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

//go:embed all:frontend/dist
var assets embed.FS

// buildDemoTree 建構一棵涵蓋各種項目種類的示範目錄樹, 供前端面板呼叫 List 時有內容可看.
func buildDemoTree() *memfs.FS {
	mt := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	return memfs.New(memfs.Dir{
		"home": memfs.Dir{
			"user": memfs.Dir{
				"readme.txt":   memfs.File{Size: 1280, ModTime: mt},
				".hidden.txt":  memfs.File{Size: 4, ModTime: mt},
				"docs":         memfs.Dir{"notes.txt": memfs.File{Size: 160, ModTime: mt}},
				"photos":       memfs.Dir{"trip.jpg": memfs.File{Size: 2_400_000, ModTime: mt}},
				"link-to-docs": memfs.Symlink{Target: "/home/user/docs"},
				"broken-link":  memfs.Symlink{Target: "/home/user/nowhere"},
				"a.sock":       memfs.Special{Kind: fsb.KindSocket},
				"a.pipe":       memfs.Special{Kind: fsb.KindFIFO},
				"a.device":     memfs.Special{Kind: fsb.KindDevice},
			},
		},
	}, memfs.WithHome("/home/user"), memfs.WithRoots([]string{"/"}))
}

func main() {
	app := application.New(application.Options{
		Name:        "fsbrowser-example-react",
		Description: "fsbrowser P4 React 整合驗證用最小 app",
		Services: []application.Service{
			application.NewService(service.New(buildDemoTree())),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:  "fsbrowser React example",
		Width:  1000,
		Height: 680,
		URL:    "/",
	})

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
