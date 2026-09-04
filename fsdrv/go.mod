module github.com/nexgus/fsbrowser/fsdrv

go 1.26.4

require (
	github.com/nexgus/fsbrowser/fsb v0.5.1
	golang.org/x/crypto v0.53.0
)

require golang.org/x/sys v0.46.0 // indirect

replace github.com/nexgus/fsbrowser/fsb => ../fsb
