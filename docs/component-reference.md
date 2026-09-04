# Component reference

[正體中文版](component-reference.zh-Hant.md)

This document is the complete reference for the fsbrowser (FSB) front-end packages: every prop and every event, for both the Vue 3 and the React component, cross-checked against the source. It assumes no prior familiarity with the component -- each option explains what picking it does, not just its type. For an introduction and integration steps, see the [README](../README.md); for the Go-side interface a host application must implement, see [interface-guide.md](interface-guide.md).

## 1. The client

Both components talk to your application exclusively through a `client` object of type `FsbClient` (from `@nexgus/fsb-core`). You build it once per application with `createClient`, which wraps the module that `wails3 generate bindings` produced for the fsbrowser bridge service:

```ts
import { createClient } from "@nexgus/fsb-core";
import * as bindings from "./bindings/github.com/nexgus/fsbrowser/fsb/service/service.js";

export const fsbClient = createClient(bindings);
```

`createClient` checks at call time that the bindings module exposes all eleven required methods (`List`, `Stat`, `Home`, `Roots`, `PathStyle`, `MakeDir`, `Rename`, `Delete`, `Capabilities`, `Copy`, `Move`) and throws immediately, naming the missing ones, if it does not -- so a wiring mistake surfaces at startup rather than the first time a user clicks something.

The Wails v3 bindings generator can produce two different shapes for the same service, and both are in active use by the example apps in this repository:

- **Import the generated implementation file directly.** The generator's `index.js` for a service re-exports the implementation under a named object (`{ Service }`); importing `service.js` instead gives you the flat method set that `createClient` expects, with no further unwrapping:

  ```ts
  import * as bindings from "./bindings/github.com/nexgus/fsbrowser/fsb/service/service.js";
  import { createClient } from "@nexgus/fsb-core";

  export const fsbClient = createClient(bindings);
  ```

- **Import the index file and pull out the service object.** If you import the package's `index.js` instead, the flat method set is one property deep, under the name of the registered service:

  ```ts
  import { createClient } from "@nexgus/fsb-core";
  import * as bindings from "./bindings/github.com/nexgus/fsbrowser/fsb/service/index.js";

  export const fsbClient = createClient(bindings.Service);
  ```

Either import path works; pick whichever matches how the rest of your bindings are already imported. Whichever you choose, keep it to a single file in your application -- the rest of your front end should only ever import `fsbClient` from that file, never the raw bindings module.

With the client built, each framework has its own way of handing it to the component:

**Vue 3** takes the client as a prop, `client`, on `<FsBrowser>`. There is also a `provide`/`inject` path (the export `fsbClientKey`) for supplying it once to an entire subtree instead of repeating the prop on every instance; the prop takes priority when both are present.

```vue
<script setup lang="ts">
import { FsBrowser } from "@nexgus/fsb-vue";
import { fsbClient } from "./fsbClient.js";
</script>

<template>
  <FsBrowser :client="fsbClient" selection-mode="file" @select="onSelect" @cancel="onCancel" />
</template>
```

**React** accepts the client the same way, as a `client` prop, and additionally offers a dedicated provider component, `FsbClientProvider`, that injects the client into a subtree via context. The prop again takes priority when both are present; omitting both throws.

```tsx
import { FsBrowser, FsbClientProvider } from "@nexgus/fsb-react";
import { fsbClient } from "./fsbClient.js";

function Picker() {
  return (
    <FsbClientProvider client={fsbClient}>
      <FsBrowser selectionMode="file" onSelect={handleSelect} onCancel={handleCancel} />
    </FsbClientProvider>
  );
}
```

Passing `client` directly on `<FsBrowser>` in React works too and needs no provider:

```tsx
<FsBrowser client={fsbClient} selectionMode="file" onSelect={handleSelect} onCancel={handleCancel} />
```

## 2. Props

All props below are read once the panel is mounted; changing most of them after the fact has no defined behaviour since the panel is meant to be mounted fresh per invocation (typically inside a modal that you open and close).

### 2.1 Required props

| Vue | React | Type | Required | Notes |
|---|---|---|---|---|
| `client` | `client` | `FsbClient` | Yes, unless supplied via injection/context | The bridge to your application; see section 1. |
| `selection-mode` | `selectionMode` | `"file" \| "dir" \| "save"` | Yes | What the user is being asked to pick. `"file"` and `"dir"` restrict which entries can be selected (see 2.2); `"save"` behaves like `"file"` for browsing but adds a filename row (see section 5). |

### 2.2 Selection and filtering

