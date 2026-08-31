# Implementing the file system interface

[正體中文版](interface-guide.zh-Hant.md)

fsbrowser knows nothing about SSH, S3, or the local disk. It defines one small Go interface, and your application supplies the implementation; everything the component displays comes back through that interface. This document is the complete contract: where the interface is declared, what each operation must do, what each field means, which error code to report when an operation fails, and a working implementation you can copy into a project and build. No prior familiarity with the component is assumed, and you should not need to read the component's source to get a browser running.

## 1. Where the interface lives

Everything you have to satisfy is declared in a single file: [`fsb/fsb.go`](../fsb/fsb.go). That file is the only definition site for the interface, the item type, the optional capability interfaces, the capability flags, and the error codes. There is no second place to check.

| Import path | Contents |
|---|---|
| `github.com/nexgus/fsbrowser/fsb` | The interface, `Entry`, `Kind`, `Error`, `ErrorCode`, the optional capability interfaces, `Capabilities` |
| `github.com/nexgus/fsbrowser/service` | The bridge service that exposes your implementation to the front end |

The `fsb` package imports nothing but `context`, `errors`, and `time` from the standard library, and the module itself declares no external dependencies at all. It does not import Wails, and it does not import any protocol library. Two consequences follow:

- You can write and unit-test an implementation without a GUI, without a running application, and without the `wails3` CLI.
- The component cannot make assumptions about your transport. Anything you can reach from Go -- an SSH session you already opened, a cloud storage SDK, a database, a map in memory -- can back a file browser, provided you can answer the eight questions in section 4.

Only the `service` package is Wails-aware, and you touch it once, at registration time (section 8).

## 2. Path conventions

Every path that crosses the interface, in either direction, is in *internal form*:

- Components are separated by `/`, always, on every platform.
- Paths are absolute.
- On a Windows-style file system, a drive is normalized to a `C:/` prefix -- so `C:/Users/gus/data`, never `C:\Users\gus\data`.

Backslashes are strictly a display concern. `PathStyle` (section 4.5) tells the front end which convention to render, and the front end converts for display only; the values it sends back to you, and the paths it emits to your host application through the selection event, remain in internal form.

If your implementation talks to something that expects native paths -- the `os` package on Windows, a remote shell, an API with its own addressing scheme -- the conversion in both directions is your responsibility and belongs inside your implementation. Nothing outside it should ever see a native path. Concretely:

- Convert on the way in: every path parameter you receive is internal form, and you translate it before use.
- Convert on the way out: `Entry.Path` and the value returned by `Home` must be internal form, whatever your backend handed you.

Normalize defensively as well. The example implementations run each incoming path through a cleanup step that replaces backslashes, forces a leading `/`, and collapses `.` and `..` before anything else happens, so that a path assembled elsewhere cannot reach the backend in an unexpected shape.

## 3. Describing an item

`Entry` is the record you return for a file, directory, special file, or link.

| Field | Type | Meaning |
|---|---|---|
| `Name` | `string` | The item's name, with no path attached. For a root, the root itself (`/`, or `C:/`). |
| `Path` | `string` | The item's full path in internal form. |
| `Kind` | `Kind` | The item's own basic kind. For a link this is the kind of the link itself, not of its target. |
| `IsLink` | `bool` | Whether the item is itself a link. |
| `Target` | `Kind` | Meaningful only when `IsLink` is true: the kind of what the link resolves to. |
| `Size` | `int64` | Size in bytes. |
| `ModTime` | `time.Time` | Modification time, transported as UTC. |
| `Hidden` | `bool` | Whether the item counts as hidden on this file system. |

`Kind` is a string enumeration:

| Value | Constant | Meaning |
|---|---|---|
| `file` | `fsb.KindFile` | Ordinary file |
| `dir` | `fsb.KindDir` | Directory |
| `socket` | `fsb.KindSocket` | Socket special file |
| `fifo` | `fsb.KindFIFO` | Named pipe (FIFO) |
| `device` | `fsb.KindDevice` | Device file |
| `unknown` | `fsb.KindUnknown` | Cannot be classified |
| `missing` | `fsb.KindMissing` | Only ever appears in `Target`: the link's target does not exist |

### Links

A link is described twice over, and the distinction matters to the UI:

- `Kind` describes the link itself. A link carries no kind of its own, so report `KindFile` for it. Do **not** resolve the link when filling this field: query the item without following it (`os.Lstat` rather than `os.Stat`, or the equivalent for your backend).
- `IsLink` is true.
- `Target` describes what the link points at, obtained by resolving it once. A link to a directory gets `KindDir`, a link to a file gets `KindFile`.
- A broken link -- one whose target cannot be resolved -- gets `Target` set to `KindMissing`. A broken link is not an error and must still appear in the listing.

