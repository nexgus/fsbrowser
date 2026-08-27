// examples/vue3 是最小 Wails v3 app, 以 fsb/memfs 作為檔案操作介面的實作, 用來驗證
// @nexgus/fsb-vue 的整合 (計劃書第 10 章 P3 階段). 前端以 Vite + Vue 3 建置,
// 建置產物 (frontend/dist) 內嵌於執行檔.
package main

import (
	"embed"
	"io/fs"
	"log"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"

	"github.com/nexgus/fsbrowser/fsb"
	"github.com/nexgus/fsbrowser/fsb/memfs"
	"github.com/nexgus/fsbrowser/service"
)

//go:embed all:frontend/dist
var distFS embed.FS

// buildDemoTree 建構一棵涵蓋各種項目種類的示範目錄樹, 供 @nexgus/fsb-vue 面板瀏覽.
func buildDemoTree() *memfs.FS {
	mt := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	return memfs.New(memfs.Dir{
		"home": memfs.Dir{
			"user": memfs.Dir{
				"readme.txt":   memfs.File{Size: 1280, ModTime: mt},
				".hidden.txt":  memfs.File{Size: 42, ModTime: mt},
				"docs":         memfs.Dir{"notes.txt": memfs.File{Size: 2048, ModTime: mt}},
				"photos":       memfs.Dir{"trip.jpg": memfs.File{Size: 4_500_000, ModTime: mt}},
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
	assets, err := fs.Sub(distFS, "frontend/dist")
	if err != nil {
		log.Fatal(err)
	}

	app := application.New(application.Options{
		Name:        "fsbrowser-example-vue3",
		Description: "fsbrowser P3 階段: @nexgus/fsb-vue 整合驗證",
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
		Title:  "fsbrowser vue3 example",
		Width:  980,
		Height: 680,
		URL:    "/",
	})

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
