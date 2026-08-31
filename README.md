# fsbrowser

[正體中文說明](docs/README.zh-Hant.md)

**fsbrowser** (FSB) is a protocol-agnostic file browser component for [Wails v3](https://wails.io) desktop applications, shipped as a Go module plus front-end packages for **Vue 3** and **React**.

The component itself knows nothing about SSH, S3, or any other protocol. It defines a small Go interface for file system operations (list, stat, home, roots, make directory, rename, delete); your application implements that interface with whatever mechanism it already has -- an SSH/SFTP session, a cloud API, the local disk, or an in-memory fake -- and gets a full-featured file browser UI in return.

## 1. Features

- Directory browsing with breadcrumb-free, path-first navigation (editable path bar, parent / home buttons)
- File or directory picking, single or multiple selection, decided per invocation
- Save mode (`selection-mode="save"`) for "save as" flows: browsing behaves like file mode, with a filename input row and non-modal overwrite confirmation; the component never writes the file itself
- Extension filtering (`extensions` prop) for file and save modes: non-matching files are dimmed and unselectable, and save mode auto-appends an extension to a bare filename
- Directory management: new folder, rename (inline), delete (batch, with non-modal confirmation)
- Cut / copy / paste on selected items -- non-modal conflict prompts (overwrite / overwrite all / skip / skip all / cancel), cancellable in-progress operations, and disconnect handling; unlocked only when the host implements the optional copy/move capabilities (see 4.2)
- Two context menus -- on items (copy path, cut, copy, rename, delete) and on empty space (new folder, paste, refresh, hidden files toggle) -- plus a toolbar paste button so paste and refresh stay reachable even when the list fills the panel
- Keyboard shortcuts for cut/copy/paste (⌘X/⌘C/⌘V on macOS, Ctrl+X/Ctrl+C/Ctrl+V elsewhere, detected automatically), active while the list has focus
- Multiple roots -- Windows drive letters generalize to a root switcher that simply never appears on single-root systems
- Internal paths always use `/` (drives normalized as `C:/...`); backslashes are a display-only concern
- Symlink-aware icons (link-to-file vs. link-to-directory), plus sockets, FIFOs, device files, and broken links
- Errors surface in a fixed-height status bar -- the layout never jumps, and the same structured error is emitted to the host application
- No dialogs, ever; how (and whether) to open windows is your application's business
- Theming: built-in light and dark themes, an "auto" mode that follows the system's light/dark preference and updates live, custom themes via a flat token table
- Localization: English built in, other languages (including Traditional Chinese) supplied as language packs; the host picks the language per invocation -- no auto-detection
- Windows and macOS hosts supported

## 2. How it works

```
your app (Go)                       fsbrowser                     your app (front end)
---------------                     ---------                     --------------------
implements the        ------->      bridge service   ------->     Vue 3 / React component
file system interface               (Wails v3)                    renders the browser UI
```

Integration takes three steps, covered in the next section.

## 3. Integration steps

### 3.1 Implement the interface and register the service (Go)

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

### 3.2 Wire the client (front end, once per app)

```ts
// The only file in your front end that touches Wails bindings.
import * as bindings from "./bindings/github.com/nexgus/fsbrowser/service";
import { createClient } from "@nexgus/fsb-core";

export const fsbClient = createClient(bindings);
```

### 3.3 Mount the component

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

Ctrl/Cmd and Shift clicks extend the selection whatever the return mode, which is what makes batch cut, copy, and delete usable from the context menu. In single mode the confirm button still requires exactly one item, and the status bar says so for as long as more are selected.

## 4. Advanced features

### 4.1 Save mode and extension filtering

Set `selection-mode="save"` for "save as" flows: the panel browses like file mode but keeps a filename input row visible, pre-filled from `defaultName` (`default-name` in the Vue template) and updated when the user picks an existing file from the list (plain or Ctrl/Cmd click). Confirming emits the same `select` event with a single absolute path (current directory plus filename); `returnMode` is meaningless here, and while the selection may still hold several items for batch operations, confirming ignores it and uses the filename row alone. Add `extensions` (an array of bare extensions, e.g. `["yaml", "yml"]`) to restrict file and save modes to matching files -- non-matching entries are dimmed rather than hidden, and a bare filename typed in save mode gets the list's first extension appended automatically. If your host already filters with a semicolon-delimited glob string such as `*.yaml;*.yml`, just split it on `;` and pass the result -- the component strips the leading `*.` itself.

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

### 4.2 Cut, copy, and paste (optional capabilities)

None of the eight required file system operations move data, so cut/copy/paste is opt-in. Implement any of these four interfaces on your `fsb.FileSystem` to unlock it:

```go
// Recursive copy; the implementation walks the whole tree itself.
type Copier interface {
    Copy(src, dst string, overwrite bool) error
}

// Cancellable recursive copy -- same semantics, plus a context.
type CopierContext interface {
    CopyContext(ctx context.Context, src, dst string, overwrite bool) error
}

// Move; same semantics as Copy, but the source no longer exists afterward.
type Mover interface {
    Move(src, dst string, overwrite bool) error
}

// Cancellable move.
type MoverContext interface {
    MoveContext(ctx context.Context, src, dst string, overwrite bool) error
}
```

The bridge service detects which of these your registered implementation satisfies -- no code changes needed beyond regenerating bindings -- and exposes the result to the component as three capabilities: `canCopy`, `canMove`, `canCancel` (the last one true only when you implement the `*Context` variant, since cancel support is inferred from whether you accept and honor a `context.Context` rather than declared separately). A host that implements none of these keeps compiling and running unchanged.

- **No copy capability**: cut, copy, and paste are withheld entirely -- both context menus drop all three items, the toolbar paste button doesn't render, and the three keyboard shortcuts pass through untouched, so a host can never end up able to cut something it has nowhere to paste.
- **Copy capability present, no move capability**: cut still works -- the component falls back to `Rename` across directories to complete it.
- **Cancel capability**: shown only when the `*Context` variant is implemented; a canceled operation is reported through the same error path with the new `canceled` error code, and already-completed items are kept, not rolled back.

Same-name conflicts during paste are resolved through the same non-modal status bar used for errors (overwrite / overwrite all / skip / skip all / cancel, scoped to the current paste batch). A nested paste (pasting into the source itself or one of its descendants) is always blocked client-side and reported through the new `onWarning` callback (`warning` event in Vue) instead of the status bar, so the host decides whether and how to surface it:

**Vue 3**

```vue
<FsBrowser :client="fsbClient" ... @warning="(w) => console.warn(w.code, w.paths)" />
```

**React**

```tsx
<FsBrowser ... onWarning={(w) => console.warn(w.code, w.paths)} />
```

## 5. Examples

[examples/cmd/](examples/cmd/) contains two runnable Wails v3 example apps -- `react` and `vue3` -- each starts on the local file system and can switch to an SSH remote from within the app, demonstrating how a host application swaps the underlying file system at runtime.

### 5.1 Prerequisites

- Go
- Node.js with npm
- the `wails3` CLI:

```bash
go install github.com/wailsapp/wails/v3/cmd/wails3@latest
```

The build script looks for `wails3` on `PATH` first, then falls back to `GOBIN` (or `GOPATH/bin`), so installing it via `go install` is enough even without adjusting `PATH`.

### 5.2 Build

```bash
examples/build.sh
```

The script regenerates the Wails bindings, installs front-end dependencies on first run (`npm install` only when `node_modules` is missing), builds the front ends, and produces single-file executables in `examples/bin/` for both apps:

- `<app>-windows-amd64.exe` -- Windows amd64, statically linked cross-build
- `<app>-darwin-<arch>` -- macOS, native architecture, compatible with macOS 11 and later

### 5.3 Run

On macOS, run the produced binary directly:

```bash
examples/bin/react-darwin-arm64
```

For Windows, copy the `.exe` to a Windows machine and run it there; the only system requirement is the WebView2 runtime, which ships with current Windows versions.

## 6. Packages

| Package | Contents |
|---|---|
| `github.com/nexgus/fsbrowser` | Go module: interface definition and bridge service |
| `@nexgus/fsb-core` | Framework-agnostic logic: client interface, browsing state, locale and theme machinery, formatting |
| `@nexgus/fsb-vue` | Vue 3 component |
| `@nexgus/fsb-react` | React component |

All four are versioned together by a single git tag.

### 6.1 Installing the front-end packages

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

## 7. License

[MIT](LICENSE.md)
