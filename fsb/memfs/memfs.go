// Package memfs 提供一個記憶體內的假檔案系統, 實作 github.com/nexgus/fsbrowser/fsb
// 的 FileSystem 介面, 供單元測試與範例程式使用. 這不是任何通訊協定的實作, 純粹是把一棵
// 目錄樹放在記憶體中操作.
//
// memfs 只支援單一根 ("/"), 路徑風格固定為 posix.
package memfs

import (
	"path"
	"strings"
	"sync"
	"time"

	"github.com/nexgus/fsbrowser/fsb"
)

// Node 是預載目錄樹的建構元件, 由 File, Dir, Symlink, Special 四種型別實作.
// 呼叫端以巢狀的 Dir{...} 字面值描述整棵樹, 交給 New 建構.
type Node interface {
	isNode()
}

// File 描述一個一般檔案.
type File struct {
	Size    int64
	ModTime time.Time // 為零值時以建構時間補上
}

func (File) isNode() {}

// Dir 描述一個目錄, 鍵為子項目名稱.
type Dir map[string]Node

func (Dir) isNode() {}

// Symlink 描述一個連結. Target 為連結指向的路徑 (內部形式); 指向不存在的路徑即構成
// 失效連結, 由 List / Stat 於查詢時偵測並回報 fsb.KindMissing.
type Symlink struct {
	Target  string
	ModTime time.Time
}

func (Symlink) isNode() {}

// Special 描述一個特殊檔案 (socket, fifo, device 或 unknown).
type Special struct {
	Kind    fsb.Kind
	ModTime time.Time
}

func (Special) isNode() {}

// 內部節點表示. kind 為 fsb.KindDir 時 children 有效; isLink 為 true 時 linkTarget 有效.
type node struct {
	kind       fsb.Kind
	isLink     bool
	linkTarget string
	size       int64
	modTime    time.Time
	children   map[string]*node
}

// FS 是記憶體內假檔案系統, 實作 fsb.FileSystem.
type FS struct {
	mu        sync.RWMutex
	root      *node
	home      string
	roots     []string
	pathStyle string
}

// Option 是 New 的建構選項.
type Option func(*FS)

// WithHome 設定 Home() 回傳值, 預設為 "/".
func WithHome(home string) Option {
	return func(fs *FS) { fs.home = home }
}

// WithRoots 設定 Roots() 回傳值, 預設為 []string{"/"}.
func WithRoots(roots []string) Option {
	return func(fs *FS) { fs.roots = roots }
}

// New 依 tree 描述的目錄樹建構一個 FS. tree 為根目錄的內容.
func New(tree Dir, opts ...Option) *FS {
	fs := &FS{
		root:      &node{kind: fsb.KindDir, children: map[string]*node{}},
		home:      "/",
		roots:     []string{"/"},
		pathStyle: fsb.PathStylePOSIX,
	}
	buildInto(fs.root, tree)
	for _, opt := range opts {
		opt(fs)
	}
	return fs
}

func buildInto(dst *node, tree Dir) {
	now := time.Now().UTC()
	for name, n := range tree {
		switch v := n.(type) {
		case File:
			mt := v.ModTime
			if mt.IsZero() {
				mt = now
			}
			dst.children[name] = &node{kind: fsb.KindFile, size: v.Size, modTime: mt.UTC()}
		case Dir:
			child := &node{kind: fsb.KindDir, modTime: now, children: map[string]*node{}}
			buildInto(child, v)
			dst.children[name] = child
		case Symlink:
			mt := v.ModTime
			if mt.IsZero() {
				mt = now
			}
			dst.children[name] = &node{kind: fsb.KindFile, isLink: true, linkTarget: normalize(v.Target), modTime: mt.UTC()}
		case Special:
			mt := v.ModTime
			if mt.IsZero() {
				mt = now
			}
			dst.children[name] = &node{kind: v.Kind, modTime: mt.UTC()}
		}
	}
}

