# fsbrowser

[正體中文說明](docs/README.zh-Hant.md)

**fsbrowser** (FSB) is a protocol-agnostic file browser component for [Wails v3](https://wails.io) desktop applications, shipped as a Go module plus front-end packages for **Vue 3** and **React**.

The component itself knows nothing about SSH, S3, or any other protocol. It defines a small Go interface for file system operations (list, stat, home, roots, make directory, rename, delete); your application implements that interface with whatever mechanism it already has -- an SSH/SFTP session, a cloud API, the local disk, or an in-memory fake -- and gets a full-featured file browser UI in return.

> **Status**: design stage. The interfaces described below are settled by the project plan but not yet implemented; expect this repository to change rapidly.

## Features

- Directory browsing with breadcrumb-free, path-first navigation (editable path bar, parent / home buttons)
- File or directory picking, single or multiple selection, decided per invocation
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
import { FileBrowser } from "@nexgus/fsb-vue";
import zhHant from "@nexgus/fsb-core/locales/zh-Hant";
import { fsbClient } from "./fsbClient";
</script>

<template>
  <FileBrowser
    :client="fsbClient"
    mode="dir"
    :multiple="false"
    size-units="si"
    :locale="zhHant"
    theme="dark"
    @pick="(path) => console.log(path)"
    @cancel="close()"
    @error="(err) => console.warn(err.code, err.message)"
  />
</template>
```

**React**

```tsx
import { FsbProvider, FileBrowser } from "@nexgus/fsb-react";
import zhHant from "@nexgus/fsb-core/locales/zh-Hant";
import { fsbClient } from "./fsbClient";

function Picker() {
  return (
    <FsbProvider client={fsbClient}>
      <FileBrowser
        mode="file"
        multiple
        sizeUnits="iec"
        locale={zhHant}
        theme="light"
        onPick={(paths) => console.log(paths)}
        onCancel={() => setOpen(false)}
        onError={(err) => console.warn(err.code, err.message)}
      />
    </FsbProvider>
  );
}
```

Selected paths are always absolute, `/`-separated (e.g. `C:/Users/gus/data` on a Windows-style file system); convert them yourself if a consumer insists on backslashes.

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
