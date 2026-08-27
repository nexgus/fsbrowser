// examples/vue3 是驗證 @nexgus/fsb-vue 整合的最小 Wails v3 app: 啟動時以本機檔案系統
// (examples/pkg/localfs) 作為檔案操作介面的實作, 並另外註冊一個宿主控制 service
// (examples/pkg/hostctl), 供前端在本機與 SSH 遠端 (examples/pkg/sshfs) 之間
// 切換, 藉此示範宿主 app 如何在執行期抽換 fsbrowser 的底層檔案系統. 前端以 Vite + Vue 3
// 建置, 建置產物 (frontend/dist) 內嵌於執行檔.
package main

import (
	"embed"
	"io/fs"
	"log"

	"github.com/wailsapp/wails/v3/pkg/application"

	"github.com/nexgus/fsbrowser/examples/pkg/hostctl"
	"github.com/nexgus/fsbrowser/examples/pkg/localfs"
	"github.com/nexgus/fsbrowser/service"
)

//go:embed all:frontend/dist
var distFS embed.FS

func main() {
	assets, err := fs.Sub(distFS, "frontend/dist")
	if err != nil {
		log.Fatal(err)
	}

	bridge := service.New(localfs.New())

	app := application.New(application.Options{
		Name:        "fsbrowser-example-vue3",
		Description: "fsbrowser Vue 3 整合驗證用最小 app (本機 / SSH 遠端)",
		Services: []application.Service{
			application.NewService(bridge),
			application.NewService(hostctl.New(bridge)),
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