`selection-mode` governs which rows the user is *allowed* to select. In `"dir"` mode, only directories (and symlinks resolving to a directory) are selectable; regular files, sockets, FIFOs, device files, and broken links are shown but cannot be picked. In `"file"` and `"save"` mode, only regular files (and symlinks resolving to one) are selectable; directories remain enterable by double-click but cannot be the final selection.

`return-mode` / `returnMode` (`"single" | "multiple"`, default `"single"`) decides the *shape* of the result handed to `onSelect`: a single path string, or an array of path strings. It does not change how many rows the user can click -- Ctrl/Cmd-click and Shift-click always extend the selection regardless of return mode, because batch operations (cut, copy, delete) need multi-row selection to be usable even when the panel is ultimately configured to return one path. What return mode actually gates is the confirm button and the status bar: in single mode, having more than one row selected disables confirming and the status bar explains why, until the selection is pared back down to one.

`extensions` (`string[]`, no default) restricts which files count as selectable in `"file"` and `"save"` mode; directories are never affected by it. Entries that do not match are dimmed rather than removed from the list, so the user can still see and enter directories that contain only non-matching files. See section 5 for exactly how matching and the leading `*.`/`.` are handled, and for how a semicolon-delimited glob string from an existing host UI converts into this array.

### 2.3 Presentation

| Vue | React | Type | Default | What it does |
|---|---|---|---|---|
| `locale` | `locale` | `LocalePack` | built-in English | Overrides UI text; see section 9. |
| `theme` | `theme` | `ThemeName \| "auto" \| ThemeOverrides` | built-in light | Chooses the visual palette; see section 8. |
| `size-unit` | `sizeUnit` | `"si" \| "iec"` | `"si"` | File-size formatting: `"si"` uses decimal units (kB, MB, GB, powered by 1000); `"iec"` uses binary units (KiB, MiB, GiB, powered by 1024). Purely cosmetic -- it does not change any byte counts, only how the size column renders them. |
| `initial-dir` | `initialDir` | `string` | the client's home directory | Directory the panel opens into. Leave unset to use whatever `client.home()` returns; set it to reopen the panel where the user left off, or to scope a picker into a subtree the user is expected to work within (note that this is a starting point only -- the user can still navigate anywhere the client allows). |
| `default-name` | `defaultName` | `string` | `""` | Save-mode only; ignored in `"file"` and `"dir"` mode. Pre-fills the filename row when the panel opens. See section 5. |

### 2.4 Full table

| Vue prop | React prop | Type | Default | Required | Description |
|---|---|---|---|---|---|
| `client` | `client` | `FsbClient` | -- | Yes (or via injection/context) | Bridge to the host application; see section 1. |
| `selection-mode` | `selectionMode` | `"file" \| "dir" \| "save"` | -- | Yes | What kind of entry the user is picking; also controls whether the filename row (save mode) appears. |
| `return-mode` | `returnMode` | `"single" \| "multiple"` | `"single"` | No | Shape of the value passed to `onSelect`: one path, or an array. Does not limit how many rows can be selected while browsing (see 2.2). |
| `locale` | `locale` | `LocalePack` | built-in English | No | Text overrides; missing keys fall back to English automatically. |
| `theme` | `theme` | `ThemeName \| "auto" \| ThemeOverrides` | built-in light | No | `"light"`, `"dark"`, `"auto"` (follows the OS preference live), or a partial token table for a custom palette. |
| `size-unit` | `sizeUnit` | `"si" \| "iec"` | `"si"` | No | Decimal vs. binary units in the size column. |
| `initial-dir` | `initialDir` | `string` | client's home directory | No | Starting directory, internal form. |
| `default-name` | `defaultName` | `string` | `""` | No | Save mode only: initial content of the filename row. |
| `extensions` | `extensions` | `string[]` | none (no filtering) | No | Restricts selectable files in `"file"`/`"save"` mode; ignored in `"dir"` mode. |

## 3. Events

| Vue event | React prop | Argument type | Fires when |
|---|---|---|---|
| `select` | `onSelect` | `string \| string[]` (per `returnMode`) | The user confirms a selection (Select/Save button, double-clicking a selectable entry in single mode, or Enter in the save-mode filename row) or confirms an overwrite in save mode. Save mode always emits a single string regardless of `returnMode`. |
| `cancel` | `onCancel` | none | The user clicks Cancel, or the host otherwise decides to close the panel and calls the store's `cancel()` -- the component never closes itself; your app is expected to unmount or hide it in response to this event. |
| `error` | `onError` | `FsbError` | Any client call fails. Fires at the same moment the status bar renders the error, so `onError` is for logging/telemetry rather than duplicate UI -- the status bar already shows the message to the user. |
| `warning` | `onWarning` | `FsbWarning` | Currently fired once: when a paste is blocked because its destination is the source itself or a descendant of it (nested paste, see 6.2). Optional -- if you don't handle it, the user still sees nothing happen to those items, just without an explanation. |