The component uses `Target` to decide whether an item behaves like a directory: a link whose target is a directory can be navigated into and, in directory-selection mode, is selectable. If you leave `Target` at its zero value on a link, the component has no way to tell those apart, so fill it in whenever `IsLink` is true.

### Special files and unknowns

Sockets, FIFOs, and device files each get their own kind so the component can give them distinct icons. If your backend cannot classify something -- an item whose attributes could not be read, a type your protocol does not model -- return `KindUnknown` rather than guessing. `KindUnknown` is a legitimate answer; a wrong kind is not.

### A note on serialization

`Entry` carries no JSON tags, so its fields cross to the front end under their Go names (`Name`, `Path`, `Kind`, and so on). You never write that mapping yourself; it is mentioned only so the field names you see in the browser's developer tools are not a surprise.

## 4. The eight required operations

The required interface is `fsb.FileSystem`. All eight methods must be present; a missing or misspelled one is a compile error at registration time, not a run-time surprise.

| Method | One-line summary |
|---|---|
| `List(dir string) ([]Entry, error)` | Return the contents of a directory. |
| `Stat(path string) (Entry, error)` | Return the attributes of a single path. |
| `Home() (string, error)` | Return the directory the browser opens at. |
| `Roots() ([]string, error)` | Return every root of this file system. |
| `PathStyle() string` | Return `"posix"` or `"windows"` for display purposes. |
| `MakeDir(path string) error` | Create one directory. |
| `Rename(oldPath, newPath string) error` | Rename, or move, a single item. |
| `Delete(path string) error` | Delete one file or directory. |

Two conventions apply throughout, and both are easy to get wrong:

- **The component never recurses.** It never walks a tree on your behalf and never reads file contents. When the user deletes five selected items, it calls `Delete` five times, once per item.
- **All paths are internal form**, both the parameters you receive and the paths you return (section 2).

### 4.1 List

```go
List(dir string) ([]Entry, error)
```

`dir` is the directory to enumerate. Return one `Entry` per member, describing children only -- no `.` or `..` pseudo-entries.

You do not need to sort the result, and you must not filter it. The component sorts the list itself (directories first, then by name, case-insensitively) and hides hidden items itself according to the user's current toggle. Your job is to report `Hidden` correctly and return everything.

Report `ErrNotFound` when the directory does not exist, `ErrPermissionDenied` when it cannot be read, and `ErrNotFound` (not a successful empty listing) when `dir` turns out to be a file. Backends that enumerate silently -- a shell `find`, for instance, returns nothing rather than complaining when pointed at a file -- need an explicit check, otherwise the user sees an empty directory instead of an error.

**Pitfall: one bad child must not fail the whole listing.** Attributes are queried per item, and a single item can fail for reasons that say nothing about the directory: it was deleted between the enumeration and the query, or its attributes are unreadable. Failing the entire call there leaves the user staring at an error for a directory that is perfectly fine. Append a minimal record instead -- name, path, `KindUnknown`, and whatever hidden determination you can make from the name alone -- and carry on. The minimal implementation in section 6 shows the pattern.

### 4.2 Stat

```go
Stat(path string) (Entry, error)
```

Return the attributes of one path, filling in `Entry` exactly as `List` would, including the link handling described in section 3. Do not follow a link to describe the item itself.

`Stat` is not merely informational. Before pasting each item, the component calls `Stat` on the destination path to find out whether a conflict exists, and it reads your error code to decide what happens next:

- `ErrNotFound` means "nothing is in the way", and the paste proceeds without prompting.
- `ErrDisconnected` aborts the whole batch, on the assumption that the connection is gone.
- Any other error fails that one item and moves on to the next.

So a missing path must produce `ErrNotFound` specifically. Returning `ErrIO` or `ErrUnknown` for a missing path turns every ordinary paste into a reported failure.

### 4.3 Home

```go
Home() (string, error)
```

Return the directory the browser opens at -- typically the user's home directory, but any sensible starting point will do. The returned path must exist, must be a directory, and must be in internal form.

If you genuinely cannot determine one, you may return an error, but the browser then has nowhere to start; returning a root is usually a better outcome for the user than an error on the first screen. The SSH example resolves the remote home directory once at connection time and caches it, because asking the remote on every call would be wasteful and would fail exactly when the connection is already in trouble.

### 4.4 Roots

```go
Roots() ([]string, error)
```

Return every root of the file system, in internal form, in the order they should be offered. Return at least one.

- A POSIX-style file system returns a single root: `[]string{"/"}`.
- A Windows-style file system returns one entry per drive: `[]string{"C:/", "D:/"}`.

The component turns this into a root switcher, which simply never appears when there is only one root -- so a single-root implementation costs the UI nothing. Note that a drive letter is only the most familiar kind of root; a remote backend with several independent trees can present them the same way.

### 4.5 PathStyle

```go
PathStyle() string
```

Return one of two constants: `fsb.PathStylePOSIX` (`"posix"`) or `fsb.PathStyleWindows` (`"windows"`). This is the one operation that cannot fail, which is why it returns no error.

