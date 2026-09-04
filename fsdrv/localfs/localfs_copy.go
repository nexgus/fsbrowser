// 本檔實作選用的遞迴複製與搬移能力 (計劃書第 3.1 節): FS 滿足 fsb.CopierContext 與
// fsb.MoverContext 兩個帶 context 的介面, 使可取消能力隨之可用; 不另外提供不帶 context
// 的 fsb.Copier / fsb.Mover 版本, 以免橋接層的能力偵測需要額外判斷兩者間的優先序.
package localfs

import (
	"context"
	"errors"
	"io"
	"io/fs"
	"os"
	"syscall"

	"github.com/nexgus/fsbrowser/fsb"
)

// ctxErr 檢查取消脈絡, 已取消或逾時時原樣回傳該脈絡的錯誤, 讓橋接層以 errors.Is 歸類
// 為 fsb.ErrCanceled (計劃書第 3.1, 3.3 節); 尚未取消時回傳 nil.
func ctxErr(ctx context.Context) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
		return nil
	}
}

// isCrossDevice 判定 err 是否為 os.Rename 因跨裝置 (跨檔案系統) 而失敗所致.
func isCrossDevice(err error) bool {
	return errors.Is(err, syscall.EXDEV)
}

// CopyContext 遞迴複製 src 到 dst (計劃書第 3.1, 5.4 節): src 為目錄時走訪整棵樹,
// overwrite 旗標在每一層一致套用; 走訪過程中定期檢查 ctx, 取消時回傳 ctx.Err().
func (f *FS) CopyContext(ctx context.Context, src, dst string, overwrite bool) error {
	return f.copyPath(ctx, cleanInternal(src), cleanInternal(dst), overwrite)
}

// copyPath 複製單一路徑節點 (檔案, 目錄或連結), 為 copyDir 遞迴呼叫的共用進入點.
func (f *FS) copyPath(ctx context.Context, srcInternal, dstInternal string, overwrite bool) error {
	if err := ctxErr(ctx); err != nil {
		return err
	}

	srcOS := toOS(srcInternal)
	info, err := os.Lstat(srcOS)
	if err != nil {
		return translate(err, srcInternal)
	}

	switch {
	case info.Mode()&fs.ModeSymlink != 0:
		return f.copySymlink(srcInternal, dstInternal, overwrite)
	case info.IsDir():
		return f.copyDir(ctx, srcInternal, dstInternal, info, overwrite)
	case info.Mode().IsRegular():
		return f.copyFile(srcInternal, dstInternal, info, overwrite)
	default:
		return fsb.NewError(fsb.ErrIO, "cannot copy special file: "+srcInternal)
	}
}

// copyDir 遞迴複製一個目錄. 目的地已存在且為目錄時, 依合併語意 (計劃書第 5.4 節) 併入
// 既有目錄, 目標原有而來源沒有的成員保留; 目的地已存在但種類不同 (例如同名檔案) 時,
// overwrite 為真才整個取代, 為偽時回報 already_exists.
func (f *FS) copyDir(ctx context.Context, srcInternal, dstInternal string, srcInfo os.FileInfo, overwrite bool) error {
	dstOS := toOS(dstInternal)
	dstInfo, err := os.Lstat(dstOS)
	switch {
	case err == nil && dstInfo.IsDir():
		// 目的地已是目錄: 併入既有內容 (合併), overwrite 只影響裡層同名項目是否覆寫,
		// 與此處是否進入該分支無關.
	case err == nil:
		if !overwrite {
			return fsb.NewError(fsb.ErrAlreadyExists, "path already exists: "+dstInternal)
		}
		if rmErr := os.RemoveAll(dstOS); rmErr != nil {
			return translate(rmErr, dstInternal)
		}
		if mkErr := os.Mkdir(dstOS, srcInfo.Mode().Perm()); mkErr != nil {
			return translate(mkErr, dstInternal)
		}
	case errors.Is(err, fs.ErrNotExist):
		if mkErr := os.Mkdir(dstOS, srcInfo.Mode().Perm()); mkErr != nil {
			return translate(mkErr, dstInternal)
		}
	default:
		return translate(err, dstInternal)
	}

	// 風險因應 (計劃書第 8 章第一項風險): 複製前先取得來源目錄的成員清單快照, 不邊
	// 走訪邊寫入; 若邊走訪邊寫入, 原地複製 (貼到來源的父目錄, 於同一目錄下產生複本)
	// 時新寫入的複本會被 os.ReadDir 之後的讀取算進本次走訪範圍, 導致誤複製或無窮遞迴.
	children, err := os.ReadDir(toOS(srcInternal))
	if err != nil {
		return translate(err, srcInternal)
	}

	for _, child := range children {
		if err := ctxErr(ctx); err != nil {
			return err
		}
		name := child.Name()
		if err := f.copyPath(ctx, joinInternal(srcInternal, name), joinInternal(dstInternal, name), overwrite); err != nil {
			return err
		}
	}
	return nil
}