### The error object (`FsbError`)

```ts
interface FsbError {
  code: ErrorCode;      // see table below
  message: string;      // implementation-supplied human-readable detail
  operation: FsbOperation; // "list" | "stat" | "home" | "roots" | "pathStyle" |
                             // "makeDir" | "rename" | "delete" | "capabilities" |
                             // "copy" | "move"
  path?: string;         // the path involved, when the operation has one
}
```

`code` is one of a fixed set (`frontend/core/src/errors.ts`); any value your implementation returns that isn't recognized becomes `"unknown"`. `message` is your implementation's own text, shown as a parenthesized detail alongside the code's built-in translated summary (see `error.withDetail` in section 9).

| Code | Built-in English text |
|---|---|
| `not_found` | Path not found. |
| `permission_denied` | Permission denied. |
| `already_exists` | The target already exists. |
| `not_empty` | The directory is not empty. |
| `disconnected` | The connection was lost. |
| `canceled` | The operation was canceled. |
| `io_error` | An input/output error occurred. |
| `unknown` | An unexpected error occurred. |

### The warning object (`FsbWarning`)

```ts
interface FsbWarning {
  code: "nestedPaste";       // the only code today
  paths: readonly string[];  // source paths that were blocked
  targetDir: string;         // the destination directory at the time
}
```

`FsbWarning` is deliberately a closed, extensible shape (a `code` plus whatever data that code needs) so future warning kinds can be added without breaking existing `onWarning` handlers that switch on `code`.

## 4. Selection behaviour

The list supports both single- and multi-row selection regardless of `returnMode`:

- A plain click selects only that row, replacing any prior selection, and sets it as the anchor for range selection.
- Ctrl-click (Cmd-click on macOS) toggles that row in or out of the current selection without disturbing the rest.
- Shift-click selects the contiguous range between the last anchor and the clicked row. The anchor does not move on a Shift-click, so repeated Shift-clicks keep extending or shrinking the range from the same starting point. Dimmed rows (filtered out by `extensions`) inside the range are skipped, never added to the selection.
- Double-clicking a directory (or a symlink resolving to one) opens it. Double-clicking a selectable file in single-selection mode selects it and immediately confirms, saving a click.

In `returnMode="single"`, the confirm button (Select/Save) is disabled whenever more than one row is selected, and the status bar shows "Only one item can be confirmed." for as long as that's true -- it does not silently pick the first or last selected item. Reducing the selection back to exactly one (or zero-then-one) re-enables confirming.

`returnMode="multiple"` requires only that at least one row be selected, and no upper bound applies.

## 5. Save mode and extension filtering

Setting `selection-mode="save"` (`selectionMode="save"` in React) keeps the panel's browsing behaviour identical to file mode but adds a filename input row between the list and the status bar. The row is pre-filled from `default-name`/`defaultName` when the panel opens (empty string if you don't pass one).

Clicking an existing file in the list (a plain click, or a Ctrl/Cmd-click that adds it to the selection) writes that file's name into the filename row, overwriting whatever was typed there; clicking a directory only navigates and does not touch the row. If Ctrl/Cmd-clicking *deselects* a file, the row is left alone. This means the filename row always reflects "the file the user most recently pointed at," not necessarily anything about the current selection set -- confirming in save mode uses the filename row alone and ignores the selection entirely, even if several items happen to be selected for some other reason (e.g. a batch delete performed while the panel happened to be in save mode).

Confirming (the Save button, or Enter in the filename row) validates the typed name:

- Empty (after trimming) -- the confirm button stays disabled and no event fires.
- Contains a path separator, or is exactly `.` or `..`, or -- when the client reports Windows path style -- contains one of the Windows-reserved characters (`< > : " | ? *`) or a control character -- the row shows an "invalid characters" message and confirm stays disabled.
- Names an existing directory -- confirm shows an "is an existing directory, choose another name" message instead of proceeding.
- Names an existing file -- confirm does not emit `select` immediately; instead the status bar switches to a non-modal overwrite confirmation ("*name* already exists. Overwrite?") with Cancel and Overwrite buttons. Only confirming that step emits `select`.
- Otherwise -- `select` fires immediately with a single absolute path (current directory joined with the typed name).

