# fsbrowser

[正體中文說明](docs/README.zh-Hant.md)

**fsbrowser** (FSB) is a protocol-agnostic file browser component for [Wails v3](https://wails.io) desktop applications, shipped as a Go module plus front-end packages for **Vue 3** and **React**.

The component itself knows nothing about SSH, S3, or any other protocol. It defines a small Go interface for file system operations (list, stat, home, roots, make directory, rename, delete); your application implements that interface with whatever mechanism it already has -- an SSH/SFTP session, a cloud API, the local disk, or an in-memory fake -- and gets a full-featured file browser UI in return.

## Features

- Directory browsing with breadcrumb-free, path-first navigation (editable path bar, parent / home buttons)
- File or directory picking, single or multiple selection, decided per invocation
- Save mode (`selection-mode="save"`) for "save as" flows: browsing behaves like file mode, with a filename input row and non-modal overwrite confirmation; the component never writes the file itself
- Extension filtering (`extensions` prop) for file and save modes: non-matching files are dimmed and unselectable, and save mode auto-appends an extension to a bare filename
- Directory management: new folder, rename (inline), delete (batch, with non-modal confirmation)
- Context menu (rename, delete, copy path, new folder, refresh, hidden files toggle)
- Multiple roots -- Windows drive letters generalize to a root switcher that simply never appears on single-root systems
- Internal paths always use `/` (drives normalized as `C:/...`); backslashes are a display-only concern
- Symlink-aware icons (link-to-file vs. link-to-directory), plus sockets, FIFOs, device files, and broken links
- Errors surface in a fixed-height status bar -- the layout never jumps, and the same structured error is emitted to the host application
- No dialogs, ever; how (and whether) to open windows is your application's business
- Theming: built-in light and dark themes, custom themes via a flat token table
- Localization: English built in, other languages (including Traditional Chinese) supplied as language packs; the host picks the language per invocation -- no auto-detection
- Windows and macOS hosts supported

## How it works

```
your app (Go)                       fsbrowser                     your app (front end)
---------------                     ---------                     --------------------
implements the        ------->      bridge service   ------->     Vue 3 / React component
file system interface               (Wails v3)                    renders the browser UI
```

Three steps to integrate:

### 1. Implement the interface and register the service (Go)

```go
import "github.com/nexgus/fsbrowser/service"

// myFS implements the fsbrowser file system interface,
// e.g. by wrapping your existing SSH/SFTP code.
app := application.New(application.Options{
    Services: []application.Service{
        application.NewService(service.New(myFS)),
    },
})
```

Then generate the front-end bindings as usual:

```bash
wails3 generate bindings
```

### 2. Wire the client (front end, once per app)

```ts
// The only file in your front end that touches Wails bindings.
import * as bindings from "./bindings/github.com/nexgus/fsbrowser/service";
import { createClient } from "@nexgus/fsb-core";

export const fsbClient = createClient(bindings);
```

### 3. Mount the component

**Vue 3**

```vue
<script setup lang="ts">
import { FsBrowser } from "@nexgus/fsb-vue";
import { zhHant } from "@nexgus/fsb-locales";
import { fsbClient } from "./fsbClient";
</script>

<template>
  <FsBrowser
    :client="fsbClient"
    selection-mode="dir"
    return-mode="single"
    size-unit="si"
    :locale="zhHant"
    theme="dark"
    @select="(path) => console.log(path)"
    @cancel="close()"
    @error="(err) => console.warn(err.code, err.message)"
  />
</template>
```

**React**

```tsx
import { FsbClientProvider, FsBrowser } from "@nexgus/fsb-react";
import { zhHant } from "@nexgus/fsb-locales";
import { fsbClient } from "./fsbClient";

function Picker() {
  return (
    <FsbClientProvider client={fsbClient}>
      <FsBrowser
        selectionMode="file"
        returnMode="multiple"
        sizeUnit="iec"
        locale={zhHant}
        theme="light"
        onSelect={(paths) => console.log(paths)}
        onCancel={() => setOpen(false)}
        onError={(err) => console.warn(err.code, err.message)}
      />
    </FsbClientProvider>
  );
}
```

Selected paths are always absolute, `/`-separated (e.g. `C:/Users/gus/data` on a Windows-style file system); convert them yourself if a consumer insists on backslashes.

### Save mode and extension filtering

Set `selection-mode="save"` for "save as" flows: the panel browses like file mode but keeps a filename input row visible, pre-filled from `defaultName` (`default-name` in the Vue template) and updated when the user picks an existing file from the list. Confirming emits the same `select` event with a single absolute path (current directory plus filename); `returnMode` is meaningless here and selection is always single. Add `extensions` (an array of bare extensions, e.g. `["yaml", "yml"]`) to restrict file and save modes to matching files -- non-matching entries are dimmed rather than hidden, and a bare filename typed in save mode gets the list's first extension appended automatically. If your host already filters with a semicolon-delimited glob string such as `*.yaml;*.yml`, just split it on `;` and pass the result -- the component strips the leading `*.` itself.

**Vue 3**

```vue
<FsBrowser
  :client="fsbClient"
  selection-mode="save"
  default-name="report.yaml"
  :extensions="['yaml', 'yml']"
  @select="(path) => saveTo(path)"
  @cancel="close()"
  @error="(err) => console.warn(err.code, err.message)"
/>
```

**React**

```tsx
<FsBrowser
  selectionMode="save"
  defaultName="report.yaml"
  extensions={["yaml", "yml"]}
  onSelect={(path) => saveTo(path as string)}
  onCancel={() => setOpen(false)}
  onError={(err) => console.warn(err.code, err.message)}
/>
```

## Examples

[examples/cmd/](examples/cmd/) contains two runnable Wails v3 example apps -- `react` and `vue3` -- each starts on the local file system and can switch to an SSH remote from within the app, demonstrating how a host application swaps the underlying file system at runtime.

### Prerequisites

- Go
- Node.js with npm
- the `wails3` CLI:

```bash
go install github.com/wailsapp/wails/v3/cmd/wails3@latest
```

The build script looks for `wails3` on `PATH` first, then falls back to `GOBIN` (or `GOPATH/bin`), so installing it via `go install` is enough even without adjusting `PATH`.

### Build

```bash
examples/build.sh
```

The script regenerates the Wails bindings, installs front-end dependencies on first run (`npm install` only when `node_modules` is missing), builds the front ends, and produces single-file executables in `examples/bin/` for both apps:

- `<app>-windows-amd64.exe` -- Windows amd64, statically linked cross-build
- `<app>-darwin-<arch>` -- macOS, native architecture, compatible with macOS 11 and later

### Run

On macOS, run the produced binary directly:

```bash
examples/bin/react-darwin-arm64
```

For Windows, copy the `.exe` to a Windows machine and run it there; the only system requirement is the WebView2 runtime, which ships with current Windows versions.

## Packages

| Package | Contents |
|---|---|
| `github.com/nexgus/fsbrowser` | Go module: interface definition, bridge service, in-memory fake FS for tests and examples |
| `@nexgus/fsb-core` | Framework-agnostic logic: client interface, browsing state, locale and theme machinery, formatting |
| `@nexgus/fsb-vue` | Vue 3 component |
| `@nexgus/fsb-react` | React component |

All four are versioned together by a single git tag.

## License

[MIT](LICENSE.md)
