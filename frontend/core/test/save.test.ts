// 存檔模式與副檔名過濾: 過濾工具, 淡化與選取阻擋, 檔名輸入列, 自動補副檔名與覆寫確認.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBrowserStore, matchesExtensions, normalizeExtensions } from "@nexgus/fsb-core";
import type { BrowserStore, BrowserStoreOptions, Entry } from "@nexgus/fsb-core";
import type { MockClient, MockEntry } from "./mockClient.js";
import { createMockClient } from "./mockClient.js";

const HOME = "/home/gus";

function makeTree(): Record<string, MockEntry[]> {
  return {
    "/": [{ name: "home", kind: "dir" }],
    "/home": [{ name: "gus", kind: "dir" }],
    [HOME]: [
      { name: "docs", kind: "dir" },
      { name: "a.txt", kind: "file", size: 1024 },
      { name: "b.md", kind: "file" },
      { name: "c.TXT", kind: "file" },
      { name: "readme", kind: "file" },
      { name: ".config", kind: "file", hidden: true },
      { name: "link-dir", kind: "file", isLink: true, target: "dir" },
      { name: "sock", kind: "socket" },
    ],
    [`${HOME}/docs`]: [{ name: "note.md", kind: "file" }],
    [`${HOME}/link-dir`]: [{ name: "inside.txt", kind: "file" }],
  };
}

let client: MockClient;

async function readyStore(options: Partial<BrowserStoreOptions> = {}): Promise<BrowserStore> {
  const store = createBrowserStore({
    client,
    selectionMode: "file",
    ...options,
  } as BrowserStoreOptions);
  await store.init();
  return store;
}

const path = (name: string): string => `${HOME}/${name}`;

function entry(store: BrowserStore, name: string): Entry {
  const found = store.findEntry(path(name));
  if (found === undefined) throw new Error(`entry not found: ${name}`);
  return found;
}

beforeEach(() => {
  client = createMockClient({ tree: makeTree(), home: HOME, roots: ["/"] });
});

describe("副檔名過濾工具", () => {
  it("正規化: 去空白, 去字首, 轉小寫, 濾除空字串與重複", () => {
    expect(normalizeExtensions([" TXT ", "*.md", ".Log", "txt", "", ".", "*."])).toEqual([
      "txt",
      "md",
      "log",
    ]);
  });

  it("未提供清單時為空清單", () => {
    expect(normalizeExtensions()).toEqual([]);
    expect(normalizeExtensions([])).toEqual([]);
  });

  it("比對: 空清單一律符合, 否則不分大小寫比對結尾", () => {
    expect(matchesExtensions("anything", [])).toBe(true);
    const exts = normalizeExtensions(["txt", "MD"]);
    expect(matchesExtensions("a.txt", exts)).toBe(true);
    expect(matchesExtensions("a.TXT", exts)).toBe(true);
    expect(matchesExtensions("a.md", exts)).toBe(true);
    expect(matchesExtensions("a.markdown", exts)).toBe(false);
    expect(matchesExtensions("readme", exts)).toBe(false);
    // 僅比對結尾, 名稱中間的同名片段不算.
    expect(matchesExtensions("a.txt.bak", exts)).toBe(false);
  });
});

describe("淡化 (檔案模式)", () => {
  it("目錄與符合過濾的檔案不淡化, 其餘檔案淡化", async () => {
    const store = await readyStore({ extensions: ["txt"] });
    expect(store.isEntryDimmed(entry(store, "docs"))).toBe(false);
    expect(store.isEntryDimmed(entry(store, "link-dir"))).toBe(false);
    expect(store.isEntryDimmed(entry(store, "a.txt"))).toBe(false);
    // 比對不分大小寫.
    expect(store.isEntryDimmed(entry(store, "c.TXT"))).toBe(false);
    expect(store.isEntryDimmed(entry(store, "b.md"))).toBe(true);
    expect(store.isEntryDimmed(entry(store, "readme"))).toBe(true);
    expect(store.isEntryDimmed(entry(store, "sock"))).toBe(true);
  });

  it("淡化項目仍留在列表中, 不被隱藏", async () => {
    const store = await readyStore({ extensions: ["txt"] });
    const names = store.getSnapshot().entries.map((item) => item.Name);
    expect(names).toContain("b.md");
    expect(store.getSnapshot().itemCount).toBe(names.length);
  });

  it("目錄模式完全忽略過濾", async () => {
    const store = await readyStore({ selectionMode: "dir", extensions: ["txt"] });
    expect(store.isEntryDimmed(entry(store, "b.md"))).toBe(false);
    store.selectOnly(path("b.md"));
    expect(store.getSnapshot().selection).toEqual([path("b.md")]);
  });

  it("未提供或空過濾清單時行為完全不變", async () => {
    for (const options of [{}, { extensions: [] }, { extensions: ["", " "] }]) {
      const store = await readyStore(options);
      expect(store.isEntryDimmed(entry(store, "b.md"))).toBe(false);
      store.selectOnly(path("b.md"));
      expect(store.getSnapshot().selection).toEqual([path("b.md")]);
      expect(store.getSnapshot().canConfirmSelection).toBe(true);
    }
  });
});