`returnMode` has no effect in save mode: the emitted value is always a single string, never an array, because there is exactly one filename row to confirm.

The component never writes anything to disk itself in any mode, including save mode -- it only tells you the path the user chose; performing the actual save is your application's responsibility.

### Extension filtering

`extensions` (an array of bare extensions, e.g. `["yaml", "yml"]`) applies in both `"file"` and `"save"` mode; it is ignored entirely in `"dir"` mode. Each entry is normalized before use: surrounding whitespace is trimmed, a leading `*.` or `.` is stripped, and comparison against filenames is case-insensitive -- so `"yaml"`, `".yaml"`, and `"*.yaml"` are all equivalent inputs.

Files that don't match are **dimmed, not hidden**: they still appear in the list (so the user isn't confused about where a file went), but they cannot be clicked into the selection and are skipped over by Shift-click range selection. Directories are never dimmed by this filter, matching or not, since navigating through them is unaffected by what kind of file you're ultimately looking for.

In save mode specifically, if the user types a bare filename with no extension (a `.` only as the very first character, as in `.bashrc`, does not count as having one) and `extensions` is non-empty, the component appends the *first* extension in the list automatically before emitting `select`. A name that already carries an extension is left exactly as typed, even if that extension isn't in the list.

If your host application currently expresses this kind of filter as a single semicolon-delimited glob string (a pattern like `*.yaml;*.yml`), convert it yourself before passing it as `extensions`: split on `;`, trim each piece, and drop empty results. You do not need to strip the leading `*.` -- the component's own normalization handles that:

```ts
const extensions = filterString
  .split(";")
  .map((item) => item.trim())
  .filter((item) => item.length > 0);
```

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

## 6. Cut, copy, and paste

### 6.1 What unlocks it