The value never changes the internal form of anything crossing the interface (section 2): a Windows-style implementation still receives and returns `C:/Users/gus`, and still sees `/` as the separator, no matter what this method returns. What it changes is how the front end treats those paths, in three places:

- **Display.** Windows style renders `/` as `\` in the path bar and trims the trailing separator from root labels, so `C:/` appears as `C:`.
- **Path comparison.** Windows style lowercases paths before comparing them, because such file systems are case-insensitive. This one is not cosmetic: the guard that refuses to paste a directory into itself compares paths, so declaring the wrong style lets a user defeat that guard by changing nothing but the case of a path.
- **Save-mode filename validation.** Windows style additionally rejects the characters that platform reserves.

Declare the style your backend actually behaves like, not the one the machine running the host happens to use. An SSH session to a Linux server reports `"posix"` even from a Windows desktop.

### 4.6 MakeDir

```go
MakeDir(path string) error
```

Create one directory at `path`. The component passes the complete path of the directory to be created -- the current directory joined with the name the user typed -- so there is no separate parent parameter.

Do not create missing parents. The parent always exists in normal use, since the user is standing in it, and quietly creating a chain of directories hides typing mistakes. Both example implementations use the non-recursive primitive deliberately (`os.Mkdir`, and `mkdir` without `-p`).

Report `ErrAlreadyExists` if something already occupies the name, and `ErrPermissionDenied` if the parent is not writable.

### 4.7 Rename

```go
Rename(oldPath, newPath string) error
```

Rename `oldPath` to `newPath`. Both are full paths, and the two may differ in their directory part: `Rename` doubles as the component's move mechanism when the optional move capability is absent (section 7.1), so an implementation that only handles same-directory renames will break cut-and-paste on hosts that rely on that fallback.

**Pitfall: do not silently overwrite.** Report `ErrAlreadyExists` when `newPath` already exists. The underlying primitive frequently does the opposite -- POSIX `rename(2)` replaces an existing target without a word -- so check for the target first and refuse. The component depends on this: when it completes a cut through the rename fallback and finds the destination occupied, it reports the conflict as a failure rather than prompting to overwrite, precisely because it cannot know whether a given implementation would overwrite or refuse. An implementation that overwrites silently destroys data the user was never asked about.

### 4.8 Delete

```go
Delete(path string) error
```

Delete the file or directory at `path`. The component calls this once per selected item and never recurses on your behalf.

**Whether a non-empty directory may be deleted is your decision**, and both answers are legitimate:

- Refuse, and report `ErrNotEmpty`. The user then has to empty the directory first. This is what the minimal implementation in section 6 does, and it is the safer default.
- Delete the whole subtree. This is what the bundled local file system implementation does, matching what desktop users expect of a file manager.

Whichever you choose, report `ErrNotFound` when the path does not exist. Backends that remove recursively should check existence first, since a recursive delete of a missing path often succeeds silently and would report success for an item that was never there.

## 5. Reporting errors

Return `*fsb.Error` from a failing operation. It carries a code your users' UI can translate and a human-readable message shown verbatim as supplementary detail:

```go
return fsb.NewError(fsb.ErrNotFound, "path does not exist: "+p)
```

The code set is frozen. Use one of these eight; do not invent your own.

| Code | Constant | When to report it |
|---|---|---|
| `not_found` | `fsb.ErrNotFound` | The path does not exist |
| `permission_denied` | `fsb.ErrPermissionDenied` | The caller is not allowed to do this |
| `already_exists` | `fsb.ErrAlreadyExists` | The destination path is already taken |
| `not_empty` | `fsb.ErrNotEmpty` | The directory is not empty |
| `disconnected` | `fsb.ErrDisconnected` | The underlying connection is gone |
| `io_error` | `fsb.ErrIO` | Any other input/output failure |
| `unknown` | `fsb.ErrUnknown` | Cannot be classified |
| `canceled` | `fsb.ErrCanceled` | The operation was interrupted by a cancel request |

A few notes on choosing among them:

- `disconnected` is for transport failures, not file failures: the session dropped, the request timed out, the client was closed. The component treats it as a reason to abandon a whole batch rather than to fail one item, so reserve it for cases where continuing is pointless. The SSH example maps connection-layer failures and operation timeouts to this code and nothing else to it.
- `canceled` normally does not need to be produced by hand. Returning the context's own error from a canceled operation is enough; see section 7.2.
- Order your classification carefully when translating backend errors. In the example implementations, the not-empty check is deliberately performed before the already-exists check, because POSIX permits a non-empty-directory failure to be reported with an error number that also satisfies the standard library's "already exists" predicate.

**Returning a plain `error` is allowed.** The bridge service normalizes every return value through `fsb.AsError`, which unwraps an `*fsb.Error` found anywhere in the error chain and otherwise wraps the error's text as `ErrUnknown`. So an implementation that has not yet classified anything still works -- the user just sees `unknown` for every failure. Classify the common cases first (`not_found`, `permission_denied`, `already_exists`) and the browser immediately behaves better.

### How the error reaches the front end

You do not have to configure anything for this to work; the chain is worth knowing only because it explains why `*fsb.Error` is the right thing to return.

1. Your implementation returns an error to the bridge service, which normalizes it to `*fsb.Error`.
2. Wails serializes a non-nil error returned from a service method with its default error marshaler -- plain `encoding/json` on the error value -- and delivers it inside the failure response.
3. Because both fields of `fsb.Error` are exported and carry JSON tags, that produces exactly `{"code": "...", "message": "..."}`. No custom marshaler is needed, and the bridge service does not install one.
4. The Wails front-end runtime throws a runtime error at the caller with the decoded payload attached as its cause, so the component reads a structured code rather than parsing a string.
5. The component wraps it once more into its own error object -- code, message, which operation failed, and which path -- and hands it to your front-end code through the `error` event or `onError` callback.

An unrecognized code arriving at the front end is coerced to `unknown`, which is another reason to stay inside the frozen set.

## 6. A minimal implementation

What follows is a complete, compiling implementation of all eight operations, using only the standard library, that browses the machine the application runs on. It is deliberately POSIX-only: a single root, native paths that already look like internal paths, and hidden items identified by a leading dot.

### Where the file goes

The Wails v3 project layout puts your Go main program and your service files in the project root, with the entire front end under `frontend/` (`frontend/src`, `package.json`, `vite.config.ts`), generated bindings under `frontend/bindings`, and the built front end at `frontend/dist` embedded into the executable. Your file system implementation is ordinary Go code with no special placement requirement: put it in the project root alongside the other service files if it is short, or in a subpackage of your own -- for example `internal/myfs/` -- if it will grow. The code below assumes the latter, in a package named `myfs`.

### `internal/myfs/myfs.go`

```go
// Package myfs implements the fsbrowser file system interface on top of the
// standard library, browsing the machine the application runs on.
//
// It targets POSIX systems (Linux, macOS), which have a single root ("/") and
// where internal paths and native paths happen to be identical.
package myfs