describe("淡化項目不可選取", () => {
  it("點選淡化項目無動作, 且不改動既有選取", async () => {
    const store = await readyStore({ extensions: ["txt"] });
    store.selectOnly(path("a.txt"));
    store.selectOnly(path("b.md"));
    expect(store.getSnapshot().selection).toEqual([path("a.txt")]);
    store.toggleSelection(path("b.md"));
    expect(store.getSnapshot().selection).toEqual([path("a.txt")]);
  });

  it("Shift 範圍選跳過範圍內的淡化項目", async () => {
    const store = await readyStore({ returnMode: "multiple", extensions: ["txt"] });
    // 可見順序: docs, link-dir, a.txt, b.md, c.TXT, readme, sock
    store.selectOnly(path("docs"));
    store.selectRange(path("c.TXT"));
    // 範圍為 docs..c.TXT, 其中的 b.md 為淡化項目, 自動跳過.
    expect(store.getSnapshot().selection).toEqual([
      path("docs"),
      path("link-dir"),
      path("a.txt"),
      path("c.TXT"),
    ]);
  });

  it("Shift 點選的目標本身為淡化項目時無動作", async () => {
    const store = await readyStore({ returnMode: "multiple", extensions: ["txt"] });
    store.selectOnly(path("a.txt"));
    store.selectRange(path("b.md"));
    expect(store.getSnapshot().selection).toEqual([path("a.txt")]);
  });

  it("淡化項目不可作為選定結果", async () => {
    const onSelect = vi.fn();
    const store = await readyStore({ extensions: ["txt"], onSelect });
    store.selectOnly(path("a.txt"));
    expect(store.getSnapshot().canConfirmSelection).toBe(true);
    store.confirmSelection();
    expect(onSelect).toHaveBeenCalledWith(path("a.txt"));
  });
});