// normalize 把路徑正規化為內部形式的絕對路徑 (以 "/" 分隔, 無結尾斜線, 根為 "/").
func normalize(p string) string {
	if p == "" {
		p = "/"
	}
	if !strings.HasPrefix(p, "/") {
		p = "/" + p
	}
	cleaned := path.Clean(p)
	return cleaned
}

func baseName(p string) string {
	if p == "/" {
		return "/"
	}
	return path.Base(p)
}

// splitParent 回傳 p 的父目錄路徑與最後一段名稱; p 必須是已正規化的絕對路徑, 且不可為根.
func splitParent(p string) (parent, name string) {
	idx := strings.LastIndex(p, "/")
	if idx == 0 {
		return "/", p[1:]
	}
	return p[:idx], p[idx+1:]
}

// lookup 沿路徑逐層查找節點, 不 follow 路徑末段的連結 (等同 lstat); 中間段落若為連結
// 則視為不可穿越 (memfs 的既定簡化, 測試素材不建構此情境).
func (fs *FS) lookup(p string) *node {
	p = normalize(p)
	if p == "/" {
		return fs.root
	}
	parts := strings.Split(strings.TrimPrefix(p, "/"), "/")
	cur := fs.root
	for _, part := range parts {
		if cur.kind != fsb.KindDir || cur.isLink {
			return nil
		}
		next, ok := cur.children[part]
		if !ok {
			return nil
		}
		cur = next
	}
	return cur
}

// resolveLink 沿連結鏈解析至非連結節點, 回傳其基本種類; 偵測到失效連結或循環時回傳
// fsb.KindMissing.
func (fs *FS) resolveLink(n *node) fsb.Kind {
	visited := map[*node]bool{}
	for n.isLink {
		if visited[n] {
			return fsb.KindMissing
		}
		visited[n] = true
		target := fs.lookup(n.linkTarget)
		if target == nil {
			return fsb.KindMissing
		}
		n = target
	}
	return n.kind
}

func hiddenName(name string) bool {
	return strings.HasPrefix(name, ".") && name != "." && name != ".."
}

func (fs *FS) entryFor(fullPath, name string, n *node) fsb.Entry {
	e := fsb.Entry{
		Name:    name,
		Path:    fullPath,
		Kind:    n.kind,
		IsLink:  n.isLink,
		Size:    n.size,
		ModTime: n.modTime,
		Hidden:  hiddenName(name),
	}
	if n.isLink {
		e.Target = fs.resolveLink(n)
	}
	return e
}

// List 列出 dir 目錄的內容; dir 若本身是指向目錄的連結, 會先 follow 再列出.
func (fs *FS) List(dir string) ([]fsb.Entry, error) {
	fs.mu.RLock()
	defer fs.mu.RUnlock()

	p := normalize(dir)
	n := fs.lookup(p)
	if n == nil {
		return nil, fsb.NewError(fsb.ErrNotFound, "路徑不存在: "+p)
	}
	target := n
	if n.isLink {
		resolved := fs.lookup(n.linkTarget)
		if resolved == nil {
			return nil, fsb.NewError(fsb.ErrNotFound, "失效連結無法列出: "+p)
		}
		target = resolved
	}
	if target.kind != fsb.KindDir {
		return nil, fsb.NewError(fsb.ErrIO, "並非目錄: "+p)
	}

	entries := make([]fsb.Entry, 0, len(target.children))
	for name, child := range target.children {
		childPath := p
		if childPath == "/" {
			childPath = "/" + name
		} else {
			childPath = childPath + "/" + name
		}
		entries = append(entries, fs.entryFor(childPath, name, child))
	}
	return entries, nil
}

// Stat 查詢單一路徑的屬性 (不 follow 路徑本身).
func (fs *FS) Stat(p string) (fsb.Entry, error) {
	fs.mu.RLock()
	defer fs.mu.RUnlock()

	np := normalize(p)
	n := fs.lookup(np)
	if n == nil {
		return fsb.Entry{}, fsb.NewError(fsb.ErrNotFound, "路徑不存在: "+np)
	}
	return fs.entryFor(np, baseName(np), n), nil
}