import (
	"errors"
	"io/fs"
	"os"
	"path"
	"strings"
	"syscall"

	"github.com/nexgus/fsbrowser/fsb"
)

// FS is the file system implementation. It holds no state, so a single value
// can serve every call.
type FS struct{}

// New creates an implementation ready to be handed to the bridge service.
func New() *FS { return &FS{} }

// Compile-time proof that FS satisfies the interface. Keep this line: it turns
// a missing or misspelled method into a build error instead of a runtime panic.
var _ fsb.FileSystem = (*FS)(nil)

// List returns the contents of dir.
func (f *FS) List(dir string) ([]fsb.Entry, error) {
	dir = clean(dir)

	names, err := os.ReadDir(dir)
	if err != nil {
		return nil, translate(err, dir)
	}

	entries := make([]fsb.Entry, 0, len(names))
	for _, de := range names {
		child := join(dir, de.Name())
		entry, err := f.stat(child)
		if err != nil {
			// A single unreadable child must not fail the whole listing: the
			// item may have been deleted while we were walking the directory.
			// Report what is known and carry on.
			entries = append(entries, fsb.Entry{
				Name:   de.Name(),
				Path:   child,
				Kind:   fsb.KindUnknown,
				Hidden: isHidden(de.Name()),
			})
			continue
		}
		entries = append(entries, entry)
	}
	return entries, nil
}

// Stat reports the attributes of a single path.
func (f *FS) Stat(p string) (fsb.Entry, error) {
	return f.stat(clean(p))
}

// stat is the shared worker behind Stat and List; p is already in internal form.
func (f *FS) stat(p string) (fsb.Entry, error) {
	// Lstat, not Stat: a symlink must be described as a symlink rather than as
	// whatever it points at.
	info, err := os.Lstat(p)
	if err != nil {
		return fsb.Entry{}, translate(err, p)
	}

	entry := fsb.Entry{
		Name:    base(p),
		Path:    p,
		Kind:    kindOf(info.Mode()),
		IsLink:  info.Mode()&fs.ModeSymlink != 0,
		Size:    info.Size(),
		ModTime: info.ModTime().UTC(),
		Hidden:  isHidden(base(p)),
	}
	if entry.IsLink {
		// Resolve the link once more, this time following it, so the component
		// can tell a link to a directory from a link to a file. A link whose
		// target is gone is reported as KindMissing.
		if target, err := os.Stat(p); err == nil {
			entry.Target = kindOf(target.Mode())
		} else {
			entry.Target = fsb.KindMissing
		}
	}
	return entry, nil
}

// Home returns the directory the browser opens at.
func (f *FS) Home() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fsb.NewError(fsb.ErrIO, "cannot determine home directory: "+err.Error())
	}
	return clean(home), nil
}