describe("存檔模式: 檔名輸入列", () => {
  it("預設檔名於開啟時預填, 未提供時為空字串", async () => {
    const withDefault = await readyStore({ selectionMode: "save", defaultName: "report.txt" });
    expect(withDefault.getSnapshot().saveName).toBe("report.txt");
    expect(withDefault.getSnapshot().saveNameIssue).toBeNull();

    const without = await readyStore({ selectionMode: "save" });
    expect(without.getSnapshot().saveName).toBe("");
    expect(without.getSnapshot().saveNameIssue).toBe("empty");
  });

  it("其餘模式的快照檔名欄位恆為空且無問題", async () => {
    const store = await readyStore({ defaultName: "report.txt" });
    expect(store.getSnapshot().saveName).toBe("");
    expect(store.getSnapshot().saveNameIssue).toBeNull();
  });

  it("點選檔案把檔名帶入輸入列; 目錄與淡化項目不影響", async () => {
    const store = await readyStore({ selectionMode: "save", defaultName: "report.txt", extensions: ["txt"] });
    store.selectOnly(path("a.txt"));
    expect(store.getSnapshot().saveName).toBe("a.txt");

    store.selectOnly(path("docs"));
    expect(store.getSnapshot().saveName).toBe("a.txt");

    store.selectOnly(path("b.md"));
    expect(store.getSnapshot().saveName).toBe("a.txt");
  });

  it("以 Ctrl / Cmd 點選選中檔案時同樣把檔名帶入輸入列, 以最後點到的為準; 取消選取不改動", async () => {
    const store = await readyStore({ selectionMode: "save" });
    store.toggleSelection(path("a.txt"));
    expect(store.getSnapshot().selection).toEqual([path("a.txt")]);
    expect(store.getSnapshot().saveName).toBe("a.txt");

    // 再以 Ctrl 點選另一檔案: 累積選取, 檔名以最後點到的為準.
    store.toggleSelection(path("c.TXT"));
    expect(store.getSnapshot().selection).toEqual([path("a.txt"), path("c.TXT")]);
    expect(store.getSnapshot().saveName).toBe("c.TXT");

    // 取消選取 c.TXT: 選取集減少, 但輸入列維持原檔名不變.
    store.toggleSelection(path("c.TXT"));
    expect(store.getSnapshot().selection).toEqual([path("a.txt")]);
    expect(store.getSnapshot().saveName).toBe("c.TXT");
  });

  it("以 Ctrl / Cmd 點選目錄或淡化項目時不影響檔名輸入列", async () => {
    const store = await readyStore({ selectionMode: "save", extensions: ["txt"] });
    store.toggleSelection(path("a.txt"));
    expect(store.getSnapshot().saveName).toBe("a.txt");

    store.toggleSelection(path("docs"));
    expect(store.getSnapshot().saveName).toBe("a.txt");

    // b.md 為淡化項目, 點選無動作.
    store.toggleSelection(path("b.md"));
    // 選取集依可見順序排列 (docs 排在 a.txt 之前), 與點選順序無關.
    expect(store.getSnapshot().selection).toEqual([path("docs"), path("a.txt")]);
    expect(store.getSnapshot().saveName).toBe("a.txt");
  });

  it("Shift 範圍選不帶入檔名", async () => {
    const store = await readyStore({ selectionMode: "save", returnMode: "multiple" });
    store.selectOnly(path("a.txt"));
    expect(store.getSnapshot().saveName).toBe("a.txt");
    store.setSaveName("custom.txt");
    store.selectRange(path("readme"));
    expect(store.getSnapshot().selection.length).toBeGreaterThan(1);
    expect(store.getSnapshot().saveName).toBe("custom.txt");
  });

  it("導覽切換目錄時保留檔名不清空", async () => {
    const store = await readyStore({ selectionMode: "save" });
    store.setSaveName("draft.txt");
    await store.navigateTo(`${HOME}/docs`);
    expect(store.getSnapshot().currentDir).toBe(`${HOME}/docs`);
    expect(store.getSnapshot().saveName).toBe("draft.txt");
  });

  it("檔名驗證: 空字串, 分隔符, 點名稱", async () => {
    const store = await readyStore({ selectionMode: "save" });
    const issueOf = (name: string): string | null => {
      store.setSaveName(name);
      return store.getSnapshot().saveNameIssue;
    };
    expect(issueOf("")).toBe("empty");
    expect(issueOf("   ")).toBe("empty");
    expect(issueOf(".")).toBe("invalid");
    expect(issueOf("..")).toBe("invalid");
    expect(issueOf("a/b.txt")).toBe("invalid");
    expect(issueOf("a\\b.txt")).toBe("invalid");
    // POSIX 風格下這些字元合法.
    expect(issueOf('a<b>c:"|?*.txt')).toBeNull();
    expect(issueOf("  ok.txt  ")).toBeNull();
  });

  it("Windows 風格下另有保留字元與控制字元的限制", async () => {
    client = createMockClient({ tree: makeTree(), home: HOME, roots: ["/"], pathStyle: "windows" });
    const store = await readyStore({ selectionMode: "save" });
    const issueOf = (name: string): string | null => {
      store.setSaveName(name);
      return store.getSnapshot().saveNameIssue;
    };
    for (const bad of ["a<b.txt", "a>b.txt", "a:b.txt", 'a"b.txt', "a|b.txt", "a?b.txt", "a*b.txt"]) {
      expect(issueOf(bad)).toBe("invalid");
    }
    expect(issueOf(`a${String.fromCharCode(7)}b.txt`)).toBe("invalid");
    expect(issueOf("ok.txt")).toBeNull();
  });

  it("檔名不可用或忙碌時不可確認, 且確認無動作", async () => {
    const onSelect = vi.fn();
    const store = await readyStore({ selectionMode: "save", onSelect });
    expect(store.getSnapshot().canConfirmSelection).toBe(false);
    store.confirmSelection();
    expect(onSelect).not.toHaveBeenCalled();

    store.setSaveName("new.txt");
    expect(store.getSnapshot().canConfirmSelection).toBe(true);

    // 列內編輯進行中視為忙碌.
    store.beginNewFolder();
    expect(store.getSnapshot().canConfirmSelection).toBe(false);
    store.confirmSelection();
    expect(onSelect).not.toHaveBeenCalled();
    store.cancelNewFolder();
    expect(store.getSnapshot().canConfirmSelection).toBe(true);
  });

  it("確認不看選取集, 亦不受回傳模式影響", async () => {
    const onSelect = vi.fn();
    const store = await readyStore({
      selectionMode: "save",
      returnMode: "multiple",
      defaultName: "new.txt",
      onSelect,
    });
    expect(store.getSnapshot().selection).toEqual([]);
    expect(store.getSnapshot().canConfirmSelection).toBe(true);
    store.confirmSelection();
    expect(onSelect).toHaveBeenCalledWith(path("new.txt"));
  });
});