None of the file system operations a host is required to implement can move or duplicate data, so cut/copy/paste is entirely opt-in. Your Go implementation unlocks it by additionally satisfying one or more of four optional interfaces (`Copier`, `CopierContext`, `Mover`, `MoverContext` -- see [interface-guide.md](interface-guide.md#71-the-four-optional-interfaces) for their signatures); the bridge service detects which ones your implementation satisfies and reports the result to the front end as three booleans: `canCopy`, `canMove`, `canCancel`. The component queries this once via `client.capabilities()` when it initializes and does not re-check it for the lifetime of a single panel instance (a host that swaps its file system implementation at runtime and wants the panel to pick up new capabilities needs to remount the panel, or call the store's `refreshCapabilities()` if driving the store directly).

Everything in this section keys off `canCopy` first. Cut, copy, and paste are treated as a single unit that rises and falls together: if `canCopy` is false, all three are withheld, regardless of what `canMove` or `canCancel` report, because a host that can cut but has nowhere to paste would be a broken half-feature. Concretely, with `canCopy` false:

- Both context menus (on an item, and on empty list space) omit Cut, Copy, and Paste entirely -- they are not shown disabled, they do not render at all.
- The toolbar's paste button does not render (the toolbar's other buttons keep their positions; no gap is left).
- The three keyboard shortcuts (Cut/Copy/Paste) are not intercepted at all -- key presses pass through to whatever the browser or OS would otherwise do with them.

With `canCopy` true but `canMove` false, Cut still works from the user's point of view: the component detects the missing move capability and completes cut-then-paste by calling the client's existing `rename` operation across directories instead of a real move. This fallback has one behavioural difference worth knowing: if the fallback rename's destination already exists, the component treats that as a failure rather than offering the usual overwrite prompt, because it cannot guarantee what your `rename` implementation does to an existing target (silently replace it, silently fail, or something else) -- the safe default is to not attempt it.

`canCancel` only matters once a copy or move is actually running (see 6.2); it is derived from whether your implementation accepted and honored a `context.Context` in the `*Context` variant, not declared as a separate flag on your side.

### 6.2 Conflicts, cancellation, and nested paste

**Progress and conflicts.** A paste processes the clipboard's top-level items one at a time (never in parallel), showing "Copying N of M..." or "Moving N of M..." in the status bar as it goes. Before writing each item, the component checks whether something already exists at the destination name:

- If the existing entry and the incoming item are different kinds (one's a file, the other's a directory), the item is rejected outright with no overwrite option offered -- overwriting there would mean replacing an entire directory tree with a single file or vice versa, a mistake too costly to make one click away.
- Otherwise the status bar turns into a non-modal conflict prompt scoped to that one item: **Overwrite**, **Overwrite All**, **Skip**, **Skip All**, **Cancel**. "All" choices are remembered only for the remainder of the current paste batch -- they don't persist to the next paste you trigger.

**Cancellation.** The Cancel button shown during an in-progress copy/move only appears when `canCancel` is true for that operation. Canceling stops the batch at whatever item is currently in flight; items already completed before the cancel are **kept, not rolled back** -- the component makes no attempt to undo prior successes, since a partial-but-honest result is preferable to guessing at a cleanup that might itself fail. The result is reported through the normal error path with the `canceled` error code. The cut clipboard is preserved (not cleared) when a paste ends in cancellation or disconnection, so the user can retry the paste without reselecting; on a fully completed cut-paste, the clipboard is cleared. A copy's clipboard is never cleared automatically, letting the user paste the same items again.

**Nested paste.** Pasting into the source item itself, or into any directory that is a descendant of it, is always blocked entirely on the front end -- the component never even calls your file system for that item. This check is purely path-based (comparing the destination against the source path, case-insensitively when the client reports Windows path style), not based on how the user navigated there, since the same directory can be reached by more than one route. Blocked items do not appear in the status bar's conflict or error flow at all; instead, once the whole paste batch finishes, the component calls `onWarning` once with the full list of blocked source paths and the destination directory that triggered the block (the `warning` event in Vue). If you don't handle `onWarning`, those items are simply left where they were, with no visible explanation to the user -- handling it (even just logging it, or surfacing a toast) is recommended for any host that expects users to attempt this.

**Vue 3**

```vue
<FsBrowser :client="fsbClient" ... @warning="(w) => console.warn(w.code, w.paths)" />
```

**React**

```tsx
<FsBrowser ... onWarning={(w) => console.warn(w.code, w.paths)} />
```

## 7. Keyboard shortcuts and context menus

Cut, copy, and paste each have a keyboard shortcut, active only while the list itself has keyboard focus (clicking a row, or opening a context menu, moves focus there for you): ⌘X/⌘C/⌘V on macOS, Ctrl+X/Ctrl+C/Ctrl+V elsewhere. The platform is auto-detected from the browser's user agent -- it is not configurable via props, since the component has no more information about the user's actual keyboard than the browser gives it. The key handler itself accepts both the Meta and Ctrl modifiers regardless of detected platform, so a mismatch in the *displayed* label never breaks the shortcut's function, only its cosmetic hint. Shortcuts are not intercepted while an inline edit (rename or new-folder) is active, or while focus is inside a text input -- the input's own native cut/copy/paste takes over in that case. As covered in section 6.1, all three shortcuts are inert when `canCopy` is false.

**Context menu on an item** (right-click a row; if the row wasn't already part of the selection, right-clicking it selects it first):

1. Copy Path -- writes the selected paths (one per line) to the system clipboard as text, via `navigator.clipboard`.
2. *(separator)*
3. Cut -- shown only when `canCopy` is true.
4. Copy -- shown only when `canCopy` is true.
5. *(separator, present only alongside items 3-4)*
6. Rename -- disabled unless exactly one item is selected.
7. Delete -- shows the count when more than one item is selected ("Delete 3 items").

**Context menu on empty list space** (right-click anywhere in the list that isn't a row):

1. New folder
2. Paste -- shown only when `canCopy` is true **and** the clipboard currently holds something; disabled (shown but greyed) when paste isn't currently runnable for some other reason (e.g. an operation already in progress).
3. *(separator, present only alongside Paste)*
4. Refresh
5. Show hidden -- a checkable toggle reflecting the current hidden-files visibility.

**Toolbar**, left to right: parent directory, home directory, root switcher (only rendered when the client reports more than one root, e.g. Windows drive letters -- a single-root system never shows it), the editable path bar, new folder, paste (only rendered when `canCopy` is true; unlike the menus, this button's presence doesn't flicker mid-session since capabilities are queried once at startup), refresh, and a show/hide-hidden-files toggle.

Both context menus are in-panel popovers, not native OS windows -- they close on an outside click or Escape, and render within the panel's own coordinate space.

## 8. Theming

Two built-in themes ship with the component, `"light"` and `"dark"`, plus an `"auto"` mode that resolves to whichever one matches the OS's `prefers-color-scheme` at the moment the panel renders, and **keeps following it live** -- both frameworks subscribe to the media query change event for as long as `theme="auto"` is set, so a user switching their OS appearance mid-session sees the panel repaint without needing to reopen it. Passing `"light"` or `"dark"` explicitly pins the theme and ignores the OS setting.

Both built-in themes, and any custom theme, are expressed as one flat table of named string tokens -- colors, font stacks, font sizes, and a handful of geometry values (border radius, control height, row height, icon size). A custom theme is any plain object with a subset of these token keys; any key you omit falls back to the built-in light theme's value for that key, so overriding just the accent color, for instance, is enough to reskin the accent without redefining everything else. Internally each token becomes a CSS custom property named `--fsb-<kebab-case-key>` (e.g. the `accent` token becomes `--fsb-accent`), scoped to the panel's root element.

The authoritative list of token keys is the set of keys on the built-in light theme in `frontend/core/src/theme.ts`, exported as `THEME_KEYS` from `@nexgus/fsb-core`; import and inspect it (or read that file directly) for the exact current set, since it is allowed to grow across releases -- new tokens are additive, not breaking. As of this writing it includes, among others: `appBg`, `panelBg`, `panelBorder`, `sectionBorder`, `rowBorder`, `subtleBg`, `buttonBg`, `textPrimary`, `textSecondary`, `textMuted`, `accent`, `selectedRowBg`, `errorText`, `errorBg`, `dangerBg`, `folderIcon`, `fileIcon`, `fontFamily`, `fontFamilyMono`, `fontSizeTitle`, `fontSizeRow`, `fontSizeStatus`, `fontSizeLabel`, `fontSizeMono`, `fontWeightTitle`, `radius`, `radiusPanel`, `controlHeight`, `rowHeight`, and `iconSize`.

```ts
import type { ThemeOverrides } from "@nexgus/fsb-core";

const brandTheme: ThemeOverrides = {
  accent: "#a8433a",
  selectedRowBg: "#f6e3e1",
};
```

**Vue 3**

```vue
<FsBrowser :client="fsbClient" :theme="brandTheme" ... />
```

**React**

```tsx
<FsBrowser client={fsbClient} theme={brandTheme} ... />
```

## 9. Localization

English is built into the component and used whenever no `locale`/`locale` prop is supplied, or for any individual text key a supplied language pack leaves out -- a partial translation is a valid language pack, it just shows English for the gaps rather than an empty string or a raw key name. There is no automatic language detection from the browser or OS; the host picks the language explicitly, per invocation, by passing (or not passing) a locale.

The Traditional Chinese pack that ships alongside the core package is imported and supplied the same way any custom pack would be -- it has no special standing in the component itself:

**Vue 3**

```vue
<script setup lang="ts">
import { FsBrowser } from "@nexgus/fsb-vue";
import { zhHant } from "@nexgus/fsb-locales";
</script>

<template>
  <FsBrowser :client="fsbClient" :locale="zhHant" ... />
</template>
```

**React**

```tsx
import { FsBrowser } from "@nexgus/fsb-react";
import { zhHant } from "@nexgus/fsb-locales";

<FsBrowser client={fsbClient} locale={zhHant} ... />;
```

A custom language pack is a plain object whose keys are a subset of the built-in English pack's keys (the `LocalePack` type is `Partial<Messages>`) and whose values are strings, some of which contain named placeholders in `{curlyBraces}` form that get substituted at render time (e.g. `"status.items": "{count} items"`). If a value you supply is missing a placeholder your text needs, or a placeholder name doesn't match what the component passes in, the literal `{placeholderName}` text is left in place rather than silently disappearing, so a mismatch is visible during review rather than showing up as unexplained blank text in production:

```ts
import type { LocalePack } from "@nexgus/fsb-core";

const myPack: LocalePack = {
  "title": "Choose a file",
  "button.cancel": "Never mind",
  "status.items": "{count} entries",
};
```

The full set of keys a pack can translate -- titles, toolbar tooltips, column headers, status bar messages, context menu labels, buttons, error summaries, and entry-kind names -- is defined in `frontend/core/src/i18n.ts` (the built-in `en` export) and re-exported as `MESSAGE_KEYS` from `@nexgus/fsb-core`; that file is the authoritative list to copy from when building a new pack, since (like theme tokens) new keys are added over time.

## 10. Where to look next

- [interface-guide.md](interface-guide.md) -- the complete guide to the Go-side interface a host application implements, including the required file system operations and the optional copy/move capabilities referenced in section 6.
- [../README.md](../README.md) -- project overview, integration steps, the example apps, and how to install the front-end packages.
