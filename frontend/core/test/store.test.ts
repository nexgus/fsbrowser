// 瀏覽狀態邏輯: 導覽, 選取 (含 Shift 範圍), 重新命名, 刪除確認與錯誤狀態轉換.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBrowserStore } from "@nexgus/fsb-core";
import type { BrowserStore, BrowserStoreOptions } from "@nexgus/fsb-core";
import type { MockClient, MockEntry } from "./mockClient.js";
import { createMockClient } from "./mockClient.js";

const HOME = "/home/gus";

function makeTree(): Record<string, MockEntry[]> {
  return {
    "/": [{ name: "home", kind: "dir" }],
    "/home": [{ name: "gus", kind: "dir" }],
    [HOME]: [
      { name: "docs", kind: "dir" },
      { name: "pics", kind: "dir" },
      { name: "a.txt", kind: "file", size: 1024 },
      { name: "b.txt", kind: "file" },
      { name: "c.txt", kind: "file" },
      { name: ".config", kind: "file", hidden: true },
      { name: "link-dir", kind: "file", isLink: true, target: "dir" },
      { name: "broken", kind: "file", isLink: true, target: "missing" },
      { name: "sock", kind: "socket" },
    ],
    [`${HOME}/docs`]: [{ name: "note.md", kind: "file" }],
    [`${HOME}/pics`]: [],
    [`${HOME}/link-dir`]: [{ name: "inside.txt", kind: "file" }],
  };
}

let client: MockClient;

function makeStore(options: Partial<BrowserStoreOptions> = {}): BrowserStore {
  return createBrowserStore({
    client,
    selectionMode: "file",
    ...options,
  } as BrowserStoreOptions);
}

async function readyStore(options: Partial<BrowserStoreOptions> = {}): Promise<BrowserStore> {
  const store = makeStore(options);
  await store.init();
  return store;
}

const names = (store: BrowserStore): string[] => store.getSnapshot().entries.map((entry) => entry.Name);
const path = (name: string): string => `${HOME}/${name}`;

beforeEach(() => {
  client = createMockClient({ tree: makeTree(), home: HOME, roots: ["/"] });
});