describe("存檔模式: 自動補副檔名", () => {
  it("無副檔名時補上清單中的第一個副檔名", async () => {
    const onSelect = vi.fn();
    const store = await readyStore({
      selectionMode: "save",
      extensions: ["*.TXT", "md"],
      onSelect,
    });
    store.setSaveName("notes");
    store.confirmSelection();
    expect(onSelect).toHaveBeenCalledWith(path("notes.txt"));
  });

  it("已含副檔名者原樣保留, 即使不在清單中", async () => {
    const onSelect = vi.fn();
    const store = await readyStore({ selectionMode: "save", extensions: ["txt"], onSelect });
    store.setSaveName("notes.md");
    store.confirmSelection();
    expect(onSelect).toHaveBeenCalledWith(path("notes.md"));
  });

  it("以點開頭的名稱視為無副檔名", async () => {
    const onSelect = vi.fn();
    const store = await readyStore({ selectionMode: "save", extensions: ["txt"], onSelect });
    store.setSaveName(".bashrc");
    store.confirmSelection();
    expect(onSelect).toHaveBeenCalledWith(path(".bashrc.txt"));
  });

  it("未設過濾時不補副檔名, 檔名前後空白一律去除", async () => {
    const onSelect = vi.fn();
    const store = await readyStore({ selectionMode: "save", onSelect });
    store.setSaveName("  notes  ");
    store.confirmSelection();
    expect(onSelect).toHaveBeenCalledWith(path("notes"));
  });
});

describe("存檔模式: 覆寫確認", () => {
  it("目標已存在時進入覆寫確認, 確認後才發出結果", async () => {
    const onSelect = vi.fn();
    const store = await readyStore({ selectionMode: "save", onSelect });
    store.setSaveName("a.txt");
    store.confirmSelection();
    expect(onSelect).not.toHaveBeenCalled();
    expect(store.getSnapshot().overwriteConfirm).toEqual({ path: path("a.txt"), name: "a.txt" });

    store.confirmOverwrite();
    expect(onSelect).toHaveBeenCalledWith(path("a.txt"));
    expect(store.getSnapshot().overwriteConfirm).toBeNull();
  });

  it("取消覆寫僅清除狀態, 不發出結果", async () => {
    const onSelect = vi.fn();
    const store = await readyStore({ selectionMode: "save", onSelect });
    store.setSaveName("a.txt");
    store.confirmSelection();
    store.cancelOverwrite();
    expect(onSelect).not.toHaveBeenCalled();
    expect(store.getSnapshot().overwriteConfirm).toBeNull();
  });

  it("以完整清單判定存在與否, 隱藏項目亦計入", async () => {
    const onSelect = vi.fn();
    const store = await readyStore({ selectionMode: "save", onSelect });
    expect(store.getSnapshot().entries.map((item) => item.Name)).not.toContain(".config");
    store.setSaveName(".config");
    store.confirmSelection();
    expect(onSelect).not.toHaveBeenCalled();
    expect(store.getSnapshot().overwriteConfirm?.name).toBe(".config");
  });

  it("目標不存在時直接發出單一絕對路徑", async () => {
    const onSelect = vi.fn();
    const store = await readyStore({ selectionMode: "save", onSelect });
    store.setSaveName("new.txt");
    store.confirmSelection();
    expect(onSelect).toHaveBeenCalledWith(path("new.txt"));
    expect(store.getSnapshot().overwriteConfirm).toBeNull();
  });

  it("檔名再變更或導覽時清除覆寫確認", async () => {
    const store = await readyStore({ selectionMode: "save" });
    store.setSaveName("a.txt");
    store.confirmSelection();
    expect(store.getSnapshot().overwriteConfirm).not.toBeNull();
    store.setSaveName("a2.txt");
    expect(store.getSnapshot().overwriteConfirm).toBeNull();

    store.setSaveName("a.txt");
    store.confirmSelection();
    await store.navigateTo(`${HOME}/docs`);
    expect(store.getSnapshot().overwriteConfirm).toBeNull();
  });

  it("開始列內編輯或刪除確認時清除覆寫確認 (互斥)", async () => {
    for (const begin of ["rename", "newFolder", "delete"] as const) {
      const store = await readyStore({ selectionMode: "save" });
      store.selectOnly(path("a.txt"));
      store.confirmSelection();
      expect(store.getSnapshot().overwriteConfirm).not.toBeNull();
      if (begin === "rename") store.beginRename(path("a.txt"));
      else if (begin === "newFolder") store.beginNewFolder();
      else store.requestDelete();
      expect(store.getSnapshot().overwriteConfirm).toBeNull();
    }
  });
});