// Roots returns the single POSIX root.
func (f *FS) Roots() ([]string, error) {
	return []string{"/"}, nil
}

// PathStyle tells the front end to render paths the POSIX way.
func (f *FS) PathStyle() string {
	return fsb.PathStylePOSIX
}

// MakeDir creates one directory. Missing parents are not created.
func (f *FS) MakeDir(p string) error {
	p = clean(p)
	if err := os.Mkdir(p, 0o755); err != nil {
		return translate(err, p)
	}
	return nil
}

// Rename renames or moves a single item.
func (f *FS) Rename(oldPath, newPath string) error {
	oldPath, newPath = clean(oldPath), clean(newPath)

	// os.Rename silently replaces an existing target on POSIX, which is not the
	// contract: check first and refuse.
	if _, err := os.Lstat(newPath); err == nil {
		return fsb.NewError(fsb.ErrAlreadyExists, "path already exists: "+newPath)
	}
	if err := os.Rename(oldPath, newPath); err != nil {
		return translate(err, oldPath)
	}
	return nil
}

// Delete removes one file or one empty directory. A non-empty directory is
// refused with the not_empty code; see section 4.8 on why an implementation may
// legitimately choose to delete recursively instead.
func (f *FS) Delete(p string) error {
	p = clean(p)
	if err := os.Remove(p); err != nil {
		return translate(err, p)
	}
	return nil
}