// copyFile 複製一般檔案. 目的地已存在時, overwrite 為真才取代 (含目的地為目錄的情形,
// 先整棵移除再寫入新檔), 為偽時回報 already_exists.
func (f *FS) copyFile(srcInternal, dstInternal string, srcInfo os.FileInfo, overwrite bool) error {
	srcOS := toOS(srcInternal)
	dstOS := toOS(dstInternal)

	dstInfo, err := os.Lstat(dstOS)
	switch {
	case err == nil:
		if !overwrite {
			return fsb.NewError(fsb.ErrAlreadyExists, "path already exists: "+dstInternal)
		}
		if dstInfo.IsDir() {
			if rmErr := os.RemoveAll(dstOS); rmErr != nil {
				return translate(rmErr, dstInternal)
			}
		}
	case errors.Is(err, fs.ErrNotExist):
		// 目的地不存在, 直接寫入.
	default:
		return translate(err, dstInternal)
	}

	in, err := os.Open(srcOS)
	if err != nil {
		return translate(err, srcInternal)
	}
	defer in.Close()

	out, err := os.OpenFile(dstOS, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, srcInfo.Mode().Perm())
	if err != nil {
		return translate(err, dstInternal)
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

// copySymlink 複製一個符號連結本身 (不解參考), 於目的地重建相同的連結目標.
func (f *FS) copySymlink(srcInternal, dstInternal string, overwrite bool) error {
	srcOS := toOS(srcInternal)
	dstOS := toOS(dstInternal)

	target, err := os.Readlink(srcOS)
	if err != nil {
		return translate(err, srcInternal)
	}

	if dstInfo, err := os.Lstat(dstOS); err == nil {
		if !overwrite {
			return fsb.NewError(fsb.ErrAlreadyExists, "path already exists: "+dstInternal)
		}
		if dstInfo.IsDir() {
			err = os.RemoveAll(dstOS)
		} else {
			err = os.Remove(dstOS)
		}
		if err != nil {
			return translate(err, dstInternal)
		}
	} else if !errors.Is(err, fs.ErrNotExist) {
		return translate(err, dstInternal)
	}

	if err := os.Symlink(target, dstOS); err != nil {
		return translate(err, dstInternal)
	}
	return nil
}

// MoveContext 搬移 src 到 dst (計劃書第 3.1 節): 語意同 CopyContext, 但來源於成功後
// 不再存在. 先嘗試以 os.Rename 直接搬移 (同一檔案系統下為原子操作); 失敗且為跨裝置
// 錯誤時, 退為複製整棵樹後刪除來源.
func (f *FS) MoveContext(ctx context.Context, src, dst string, overwrite bool) error {
	if err := ctxErr(ctx); err != nil {
		return err
	}

	srcInternal := cleanInternal(src)
	dstInternal := cleanInternal(dst)
	srcOS := toOS(srcInternal)
	dstOS := toOS(dstInternal)

	dstInfo, statErr := os.Lstat(dstOS)
	switch {
	case statErr == nil && !overwrite:
		return fsb.NewError(fsb.ErrAlreadyExists, "path already exists: "+dstInternal)
	case statErr == nil && dstInfo.IsDir():
		srcInfo, err := os.Lstat(srcOS)
		if err != nil {
			return translate(err, srcInternal)
		}
		if srcInfo.IsDir() {
			// 目錄對目錄的覆寫語意為合併 (計劃書第 5.4 節), os.Rename 無法表達合併,
			// 一律改走複製後刪除來源的路徑.
			if err := f.copyDir(ctx, srcInternal, dstInternal, srcInfo, overwrite); err != nil {
				return err
			}
			if err := os.RemoveAll(srcOS); err != nil {
				return translate(err, srcInternal)
			}
			return nil
		}
		// 來源為檔案或連結, 目的地為目錄: 覆寫即整個取代目的地.
		if err := os.RemoveAll(dstOS); err != nil {
			return translate(err, dstInternal)
		}
	case statErr != nil && !errors.Is(statErr, fs.ErrNotExist):
		return translate(statErr, dstInternal)
	}

	if err := os.Rename(srcOS, dstOS); err != nil {
		if isCrossDevice(err) {
			return f.moveByCopy(ctx, srcInternal, dstInternal, overwrite)
		}
		return translate(err, srcInternal)
	}
	return nil
}

// moveByCopy 為跨裝置搬移的退回路徑: os.Rename 因跨檔案系統而失敗 (EXDEV) 時, 改以
// 複製整棵樹後刪除來源達成搬移語意 (計劃書第 3.1 節: 跨檔案系統的搬移如何達成由實作
// 決定).
func (f *FS) moveByCopy(ctx context.Context, srcInternal, dstInternal string, overwrite bool) error {
	if err := f.copyPath(ctx, srcInternal, dstInternal, overwrite); err != nil {
		return err
	}
	if err := os.RemoveAll(toOS(srcInternal)); err != nil {
		return translate(err, srcInternal)
	}
	return nil
}

// 確保 FS 滿足帶 context 的複製與搬移選用介面.
var (
	_ fsb.CopierContext = (*FS)(nil)
	_ fsb.MoverContext  = (*FS)(nil)
)