describe("存檔模式: 目標為既有目錄", () => {
  it("設定 isDirectory 提示且不發出結果", async () => {
    const onSelect = vi.fn();
    const store = await readyStore({ selectionMode: "save", onSelect });
    store.setSaveName("docs");
    store.confirmSelection();
    expect(onSelect).not.toHaveBeenCalled();
    expect(store.getSnapshot().saveNameIssue).toBe("isDirectory");
    expect(store.getSnapshot().overwriteConfirm).toBeNull();
    // 提示仍在時不可確認, 再按亦無動作.
    expect(store.getSnapshot().canConfirmSelection).toBe(false);
    store.confirmSelection();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("連結到目錄者同樣視為目錄", async () => {
    const onSelect = vi.fn();
    const store = await readyStore({ selectionMode: "save", onSelect });
    store.setSaveName("link-dir");
    store.confirmSelection();
    expect(store.getSnapshot().saveNameIssue).toBe("isDirectory");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("檔名再變更後清除提示", async () => {
    const store = await readyStore({ selectionMode: "save" });
    store.setSaveName("docs");
    store.confirmSelection();
    expect(store.getSnapshot().saveNameIssue).toBe("isDirectory");
    store.setSaveName("docs.txt");
    expect(store.getSnapshot().saveNameIssue).toBeNull();
  });

  it("導覽後清除提示", async () => {
    const store = await readyStore({ selectionMode: "save" });
    store.setSaveName("docs");
    store.confirmSelection();
    await store.navigateTo(`${HOME}/docs`);
    expect(store.getSnapshot().saveNameIssue).toBeNull();
    expect(store.getSnapshot().saveName).toBe("docs");
  });
});

describe("存檔模式: 其餘行為與檔案模式相同", () => {
  it("導覽, 建立目錄與刪除照常運作", async () => {
    const store = await readyStore({ selectionMode: "save", defaultName: "new.txt" });
    await store.openEntry(path("docs"));
    expect(store.getSnapshot().currentDir).toBe(`${HOME}/docs`);

    store.beginNewFolder();
    store.setNewFolderDraft("sub");
    await store.commitNewFolder();
    expect(store.getSnapshot().entries.map((item) => item.Name)).toContain("sub");

    store.selectOnly(`${HOME}/docs/note.md`);
    store.requestDelete();
    await store.confirmDelete();
    expect(store.getSnapshot().entries.map((item) => item.Name)).not.toContain("note.md");
  });

  it("可選判準與檔案模式相同 (供 UI 呈現選取狀態)", async () => {
    const store = await readyStore({ selectionMode: "save" });
    store.selectOnly(path("a.txt"));
    expect(store.getSnapshot().selection).toEqual([path("a.txt")]);
    expect(store.getSnapshot().saveName).toBe("a.txt");
  });
});