// clean normalizes an incoming path into internal form: separators become "/",
// the result is absolute, and redundant elements are removed.
func clean(p string) string {
	p = strings.ReplaceAll(p, `\`, "/")
	if !strings.HasPrefix(p, "/") {
		p = "/" + p
	}
	return path.Clean(p)
}

// join appends a child name to a directory path in internal form.
func join(dir, name string) string {
	if strings.HasSuffix(dir, "/") {
		return dir + name
	}
	return dir + "/" + name
}

// base returns the last element of an internal path; the root is its own name.
func base(p string) string {
	if p == "/" {
		return "/"
	}
	return path.Base(p)
}

// isHidden applies the POSIX convention: a leading dot hides the item.
func isHidden(name string) bool {
	return strings.HasPrefix(name, ".") && name != "." && name != ".."
}

// kindOf maps a file mode onto the interface's kind values.
func kindOf(mode fs.FileMode) fsb.Kind {
	switch {
	case mode.IsDir():
		return fsb.KindDir
	case mode.IsRegular():
		return fsb.KindFile
	case mode&fs.ModeSocket != 0:
		return fsb.KindSocket
	case mode&fs.ModeNamedPipe != 0:
		return fsb.KindFIFO
	case mode&(fs.ModeDevice|fs.ModeCharDevice) != 0:
		return fsb.KindDevice
	case mode&fs.ModeSymlink != 0:
		// The link itself carries no kind of its own; report it as a file and
		// let Entry.Target describe what it points at.
		return fsb.KindFile
	default:
		return fsb.KindUnknown
	}
}

// translate converts an operating system error into a structured error.
func translate(err error, p string) error {
	if err == nil {
		return nil
	}
	switch {
	case errors.Is(err, fs.ErrNotExist):
		return fsb.NewError(fsb.ErrNotFound, "path does not exist: "+p)
	case errors.Is(err, fs.ErrPermission):
		return fsb.NewError(fsb.ErrPermissionDenied, "permission denied: "+p)
	case errors.Is(err, syscall.ENOTEMPTY):
		// Test this before fs.ErrExist: POSIX allows a non-empty directory to
		// be reported as EEXIST, which also satisfies fs.ErrExist.
		return fsb.NewError(fsb.ErrNotEmpty, "directory not empty: "+p)
	case errors.Is(err, fs.ErrExist):
		return fsb.NewError(fsb.ErrAlreadyExists, "path already exists: "+p)
	}
	return fsb.NewError(fsb.ErrIO, err.Error())
}
```

### What a Windows-capable version adds

Exactly three things differ on Windows, and all three are isolated well away from the eight operations:

- **Root enumeration.** `Roots` must report each existing drive as `C:/`, `D:/`, and so on, instead of the single `/` above.
- **Path style and native path conversion.** `PathStyle` returns `"windows"`, and a conversion step turns internal `C:/foo` into native `C:\foo` on the way in and back again on the way out. A drive root is a trap here: the native form must be `C:\`, since `C:` alone means "the current directory on that drive".
- **Hidden item detection.** The leading-dot rule is a POSIX convention; on Windows the hidden attribute is a real file attribute and must be read as one, with the dot rule kept only as a fallback.

The bundled local file system implementation factors precisely these three concerns into build-tagged files -- see `examples/pkg/localfs/localfs_posix.go` and `examples/pkg/localfs/localfs_windows.go`, with the shared eight operations in `examples/pkg/localfs/localfs.go`. Copy that split rather than putting platform branches inside the operations themselves.

## 7. Optional capabilities: copy and move

None of the eight required operations moves data, and the component never reads file contents, so cut, copy, and paste cannot be built on top of them. They are an opt-in capability: implement one or more extra methods on the same type, and the feature appears.

### 7.1 The four optional interfaces

```go
// Recursive copy: the implementation walks the whole tree itself.
type Copier interface {
	Copy(src, dst string, overwrite bool) error
}

// Cancellable recursive copy: same semantics, plus a context.
type CopierContext interface {
	CopyContext(ctx context.Context, src, dst string, overwrite bool) error
}

// Move: same semantics as Copy, but the source no longer exists afterward.
type Mover interface {
	Move(src, dst string, overwrite bool) error
}

// Cancellable move.
type MoverContext interface {
	MoveContext(ctx context.Context, src, dst string, overwrite bool) error
}
```

The semantics are the same across all four:

- **Recursion is yours.** When `src` is a directory, you walk the whole tree. The component issues exactly one call per top-level item the user pasted.
- **`overwrite` applies at every level.** When true, an existing item of the same name at the destination is replaced -- not only at the top, but at every level reached during the walk. When false, an existing destination is reported as `ErrAlreadyExists`, and the component then asks the user what to do and may call again with `overwrite` set.
- **Move means the source is gone on success.** How you achieve that is entirely your business. Within one file system a rename usually does the whole job at once; across file systems the underlying rename fails, and the usual answer is to copy the tree and then delete the source. A remote backend might issue a single server-side command instead. Nothing in the contract prescribes a mechanism.
- **Directory-into-directory is a merge.** When the destination already exists and both sides are directories, copy the members in rather than replacing the destination wholesale; items the destination has and the source does not are left alone. `overwrite` then governs each individual member. A plain rename cannot express a merge, which is why the move implementation below routes every overwriting move through the copy path.

There is a subtle recursion hazard worth guarding against: take a snapshot of a directory's member list before writing anything into the destination. If you enumerate lazily while writing, a copy made into the source's own parent directory can be picked up as a member of the walk that is producing it.

**Cut works even without a move capability.** If you implement copy but not move, the component completes a cut by calling the required `Rename` operation across directories -- which is why `Rename` has to accept a `newPath` in a different directory (section 4.7). Copy has no such fallback, because none of the eight required operations can duplicate data. That asymmetry is why implementing only `Mover` is not useful on its own: without a copy capability, the component withholds cut, copy, and paste entirely rather than offering half a clipboard.

### 7.2 Making an operation cancellable

Cancellation is not declared separately. The bridge service infers it from whether you implement a `*Context` variant, which keeps the declaration and the behaviour from drifting apart: an implementation cannot advertise cancel support while ignoring interruptions, because accepting the context *is* the advertisement.

The rule for the implementation is simple: check the context at every node of the walk, and return its error unchanged when it is done.

```go
if err := ctx.Err(); err != nil {
	return err
}
```

Returning `ctx.Err()` as-is is what makes cancellation report correctly. The bridge service tests copy and move results for `context.Canceled` and `context.DeadlineExceeded` before its ordinary classification, and turns either into the `canceled` error code. (If you prefer, returning `fsb.NewError(fsb.ErrCanceled, ...)` yourself works too and is passed through untouched -- but there is rarely a reason to.) A canceled operation is reported through the normal error path, and work already completed is kept, not rolled back; the component does not attempt to undo a partial paste.

The check costs nothing, so place it generously: once per node before doing any work, and again inside the loop over a directory's members, so that a large directory does not run to completion after the user has clicked cancel.

The following file completes the minimal implementation from section 6, adding both cancellable capabilities to the same type. Implementing only the `*Context` variants is the recommended shape -- there is no reason to offer a non-cancellable version alongside.

### `internal/myfs/myfs_copy.go`

```go
package myfs

import (
	"context"
	"errors"
	"io"
	"io/fs"
	"os"
	"syscall"

	"github.com/nexgus/fsbrowser/fsb"
)

// Compile-time proof that FS satisfies both cancellable optional interfaces.
var (
	_ fsb.CopierContext = (*FS)(nil)
	_ fsb.MoverContext  = (*FS)(nil)
)

// CopyContext copies src to dst, walking the whole tree when src is a
// directory. The walk checks ctx at every node, so a long copy stops shortly
// after the user cancels it.
func (f *FS) CopyContext(ctx context.Context, src, dst string, overwrite bool) error {
	return f.copyPath(ctx, clean(src), clean(dst), overwrite)
}

// copyPath copies one node: a directory (recursing), a symlink (recreated as a
// link), or a regular file.
func (f *FS) copyPath(ctx context.Context, src, dst string, overwrite bool) error {
	// One cancellation check per node. Returning ctx.Err() unchanged is what
	// lets the bridge service classify the failure as the canceled code.
	if err := ctx.Err(); err != nil {
		return err
	}

	info, err := os.Lstat(src)
	if err != nil {
		return translate(err, src)
	}

	switch {
	case info.Mode()&fs.ModeSymlink != 0:
		return copySymlink(src, dst, overwrite)
	case info.IsDir():
		return f.copyDir(ctx, src, dst, info, overwrite)
	case info.Mode().IsRegular():
		return copyFile(src, dst, info, overwrite)
	default:
		return fsb.NewError(fsb.ErrIO, "cannot copy special file: "+src)
	}
}

// copyDir recreates a directory at dst and copies its members into it. An
// existing destination directory is merged into rather than replaced; overwrite
// then governs each individual member.
func (f *FS) copyDir(ctx context.Context, src, dst string, srcInfo os.FileInfo, overwrite bool) error {
	dstInfo, err := os.Lstat(dst)
	switch {
	case err == nil && dstInfo.IsDir():
		// Merge into the existing directory.
	case err == nil:
		// Something else already occupies the destination name.
		if !overwrite {
			return fsb.NewError(fsb.ErrAlreadyExists, "path already exists: "+dst)
		}
		if err := os.RemoveAll(dst); err != nil {
			return translate(err, dst)
		}
		if err := os.Mkdir(dst, srcInfo.Mode().Perm()); err != nil {
			return translate(err, dst)
		}
	case errors.Is(err, fs.ErrNotExist):
		if err := os.Mkdir(dst, srcInfo.Mode().Perm()); err != nil {
			return translate(err, dst)
		}
	default:
		return translate(err, dst)
	}

	// Take the member list as a snapshot before writing anything. Reading the
	// directory lazily while writing into it would let a copy made into the
	// source's own parent be picked up as a member of the walk.
	children, err := os.ReadDir(src)
	if err != nil {
		return translate(err, src)
	}

	for _, child := range children {
		if err := ctx.Err(); err != nil {
			return err
		}
		name := child.Name()
		if err := f.copyPath(ctx, join(src, name), join(dst, name), overwrite); err != nil {
			return err
		}
	}
	return nil
}

// copyFile copies the contents of one regular file.
func copyFile(src, dst string, srcInfo os.FileInfo, overwrite bool) error {
	dstInfo, err := os.Lstat(dst)
	switch {
	case err == nil:
		if !overwrite {
			return fsb.NewError(fsb.ErrAlreadyExists, "path already exists: "+dst)
		}
		if dstInfo.IsDir() {
			if err := os.RemoveAll(dst); err != nil {
				return translate(err, dst)
			}
		}
	case errors.Is(err, fs.ErrNotExist):
		// Nothing in the way.
	default:
		return translate(err, dst)
	}

	in, err := os.Open(src)
	if err != nil {
		return translate(err, src)
	}
	defer in.Close()

	out, err := os.OpenFile(dst, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, srcInfo.Mode().Perm())
	if err != nil {
		return translate(err, dst)
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return fsb.NewError(fsb.ErrIO, err.Error())
	}
	if err := out.Close(); err != nil {
		return fsb.NewError(fsb.ErrIO, err.Error())
	}
	return nil
}

// copySymlink recreates a symlink at dst pointing at the same target, without
// following it.
func copySymlink(src, dst string, overwrite bool) error {
	target, err := os.Readlink(src)
	if err != nil {
		return translate(err, src)
	}

	if _, err := os.Lstat(dst); err == nil {
		if !overwrite {
			return fsb.NewError(fsb.ErrAlreadyExists, "path already exists: "+dst)
		}
		if err := os.RemoveAll(dst); err != nil {
			return translate(err, dst)
		}
	} else if !errors.Is(err, fs.ErrNotExist) {
		return translate(err, dst)
	}

	if err := os.Symlink(target, dst); err != nil {
		return translate(err, dst)
	}
	return nil
}

// MoveContext moves src to dst. Within one file system a rename does the whole
// job at once; across file systems the kernel refuses with EXDEV, and this
// implementation falls back to copying the tree and then deleting the source.
func (f *FS) MoveContext(ctx context.Context, src, dst string, overwrite bool) error {
	if err := ctx.Err(); err != nil {
		return err
	}

	src, dst = clean(src), clean(dst)

	if _, err := os.Lstat(dst); err == nil {
		if !overwrite {
			return fsb.NewError(fsb.ErrAlreadyExists, "path already exists: "+dst)
		}
		// A rename cannot express "merge into the existing directory", so send
		// every overwriting move through the copy path.
		return f.moveByCopy(ctx, src, dst, overwrite)
	} else if !errors.Is(err, fs.ErrNotExist) {
		return translate(err, dst)
	}

	if err := os.Rename(src, dst); err != nil {
		if errors.Is(err, syscall.EXDEV) {
			return f.moveByCopy(ctx, src, dst, overwrite)
		}
		return translate(err, src)
	}
	return nil
}

// moveByCopy completes a move that a rename cannot perform: copy the tree, then
// remove the source. The source is removed only after the copy has succeeded,
// so a cancelled move never destroys data it failed to duplicate.
func (f *FS) moveByCopy(ctx context.Context, src, dst string, overwrite bool) error {
	if err := f.copyPath(ctx, src, dst, overwrite); err != nil {
		return err
	}
	if err := os.RemoveAll(src); err != nil {
		return translate(err, src)
	}
	return nil
}
```

### 7.3 How capabilities reach the UI

You declare nothing. The bridge service type-asserts your registered implementation against the four optional interfaces and reduces the result to three flags:

| Flag | True when |
|---|---|
| `canCopy` | The implementation satisfies `Copier` or `CopierContext` |
| `canMove` | The implementation satisfies `Mover` or `MoverContext` |
| `canCancel` | The implementation satisfies `CopierContext` or `MoverContext` |

The assertion is performed per query rather than cached, so an implementation swapped in at run time (section 8) is reflected on the next query. When both a plain and a `*Context` variant are present, the `*Context` one is preferred, so the context is actually passed through.

The front end asks for these flags once when it starts and converges accordingly:

- **No copy capability**: cut, copy, and paste disappear completely -- both context menus drop all three commands, the toolbar paste button does not render, and the three keyboard shortcuts pass through untouched. The user can never cut something with nowhere to paste it.
- **Copy but no move**: cut still works, completed through the `Rename` fallback described in section 7.1.
- **No cancel capability**: the cancel affordance is simply not offered on a running operation.

If the capability query itself fails, all three are treated as false. A missing menu item is a smaller problem than a menu item that is guaranteed to fail.

The important consequence is that all of this is additive. A host that implements only the eight required operations keeps compiling and running exactly as before, and gains the clipboard by adding methods -- never by changing the ones it already has.

## 8. Registering your implementation

Wrap your implementation in the bridge service and register that service with the Wails application. This is the only place your code touches Wails on account of fsbrowser.

```go
package main

import (
	"embed"
	"io/fs"
	"log"

	"github.com/wailsapp/wails/v3/pkg/application"

	"github.com/nexgus/fsbrowser/service"

	"myapp/internal/myfs"
)

//go:embed all:frontend/dist
var distFS embed.FS

func main() {
	assets, err := fs.Sub(distFS, "frontend/dist")
	if err != nil {
		log.Fatal(err)
	}

	// One bridge service wrapping your implementation.
	bridge := service.New(myfs.New())

	app := application.New(application.Options{
		Name: "my-app",
		Services: []application.Service{
			application.NewService(bridge),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
	})

	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:  "my-app",
		Width:  980,
		Height: 680,
		URL:    "/",
	})

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
```

Then generate the front-end bindings:

```bash
wails3 generate bindings
```

This writes a module under `frontend/bindings` (by default) that mirrors the bridge service's methods. Your front end imports that module once and passes it to the component's client factory; see the front-end integration steps in the [README](../README.md) for those few lines.

Adding an optional capability later changes nothing here. The bridge service already exposes copy and move, so all you do is add the methods to your type and rebuild -- there is no registration step for capabilities.

### Swapping the implementation at run time

The bridge service can be handed a different implementation while the application is running, which is how a host switches between, say, the local disk and a remote host it has just connected to:

```go
bridge.SetFileSystem(otherFS)
```

The next operation uses the new implementation; operations already in flight are unaffected. This method is deliberately excluded from the generated bindings -- a Go interface cannot cross to JavaScript -- so it is available to your Go code only, and the front end simply sees the file system it is browsing change beneath it.

## 9. Where to look next

Two complete implementations ship with the repository, and between them they cover both of the shapes a real implementation tends to take.

- [`examples/pkg/localfs/`](../examples/pkg/localfs/) -- the full local file system implementation the minimal example above is a reduction of. It is worth reading for two things the minimal version omits: the build-tagged split that keeps root enumeration, path conversion, and hidden-item detection platform-specific while the eight operations stay platform-neutral, and a production-shaped recursive copy and move in `localfs_copy.go`, including the cross-device fallback and the merge semantics for directory-into-directory pastes.
- [`examples/pkg/sshfs/`](../examples/pkg/sshfs/) -- a remote implementation that wraps an existing connection. It shows how to satisfy the interface when the backend is not a file system API at all: each operation becomes a remote command whose output is parsed back into `Entry` values. It also demonstrates two techniques worth stealing -- depending on a narrow command-runner interface so the whole implementation can be unit-tested without a network, and mapping transport-layer failures onto the `disconnected` error code so the component can abandon a batch cleanly.

For the front-end side of the component -- every configuration option, event, and callback -- see [`docs/component-reference.md`](component-reference.md). For installation, the integration overview, and the front-end packages, see the [README](../README.md).