describe("初始化與導覽", () => {
  it("未提供起始目錄時用家目錄, 並取得路徑風格與根清單", async () => {
    const store = await readyStore();
    const snapshot = store.getSnapshot();
    expect(snapshot.currentDir).toBe(HOME);
    expect(snapshot.pathStyle).toBe("posix");
    expect(snapshot.roots).toEqual(["/"]);
    expect(snapshot.ready).toBe(true);
    expect(snapshot.loading).toBe(false);
    expect(client.calls).toContain("home");
  });

  it("起始目錄為開啟參數時不呼叫家目錄", async () => {
    const store = await readyStore({ initialDir: `${HOME}/docs` });
    expect(store.getSnapshot().currentDir).toBe(`${HOME}/docs`);
    expect(client.calls).not.toContain("home");
  });

  it("列表過濾隱藏項目並以目錄優先, 名稱升冪排序", async () => {
    const store = await readyStore();
    expect(names(store)).toEqual([
      "docs",
      "link-dir",
      "pics",
      "a.txt",
      "b.txt",
      "broken",
      "c.txt",
      "sock",
    ]);
  });

  it("切換隱藏項目顯示", async () => {
    const store = await readyStore();
    store.toggleHidden();
    expect(store.getSnapshot().showHidden).toBe(true);
    expect(names(store)).toContain(".config");
    store.selectOnly(path(".config"));
    store.toggleHidden();
    // 隱藏後不可見的項目一併移出選取集.
    expect(store.getSnapshot().selectedCount).toBe(0);
  });

  it("進入目錄, 連結到目錄者亦可進入; 檔案與失效連結不可進入", async () => {
    const store = await readyStore();
    await store.openEntry(path("docs"));
    expect(store.getSnapshot().currentDir).toBe(`${HOME}/docs`);

    await store.goUp();
    expect(store.getSnapshot().currentDir).toBe(HOME);

    await store.openEntry(path("link-dir"));
    expect(store.getSnapshot().currentDir).toBe(`${HOME}/link-dir`);

    await store.goUp();
    await store.openEntry(path("a.txt"));
    await store.openEntry(path("broken"));
    await store.openEntry(path("sock"));
    expect(store.getSnapshot().currentDir).toBe(HOME);
  });

  it("已在根時上層導覽為無動作", async () => {
    const store = await readyStore({ initialDir: "/" });
    expect(store.getSnapshot().atRoot).toBe(true);
    await store.goUp();
    expect(store.getSnapshot().currentDir).toBe("/");
  });

  it("路徑輸入接受 \\ 與多餘分隔符, 正規化後導覽", async () => {
    const store = await readyStore();
    await store.navigateTo("/home//gus/docs/");
    expect(store.getSnapshot().currentDir).toBe(`${HOME}/docs`);
  });

  it("切換根", async () => {
    client = createMockClient({
      tree: { "C:/": [{ name: "Users", kind: "dir" }], "D:/": [] },
      home: "C:/",
      roots: ["C:/", "D:/"],
      pathStyle: "windows",
    });
    const store = await readyStore();
    expect(store.getSnapshot().roots).toEqual(["C:/", "D:/"]);
    expect(store.getSnapshot().pathStyle).toBe("windows");
    await store.switchRoot("D:/");
    expect(store.getSnapshot().currentDir).toBe("D:/");
  });

  it("refresh 重新列出目前目錄", async () => {
    const store = await readyStore();
    await store.refresh();
    expect(client.calls.filter((call) => call === `list:${HOME}`)).toHaveLength(2);
  });

  it("訂閱者於狀態變更時被通知", async () => {
    const store = await readyStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.selectOnly(path("a.txt"));
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    store.clearSelection();
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("選取", () => {
  it("單純點選只選取該項", async () => {
    const store = await readyStore({ returnMode: "multiple" });
    store.selectOnly(path("a.txt"));
    store.selectOnly(path("b.txt"));
    expect(store.getSnapshot().selection).toEqual([path("b.txt")]);
  });

  it("Ctrl / Cmd 點選加減單項 (多選模式)", async () => {
    const store = await readyStore({ returnMode: "multiple" });
    store.selectOnly(path("a.txt"));
    store.toggleSelection(path("c.txt"));
    expect(store.getSnapshot().selection).toEqual([path("a.txt"), path("c.txt")]);
    store.toggleSelection(path("a.txt"));
    expect(store.getSnapshot().selection).toEqual([path("c.txt")]);
  });

  it("單選模式的 Ctrl 點選不累積", async () => {
    const store = await readyStore();
    store.selectOnly(path("a.txt"));
    store.toggleSelection(path("b.txt"));
    expect(store.getSnapshot().selection).toEqual([path("b.txt")]);
    store.toggleSelection(path("b.txt"));
    expect(store.getSnapshot().selection).toEqual([]);
  });

  it("Shift 範圍選以錨點為起點, 且順序與列表一致", async () => {
    const store = await readyStore({ returnMode: "multiple" });
    // 可見順序: docs, link-dir, pics, a.txt, b.txt, broken, c.txt, sock
    store.selectOnly(path("link-dir"));
    store.selectRange(path("b.txt"));
    expect(store.getSnapshot().selection).toEqual([
      path("link-dir"),
      path("pics"),
      path("a.txt"),
      path("b.txt"),
    ]);

    // 錨點不變, 連續的 Shift 點選皆以同一起點重算範圍.
    store.selectRange(path("pics"));
    expect(store.getSnapshot().selection).toEqual([path("link-dir"), path("pics")]);

    // 反向選取亦可.
    store.selectRange(path("docs"));
    expect(store.getSnapshot().selection).toEqual([path("docs"), path("link-dir")]);
  });

  it("無錨點時的 Shift 點選退化為單選", async () => {
    const store = await readyStore({ returnMode: "multiple" });
    store.selectRange(path("b.txt"));
    expect(store.getSnapshot().selection).toEqual([path("b.txt")]);
  });

  it("導覽至其他目錄時清除選取", async () => {
    const store = await readyStore();
    store.selectOnly(path("a.txt"));
    await store.navigateTo(`${HOME}/docs`);
    expect(store.getSnapshot().selection).toEqual([]);
  });
});

describe("確認選定結果", () => {
  it("檔案模式: 一般檔案與連結到檔案者可選, 目錄, 特殊檔案與失效連結不可", async () => {
    const onSelect = vi.fn();
    const store = await readyStore({ selectionMode: "file", onSelect });

    store.selectOnly(path("a.txt"));
    expect(store.getSnapshot().canConfirmSelection).toBe(true);

    for (const name of ["docs", "link-dir", "broken", "sock"]) {
      store.selectOnly(path(name));
      expect(store.getSnapshot().canConfirmSelection).toBe(false);
      store.confirmSelection();
    }
    expect(onSelect).not.toHaveBeenCalled();

    store.selectOnly(path("a.txt"));
    store.confirmSelection();
    expect(onSelect).toHaveBeenCalledWith(path("a.txt"));
  });

  it("目錄模式: 目錄與連結到目錄者可選", async () => {
    const store = await readyStore({ selectionMode: "dir" });
    store.selectOnly(path("docs"));
    expect(store.getSnapshot().canConfirmSelection).toBe(true);
    store.selectOnly(path("link-dir"));
    expect(store.getSnapshot().canConfirmSelection).toBe(true);
    store.selectOnly(path("a.txt"));
    expect(store.getSnapshot().canConfirmSelection).toBe(false);
  });

  it("單選模式要求恰好一個, 多選模式至少一個", async () => {
    const single = await readyStore({ returnMode: "single" });
    expect(single.getSnapshot().canConfirmSelection).toBe(false);
    single.selectOnly(path("a.txt"));
    expect(single.getSnapshot().canConfirmSelection).toBe(true);

    const onSelect = vi.fn();
    const multiple = await readyStore({ returnMode: "multiple", onSelect });
    expect(multiple.getSnapshot().canConfirmSelection).toBe(false);
    multiple.selectOnly(path("a.txt"));
    multiple.toggleSelection(path("c.txt"));
    expect(multiple.getSnapshot().canConfirmSelection).toBe(true);
    multiple.confirmSelection();
    expect(onSelect).toHaveBeenCalledWith([path("a.txt"), path("c.txt")]);
  });

  it("取消呼叫 onCancel", async () => {
    const onCancel = vi.fn();
    const store = await readyStore({ onCancel });
    store.cancel();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("Copy path 為內部形式, 多選時每列一個", async () => {
    const store = await readyStore({ returnMode: "multiple" });
    store.selectOnly(path("a.txt"));
    store.toggleSelection(path("docs"));
    expect(store.copyPathText()).toBe(`${path("docs")}\n${path("a.txt")}`);
  });
});

describe("重新命名", () => {
  it("完整流程: 開始, 編輯, 確認後重新列出並保留選取", async () => {
    const store = await readyStore();
    store.selectOnly(path("a.txt"));
    store.beginRename();
    expect(store.getSnapshot().rename).toEqual({
      path: path("a.txt"),
      originalName: "a.txt",
      draft: "a.txt",
    });

    store.setRenameDraft("z.txt");
    expect(store.getSnapshot().rename?.draft).toBe("z.txt");

    await store.commitRename();
    expect(client.calls).toContain(`rename:${path("a.txt")}`);
    expect(store.getSnapshot().rename).toBeNull();
    expect(names(store)).toContain("z.txt");
    expect(store.getSnapshot().selection).toEqual([path("z.txt")]);
  });

  it("名稱未變或為空時直接結束, 不呼叫 Rename", async () => {
    const store = await readyStore();
    store.beginRename(path("a.txt"));
    await store.commitRename();
    store.beginRename(path("a.txt"));
    store.setRenameDraft("   ");
    await store.commitRename();
    expect(client.calls.some((call) => call.startsWith("rename:"))).toBe(false);
  });

  it("取消重新命名", async () => {
    const store = await readyStore();
    store.beginRename(path("a.txt"));
    store.setRenameDraft("z.txt");
    store.cancelRename();
    expect(store.getSnapshot().rename).toBeNull();
    expect(names(store)).toContain("a.txt");
  });

  it("多選時不指定路徑則不進入重新命名", async () => {
    const store = await readyStore({ returnMode: "multiple" });
    store.selectOnly(path("a.txt"));
    store.toggleSelection(path("b.txt"));
    store.beginRename();
    expect(store.getSnapshot().rename).toBeNull();
  });

  it("失敗時保留編輯狀態並顯示錯誤", async () => {
    const store = await readyStore();
    client.failures.set(`rename:${path("a.txt")}`, { code: "already_exists", message: "b.txt exists" });
    store.beginRename(path("a.txt"));
    store.setRenameDraft("b.txt");
    await store.commitRename();
    expect(store.getSnapshot().rename).not.toBeNull();
    expect(store.getSnapshot().error?.code).toBe("already_exists");
  });
});

describe("建立目錄", () => {
  it("完整流程", async () => {
    const store = await readyStore();
    store.beginNewFolder();
    expect(store.getSnapshot().newFolder).toEqual({ draft: "" });
    store.setNewFolderDraft("newdir");
    await store.commitNewFolder();
    expect(client.calls).toContain(`makeDir:${HOME}/newdir`);
    expect(store.getSnapshot().newFolder).toBeNull();
    expect(names(store)).toContain("newdir");
  });

  it("取消或空名稱不呼叫 MakeDir", async () => {
    const store = await readyStore();
    store.beginNewFolder();
    store.cancelNewFolder();
    store.beginNewFolder();
    await store.commitNewFolder();
    expect(client.calls.some((call) => call.startsWith("makeDir:"))).toBe(false);
  });
});

describe("刪除", () => {
  it("確認流程: 觸發後狀態列轉為確認條, 確認後逐項刪除", async () => {
    const store = await readyStore({ returnMode: "multiple" });
    store.selectOnly(path("a.txt"));
    store.toggleSelection(path("b.txt"));
    store.requestDelete();
    expect(store.getSnapshot().deleteConfirm?.paths).toEqual([path("a.txt"), path("b.txt")]);

    await store.confirmDelete();
    expect(client.calls).toContain(`delete:${path("a.txt")}`);
    expect(client.calls).toContain(`delete:${path("b.txt")}`);
    expect(store.getSnapshot().deleteConfirm).toBeNull();
    expect(store.getSnapshot().selection).toEqual([]);
    expect(names(store)).not.toContain("a.txt");
    expect(names(store)).not.toContain("b.txt");
    expect(store.getSnapshot().error).toBeNull();
  });

  it("取消確認不刪除", async () => {
    const store = await readyStore();
    store.selectOnly(path("a.txt"));
    store.requestDelete();
    store.cancelDelete();
    expect(store.getSnapshot().deleteConfirm).toBeNull();
    await store.confirmDelete();
    expect(client.calls.some((call) => call.startsWith("delete:"))).toBe(false);
  });

  it("未選取時不進入確認", async () => {
    const store = await readyStore();
    store.requestDelete();
    expect(store.getSnapshot().deleteConfirm).toBeNull();
  });

  it("特殊檔案與失效連結亦可刪除", async () => {
    const store = await readyStore({ returnMode: "multiple" });
    store.selectOnly(path("sock"));
    store.toggleSelection(path("broken"));
    store.requestDelete();
    await store.confirmDelete();
    expect(names(store)).not.toContain("sock");
    expect(names(store)).not.toContain("broken");
  });

  it("部分失敗時彙整結果為單一錯誤並保留失敗項的選取", async () => {
    const onError = vi.fn();
    const store = await readyStore({ returnMode: "multiple", onError });
    client.failures.set(`delete:${path("docs")}`, { code: "not_empty", message: "directory not empty" });
    store.selectOnly(path("a.txt"));
    store.toggleSelection(path("docs"));
    store.requestDelete();
    await store.confirmDelete();

    const snapshot = store.getSnapshot();
    expect(snapshot.error?.code).toBe("not_empty");
    expect(snapshot.error?.message).toContain("docs: directory not empty");
    expect(snapshot.error?.operation).toBe("delete");
    expect(onError).toHaveBeenCalledTimes(1);
    expect(names(store)).toContain("docs");
    expect(names(store)).not.toContain("a.txt");
    expect(snapshot.selection).toEqual([path("docs")]);
  });
});

describe("錯誤狀態", () => {
  it("失敗時寫入狀態並同時外拋", async () => {
    const onError = vi.fn();
    const store = await readyStore({ onError });
    client.failures.set(`list:${HOME}`, { code: "disconnected", message: "connection lost" });
    await store.refresh();

    const error = store.getSnapshot().error;
    expect(error).toEqual({
      code: "disconnected",
      message: "connection lost",
      operation: "list",
      path: HOME,
    });
    expect(onError).toHaveBeenCalledWith(error);
    // 失敗的導覽不改變目前目錄, 亦不清空既有列表.
    expect(store.getSnapshot().currentDir).toBe(HOME);
    expect(names(store)).toContain("a.txt");
  });

  it("下一次成功操作自動清除錯誤", async () => {
    const store = await readyStore();
    client.failures.set(`list:${HOME}`, { code: "io_error", message: "boom" });
    await store.refresh();
    expect(store.getSnapshot().error).not.toBeNull();

    client.failures.clear();
    await store.refresh();
    expect(store.getSnapshot().error).toBeNull();
  });

  it("可手動關閉錯誤", async () => {
    const store = await readyStore();
    client.failures.set(`list:${HOME}`, { code: "io_error", message: "boom" });
    await store.refresh();
    store.dismissError();
    expect(store.getSnapshot().error).toBeNull();
  });

  it("無法辨識的拋出物歸類為 unknown", async () => {
    const store = await readyStore();
    await store.navigateTo("/no/such/dir");
    expect(store.getSnapshot().error?.code).toBe("not_found");

    client.failures.clear();
    const rogue = createMockClient({ tree: makeTree(), home: HOME });
    rogue.list = async () => {
      throw "plain string";
    };
    const other = createBrowserStore({ client: rogue, selectionMode: "file", initialDir: HOME });
    await other.init();
    expect(other.getSnapshot().error).toEqual({
      code: "unknown",
      message: "plain string",
      operation: "list",
      path: HOME,
    });
  });
});
