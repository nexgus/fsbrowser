# fsbrowser

[正體中文說明](docs/README.zh-Hant.md)

**fsbrowser** (FSB) is a protocol-agnostic file browser component for [Wails v3](https://wails.io) desktop applications, shipped as a Go module plus front-end packages for **Vue 3** and **React**.

The component itself knows nothing about SSH, S3, or any other protocol. It defines a small Go interface covering the usual file system operations -- listing, inspecting, creating, renaming, and deleting; your application implements that interface with whatever mechanism it already has -- an SSH/SFTP session, a cloud API, the local disk, or an in-memory fake -- and gets a full-featured file browser UI in return.

## Documentation

| Document | Contents |
|---|---|
| This README | What the component does, how the pieces fit together, and the steps to wire it into a Wails v3 app |
| [docs/interface-guide.md](docs/interface-guide.md) | The Go side: the full operation contract, path and error conventions, a compilable minimal implementation, and the optional copy/move capabilities |
| [docs/component-reference.md](docs/component-reference.md) | The front end: every prop and event, save mode, extension filtering, cut/copy/paste, theming, and localization |

## 1. Features

- Directory browsing with breadcrumb-free, path-first navigation (editable path bar, parent / home buttons)
- File or directory picking, single or multiple selection, decided per invocation
- Save mode (`selection-mode="save"`) for "save as" flows: browsing behaves like file mode, with a filename input row and non-modal overwrite confirmation; the component never writes the file itself -- see [component reference, 5](docs/component-reference.md#5-save-mode-and-extension-filtering)
- Extension filtering (`extensions` prop) for file and save modes: non-matching files are dimmed and unselectable, and save mode auto-appends an extension to a bare filename -- see [component reference, 5](docs/component-reference.md#5-save-mode-and-extension-filtering)
- Directory management: new folder, rename (inline), delete (batch, with non-modal confirmation)
- Cut / copy / paste on selected items -- non-modal conflict prompts (overwrite / overwrite all / skip / skip all / cancel), cancellable in-progress operations, and disconnect handling; unlocked only when the host implements the optional copy/move capabilities -- see [interface guide, 7](docs/interface-guide.md#7-optional-capabilities-copy-and-move) and [component reference, 6](docs/component-reference.md#6-cut-copy-and-paste)
- Two context menus -- on items (copy path, cut, copy, rename, delete) and on empty space (new folder, paste, refresh, hidden files toggle) -- plus a toolbar paste button so paste and refresh stay reachable even when the list fills the panel -- see [component reference, 7](docs/component-reference.md#7-keyboard-shortcuts-and-context-menus)
- Keyboard shortcuts for cut/copy/paste (⌘X/⌘C/⌘V on macOS, Ctrl+X/Ctrl+C/Ctrl+V elsewhere, detected automatically), active while the list has focus -- see [component reference, 7](docs/component-reference.md#7-keyboard-shortcuts-and-context-menus)
- Multiple roots -- Windows drive letters generalize to a root switcher that simply never appears on single-root systems
- Internal paths always use `/` (drives normalized as `C:/...`); backslashes are a display-only concern
- Symlink-aware icons (link-to-file vs. link-to-directory), plus sockets, FIFOs, device files, and broken links
- Errors surface in a fixed-height status bar -- the layout never jumps, and the same structured error is emitted to the host application
- No dialogs, ever; how (and whether) to open windows is your application's business
- Theming: built-in light and dark themes, an "auto" mode that follows the system's light/dark preference and updates live, custom themes via a flat token table -- see [component reference, 8](docs/component-reference.md#8-theming)
- Localization: English built in, other languages (including Traditional Chinese) supplied as language packs; the host picks the language per invocation -- no auto-detection -- see [component reference, 9](docs/component-reference.md#9-localization)
- Windows and macOS hosts supported

## 2. How it works

```
your app (Go)                       fsbrowser                     your app (front end)
---------------                     ---------                     --------------------
implements the        ------->      bridge service   ------->     Vue 3 / React component
file system interface               (Wails v3)                    renders the browser UI
```

Three roles are involved, and only two of them are yours to write:

- **Your Go code** implements the file system interface -- the eight-method operation contract (list, stat, home, roots, path style, make directory, rename, delete, plus two optional capabilities) is defined entirely in [`fsb/fsb.go`](fsb/fsb.go), the one file to read before writing any Go code for this integration; the [interface guide](docs/interface-guide.md) walks through it operation by operation.
- **The bridge service**, in [`service/`](service/), is fsbrowser's own code -- you register it but do not modify it. It exposes your implementation to the front end through generated bindings and normalizes whatever errors it returns into the structured form the component expects.
- **Your front end** mounts the `@nexgus/fsb-vue` or `@nexgus/fsb-react` component and gives it a client built from the generated bindings -- the second and last file you write.

Section 3 walks through both.

## 3. Integration steps

### 3.1 Project layout

A typical Wails v3 project keeps the Go application at the repository root and the entire front end under `frontend/`. `wails3 generate bindings` writes its output to `frontend/bindings` by default, and the built front end (`frontend/dist`) is embedded into the executable with `go:embed`. The two files you add for fsbrowser fit into that layout as follows:

```
your-app/
├── go.mod
├── main.go                 # registers the bridge service (application.NewService)
├── myfs.go                 # <- you write this: your fsb.FileSystem implementation
│                           #    (a subpackage such as internal/myfs/ works just as well)
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── index.html
    ├── bindings/            # generated by `wails3 generate bindings`, not hand-edited
    │   └── github.com/nexgus/fsbrowser/service/
    └── src/
        ├── fsbClient.ts     # <- you write this: the only file that touches Wails bindings
        └── ...               # the rest of your app, importing fsbClient
```

[examples/cmd/vue3/](examples/cmd/vue3/) and [examples/cmd/react/](examples/cmd/react/) follow this exact layout and are a working reference for everything below.

### 3.2 Back end (Go)

**Step 1 -- implement the interface.** Write a type that satisfies `fsb.FileSystem` (defined in [`fsb/fsb.go`](fsb/fsb.go)):

```go
package myfs

import "github.com/nexgus/fsbrowser/fsb"

type FileSystem struct{ /* whatever backs your file system */ }

func (f *FileSystem) List(dir string) ([]fsb.Entry, error) { /* ... */ }
func (f *FileSystem) Stat(path string) (fsb.Entry, error)  { /* ... */ }
// Home, Roots, PathStyle, MakeDir, Rename, Delete -- five more methods

var _ fsb.FileSystem = (*FileSystem)(nil)
```

The full contract -- all eight methods, path and error conventions, and a compilable minimal implementation -- is in the [interface guide, sections 2 through 6](docs/interface-guide.md#2-path-conventions).

**Step 2 -- register the bridge service**, matching [`examples/cmd/vue3/main.go`](examples/cmd/vue3/main.go):

```go
import "github.com/nexgus/fsbrowser/service"

bridge := service.New(myfs.New())

app := application.New(application.Options{
    Services: []application.Service{
        application.NewService(bridge),
    },
    // Assets, Mac, etc.
})
```

**Step 3 -- generate the bindings:**

```bash
wails3 generate bindings
```

### 3.3 Front end

**Step 1 -- install the packages.** The `@nexgus/fsb-*` packages are not on the npm registry; see [section 5.1](#51-installing-the-front-end-packages) for how to obtain and reference them.

**Step 2 -- write the wiring file**, the only file in your front end that touches Wails bindings:

```ts
// frontend/src/fsbClient.ts
import * as bindings from "../bindings/github.com/nexgus/fsbrowser/service/service.js";
import { createClient } from "@nexgus/fsb-core";

export const fsbClient = createClient(bindings);
```

Adjust the relative import path to where you place this file. The generated bindings expose more than one importable module; see [component reference, 1](docs/component-reference.md#1-the-client) for the alternative form and when to prefer it.

**Step 3 -- mount the component**, passing it `fsbClient`:

**Vue 3**

```vue
<script setup lang="ts">
import { FsBrowser } from "@nexgus/fsb-vue";
import { fsbClient } from "./fsbClient";
</script>

<template>
  <FsBrowser
    :client="fsbClient"
    selection-mode="dir"
    return-mode="single"
    @select="(path) => console.log(path)"
    @cancel="close()"
    @error="(err) => console.warn(err.code, err.message)"
  />
</template>
```

**React**

```tsx
import { FsbClientProvider, FsBrowser } from "@nexgus/fsb-react";
import { fsbClient } from "./fsbClient";

function Picker() {
  return (
    <FsbClientProvider client={fsbClient}>
      <FsBrowser
        selectionMode="file"
        returnMode="multiple"
        onSelect={(paths) => console.log(paths)}
        onCancel={() => setOpen(false)}
        onError={(err) => console.warn(err.code, err.message)}
      />
    </FsbClientProvider>
  );
}
```

These are the props and events you will reach for immediately; the complete tables (every prop, every event, defaults, and selection behaviour) are in the [component reference, sections 2 through 4](docs/component-reference.md#2-props).

### 3.4 Beyond the basics

- **Save mode and extension filtering** turn the same component into a "save as" dialog and restrict it to matching files; see [component reference, 5](docs/component-reference.md#5-save-mode-and-extension-filtering).
- **Cut, copy, and paste** are enabled automatically once your Go implementation satisfies one of the optional copy/move interfaces described in [interface guide, 7](docs/interface-guide.md#7-optional-capabilities-copy-and-move); the resulting front-end behaviour (conflict prompts, cancellation, keyboard shortcuts) is covered in [component reference, 6](docs/component-reference.md#6-cut-copy-and-paste).
- **Theming**, including the built-in light/dark themes, the "auto" mode, and custom token tables, is covered in [component reference, 8](docs/component-reference.md#8-theming).
- **Localization**, including the built-in language packs and how the host selects a language, is covered in [component reference, 9](docs/component-reference.md#9-localization).

## 4. Examples

[examples/cmd/](examples/cmd/) contains two runnable Wails v3 example apps -- `react` and `vue3` -- each starts on the local file system and can switch to an SSH remote from within the app, demonstrating how a host application swaps the underlying file system at runtime.

### 4.1 Prerequisites

- Go
- Node.js with npm
- the `wails3` CLI:

```bash
go install github.com/wailsapp/wails/v3/cmd/wails3@latest
```

The build script looks for `wails3` on `PATH` first, then falls back to `GOBIN` (or `GOPATH/bin`), so installing it via `go install` is enough even without adjusting `PATH`.

### 4.2 Build

```bash
examples/build.sh
```

The script regenerates the Wails bindings, installs front-end dependencies on first run (`npm install` only when `node_modules` is missing), builds the front ends, and produces single-file executables in `examples/bin/` for both apps:

- `<app>-windows-amd64.exe` -- Windows amd64, statically linked cross-build
- `<app>-darwin-<arch>` -- macOS, native architecture, compatible with macOS 11 and later

### 4.3 Run

On macOS, run the produced binary directly:

```bash
examples/bin/react-darwin-arm64
```

For Windows, copy the `.exe` to a Windows machine and run it there; the only system requirement is the WebView2 runtime, which ships with current Windows versions.

## 5. Packages

| Package | Contents |
|---|---|
| `github.com/nexgus/fsbrowser` | Go module: interface definition and bridge service |
| `@nexgus/fsb-core` | Framework-agnostic logic: client interface, browsing state, locale and theme machinery, formatting |
| `@nexgus/fsb-vue` | Vue 3 component |
| `@nexgus/fsb-react` | React component |
| `@nexgus/fsb-locales` | Bundled language packs (Traditional Chinese today); English needs no pack |

All five are versioned together by a single git tag.

### 5.1 Installing the front-end packages

The `@nexgus/fsb-*` packages are not published to the npm registry. Instead, every release on the [releases page](https://github.com/nexgus/fsbrowser/releases) carries a `fsbrowser.npm.<version>+<hash>.tar.gz` asset that bundles all of them.

1. Download the tarball from the releases page and extract it anywhere:

   ```bash
   tar -xzf fsbrowser.npm.0.2.0+abc1234.tar.gz
   ```

2. Reference the extracted directories from your application's `package.json` with `file:` dependencies (pick `react` or `vue3` as appropriate):

   ```json
   "dependencies": {
     "@nexgus/fsb-core": "file:../fsbrowser-npm-0.2.0/core",
     "@nexgus/fsb-locales": "file:../fsbrowser-npm-0.2.0/locales",
     "@nexgus/fsb-react": "file:../fsbrowser-npm-0.2.0/react"
   }
   ```

The packages inside the tarball depend on each other through relative `file:` paths, so keep the extracted directory layout intact.

## 6. License

[MIT](LICENSE.md)