// Home 回傳建構時設定的家目錄.
func (fs *FS) Home() (string, error) {
	return fs.home, nil
}

// Roots 回傳建構時設定的根清單.
func (fs *FS) Roots() ([]string, error) {
	return fs.roots, nil
}

// PathStyle 固定回傳 "posix".
func (fs *FS) PathStyle() string {
	return fs.pathStyle
}

// MakeDir 於 p 建立一個空目錄; 父目錄必須已存在.
func (fs *FS) MakeDir(p string) error {
	fs.mu.Lock()
	defer fs.mu.Unlock()

	np := normalize(p)
	if np == "/" {
		return fsb.NewError(fsb.ErrAlreadyExists, "根目錄已存在")
	}
	if fs.lookup(np) != nil {
		return fsb.NewError(fsb.ErrAlreadyExists, "路徑已存在: "+np)
	}
	parentPath, name := splitParent(np)
	parent := fs.lookup(parentPath)
	if parent == nil || parent.kind != fsb.KindDir || parent.isLink {
		return fsb.NewError(fsb.ErrNotFound, "父目錄不存在: "+parentPath)
	}
	parent.children[name] = &node{
		kind:     fsb.KindDir,
		modTime:  time.Now().UTC(),
		children: map[string]*node{},
	}
	return nil
}

// Rename 將 oldPath 重新命名 (或搬移) 為 newPath.
func (fs *FS) Rename(oldPath, newPath string) error {
	fs.mu.Lock()
	defer fs.mu.Unlock()

	oldP := normalize(oldPath)
	newP := normalize(newPath)
	if oldP == "/" {
		return fsb.NewError(fsb.ErrPermissionDenied, "無法重新命名根目錄")
	}
	oldParentPath, oldName := splitParent(oldP)
	oldParent := fs.lookup(oldParentPath)
	if oldParent == nil {
		return fsb.NewError(fsb.ErrNotFound, "路徑不存在: "+oldP)
	}
	n, ok := oldParent.children[oldName]
	if !ok {
		return fsb.NewError(fsb.ErrNotFound, "路徑不存在: "+oldP)
	}
	if fs.lookup(newP) != nil {
		return fsb.NewError(fsb.ErrAlreadyExists, "路徑已存在: "+newP)
	}
	newParentPath, newName := splitParent(newP)
	newParent := fs.lookup(newParentPath)
	if newParent == nil || newParent.kind != fsb.KindDir || newParent.isLink {
		return fsb.NewError(fsb.ErrNotFound, "目標父目錄不存在: "+newParentPath)
	}
	delete(oldParent.children, oldName)
	newParent.children[newName] = n
	return nil
}

// Delete 刪除 path 所指的檔案或目錄. memfs 採保守語意: 非空目錄回傳 not_empty, 不遞迴刪除.
func (fs *FS) Delete(p string) error {
	fs.mu.Lock()
	defer fs.mu.Unlock()

	np := normalize(p)
	if np == "/" {
		return fsb.NewError(fsb.ErrPermissionDenied, "無法刪除根目錄")
	}
	parentPath, name := splitParent(np)
	parent := fs.lookup(parentPath)
	if parent == nil {
		return fsb.NewError(fsb.ErrNotFound, "路徑不存在: "+np)
	}
	n, ok := parent.children[name]
	if !ok {
		return fsb.NewError(fsb.ErrNotFound, "路徑不存在: "+np)
	}
	if n.kind == fsb.KindDir && !n.isLink && len(n.children) > 0 {
		return fsb.NewError(fsb.ErrNotEmpty, "目錄非空: "+np)
	}
	delete(parent.children, name)
	return nil
}

var _ fsb.FileSystem = (*FS)(nil)
