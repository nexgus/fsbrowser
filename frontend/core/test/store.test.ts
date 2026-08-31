// 瀏覽狀態邏輯: 導覽, 選取 (含 Shift 範圍), 重新命名, 刪除確認與錯誤狀態轉換.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBrowserStore } from "@nexgus/fsb-core";
import type { BrowserStore, BrowserStoreOptions, PasteConflictChoice } from "@nexgus/fsb-core";
import type { MockClient, MockClientOptions, MockEntry } from "./mockClient.js";
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

// --- 剪貼與貼上 (計劃書第 5 章) 測試用具 ---

const destPath = (name: string): string => `${HOME}/dest/${name}`;

/**
 * makeClipboardTree 建立剪貼測試專用的目錄表, 與 makeTree() 分開以免影響既有測試對
 * makeTree() 精確排序結果的斷言. dest 目錄的初始內容由呼叫端指定, 供衝突情境使用.
 */
function makeClipboardTree(destEntries: MockEntry[] = []): Record<string, MockEntry[]> {
  return {
    "/": [{ name: "home", kind: "dir" }],
    "/home": [{ name: "gus", kind: "dir" }],
    [HOME]: [
      { name: "src", kind: "dir" },
      { name: "dest", kind: "dir" },
      { name: "a.txt", kind: "file" },
      { name: "b.txt", kind: "file" },
      { name: "c.txt", kind: "file" },
      { name: "new.txt", kind: "file" },
    ],
    [`${HOME}/src`]: [{ name: "inner.txt", kind: "file" }],
    [`${HOME}/dest`]: destEntries,
  };
}

function makeClipboardClient(
  options: Partial<Pick<MockClientOptions, "canCopy" | "canMove" | "canCancel">> & {
    destEntries?: MockEntry[];
  } = {},
): MockClient {
  const { destEntries, ...capabilityOptions } = options;
  return createMockClient({
    tree: makeClipboardTree(destEntries ?? []),
    home: HOME,
    roots: ["/"],
    ...capabilityOptions,
  });
}

/**
 * driveConflicts 監看貼上流程中出現的同名衝突, 依序以給定的選項作答. 作答刻意延後一個
 * 微任務執行: askConflict() 於 emit() 之後才設立等待中的回呼, 若在監聽者內同步作答,
 * 該次回呼尚未設立, 作答會被靜默忽略而使貼上流程永遠卡住. answers 用盡後一律以
 * "cancel" 收尾, 避免遺漏情境時整條批次卡死.
 */
function driveConflicts(
  store: BrowserStore,
  answers: readonly PasteConflictChoice[],
): { unsubscribe: () => void; askCount: () => number } {
  let index = 0;
  let askCount = 0;
  let waiting = false;
  const unsubscribe = store.subscribe(() => {
    if (waiting || store.getSnapshot().pasteConflict === null) return;
    waiting = true;
    askCount += 1;
    const choice = answers[index] ?? "cancel";
    index += 1;
    queueMicrotask(() => {
      waiting = false;
      store.resolvePasteConflict(choice);
    });
  });
  return { unsubscribe, askCount: () => askCount };
}

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

  it("單選模式下 Ctrl 點選可累積多項", async () => {
    const store = await readyStore();
    store.selectOnly(path("a.txt"));
    store.toggleSelection(path("b.txt"));
    expect(store.getSnapshot().selection).toEqual([path("a.txt"), path("b.txt")]);
    store.toggleSelection(path("a.txt"));
    expect(store.getSnapshot().selection).toEqual([path("b.txt")]);
  });

  it("單選模式下 Shift 範圍選可選出連續多項", async () => {
    const store = await readyStore();
    // 可見順序: docs, link-dir, pics, a.txt, b.txt, broken, c.txt, sock
    store.selectOnly(path("link-dir"));
    store.selectRange(path("b.txt"));
    expect(store.getSnapshot().selection).toEqual([
      path("link-dir"),
      path("pics"),
      path("a.txt"),
      path("b.txt"),
    ]);
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

  it("單選模式下選取多項時不可確認, 收回成一項後恢復可確認", async () => {
    const store = await readyStore();
    store.selectOnly(path("a.txt"));
    store.toggleSelection(path("b.txt"));
    expect(store.getSnapshot().selectedCount).toBe(2);
    expect(store.getSnapshot().canConfirmSelection).toBe(false);
    store.toggleSelection(path("b.txt"));
    expect(store.getSnapshot().selectedCount).toBe(1);
    expect(store.getSnapshot().canConfirmSelection).toBe(true);
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

describe("剪貼與貼上: 能力與選單收斂", () => {
  it("快照反映宿主查詢到的能力", async () => {
    client = makeClipboardClient({ canCopy: false, canMove: false, canCancel: false });
    const store = await readyStore();
    expect(store.getSnapshot().capabilities).toEqual({
      canCopy: false,
      canMove: false,
      canCancel: false,
    });
  });

  it("無複製能力時複製動作不建立剪貼內容", async () => {
    client = makeClipboardClient({ canCopy: false });
    const store = await readyStore();
    store.selectOnly(path("a.txt"));
    store.copy();
    expect(store.getSnapshot().clipboard).toBeNull();
  });

  // 以下兩則對應 2026-08-31 裁決: 宿主未提供複製能力時剪下, 複製, 貼上三項一律不提供
  // (三項同進退, 避免出現剪得走卻無處可貼上的狀態).

  it("無複製能力時剪下動作不建立剪貼內容", async () => {
    client = makeClipboardClient({ canCopy: false });
    const store = await readyStore();
    store.selectOnly(path("a.txt"));
    store.cut();
    expect(store.getSnapshot().clipboard).toBeNull();
  });

  it("無複製能力時可貼上判定恆為否", async () => {
    client = makeClipboardClient({ canCopy: false });
    const store = await readyStore();
    store.selectOnly(path("a.txt"));
    store.cut();
    store.copy();
    expect(store.getSnapshot().canPaste).toBe(false);
  });

  it("無搬移能力時剪下仍可用 (退回路徑), 貼上可執行判定不受影響", async () => {
    client = makeClipboardClient({ canMove: false });
    const store = await readyStore();
    store.selectOnly(path("a.txt"));
    store.cut();
    expect(store.getSnapshot().clipboard?.mode).toBe("cut");
    expect(store.getSnapshot().canPaste).toBe(true);
  });

  it("剪貼內容為空時貼上不可執行", async () => {
    client = makeClipboardClient();
    const store = await readyStore();
    expect(store.getSnapshot().clipboard).toBeNull();
    expect(store.getSnapshot().canPaste).toBe(false);
  });
});

describe("剪貼與貼上: 正常流程", () => {
  it("剪下貼上正常結束後清除剪貼內容, 並選取本次成功產生的項目", async () => {
    client = makeClipboardClient();
    const store = await readyStore();
    store.selectOnly(path("a.txt"));
    store.cut();
    await store.navigateTo(path("dest"));
    await store.paste();

    expect(client.moveCalls).toEqual([{ src: path("a.txt"), dst: destPath("a.txt"), overwrite: false }]);
    expect(store.getSnapshot().clipboard).toBeNull();
    expect(store.getSnapshot().pasteOutcome?.reason).toBe("completed");
    expect(store.getSnapshot().selection).toEqual([destPath("a.txt")]);
    expect(names(store)).toContain("a.txt");
  });

  it("複製貼上正常結束後保留剪貼內容, 可連續貼上", async () => {
    client = makeClipboardClient();
    const store = await readyStore();
    store.selectOnly(path("b.txt"));
    store.copy();
    await store.navigateTo(path("dest"));
    await store.paste();

    expect(client.copyCalls).toEqual([{ src: path("b.txt"), dst: destPath("b.txt"), overwrite: false }]);
    expect(store.getSnapshot().clipboard?.mode).toBe("copy");

    // 複製內容保留, 可再貼一次; 此時目標已存在, 進入同名衝突.
    const driver = driveConflicts(store, ["overwrite"]);
    await store.paste();
    driver.unsubscribe();

    expect(driver.askCount()).toBe(1);
    expect(client.copyCalls).toHaveLength(2);
    expect(client.copyCalls[1]).toEqual({ src: path("b.txt"), dst: destPath("b.txt"), overwrite: true });
  });
});

describe("剪貼與貼上: 同名衝突", () => {
  it("覆寫與全部覆寫: 全部只套用於本批次後續項目", async () => {
    client = makeClipboardClient({
      destEntries: [
        { name: "a.txt", kind: "file" },
        { name: "b.txt", kind: "file" },
        { name: "c.txt", kind: "file" },
      ],
    });
    const store = await readyStore({ returnMode: "multiple" });
    store.selectOnly(path("a.txt"));
    store.toggleSelection(path("b.txt"));
    store.toggleSelection(path("c.txt"));
    store.copy();
    await store.navigateTo(path("dest"));

    const driver = driveConflicts(store, ["overwrite", "overwriteAll"]);
    await store.paste();
    driver.unsubscribe();

    expect(driver.askCount()).toBe(2);
    expect(client.copyCalls.map((call) => call.overwrite)).toEqual([true, true, true]);
    expect(store.getSnapshot().pasteOutcome).toEqual({
      reason: "completed",
      done: 3,
      count: 3,
      name: "",
      failures: [],
    });
  });

  it("略過與全部略過, 全部的決定不跨貼上批次沿用", async () => {
    client = makeClipboardClient({
      destEntries: [
        { name: "a.txt", kind: "file" },
        { name: "b.txt", kind: "file" },
        { name: "c.txt", kind: "file" },
      ],
    });
    const store = await readyStore({ returnMode: "multiple" });
    store.selectOnly(path("a.txt"));
    store.toggleSelection(path("b.txt"));
    store.toggleSelection(path("c.txt"));
    store.copy();
    await store.navigateTo(path("dest"));

    const driver = driveConflicts(store, ["skip", "skipAll"]);
    await store.paste();
    driver.unsubscribe();

    expect(driver.askCount()).toBe(2);
    expect(client.copyCalls).toEqual([]);
    expect(store.getSnapshot().pasteOutcome).toEqual({
      reason: "completed",
      done: 3,
      count: 3,
      name: "",
      failures: [],
    });
    // 複製內容保留, 目標目錄仍是衝突前的樣子 (全數略過).
    expect(store.getSnapshot().clipboard).not.toBeNull();

    // 全部的決定只在上一批次內生效: 這一批次重新對每一項提問, 而非沿用先前的 "全部略過".
    const secondDriver = driveConflicts(store, ["overwrite", "overwrite", "overwrite"]);
    await store.paste();
    secondDriver.unsubscribe();

    expect(secondDriver.askCount()).toBe(3);
    expect(client.copyCalls).toHaveLength(3);
  });

  it("衝突中選擇取消時立即中止整個貼上批次", async () => {
    client = makeClipboardClient({
      destEntries: [
        { name: "a.txt", kind: "file" },
        { name: "b.txt", kind: "file" },
      ],
    });
    const store = await readyStore({ returnMode: "multiple" });
    store.selectOnly(path("a.txt"));
    store.toggleSelection(path("b.txt"));
    store.cut();
    await store.navigateTo(path("dest"));

    const driver = driveConflicts(store, ["cancel"]);
    await store.paste();
    driver.unsubscribe();

    expect(driver.askCount()).toBe(1);
    expect(client.moveCalls).toEqual([]);
    expect(store.getSnapshot().pasteOutcome?.reason).toBe("canceled");
    // 剪下模式取消後剪貼內容比照斷線處理: 保留.
    expect(store.getSnapshot().clipboard).not.toBeNull();
  });
});

describe("剪貼與貼上: 嵌套防護", () => {
  it("命中嵌套的項目擋下且不呼叫宿主, 其餘項目照常完成, 以警告回呼外拋而不進狀態列", async () => {
    const onWarning = vi.fn();
    client = makeClipboardClient();
    const store = await readyStore({ returnMode: "multiple", onWarning });
    store.selectOnly(path("src"));
    store.toggleSelection(path("a.txt"));
    store.cut();
    // 目標即來源之一 (src) 本身: 對 src 而言是嵌套, 對 a.txt 而言不是.
    await store.navigateTo(path("src"));

    await store.paste();

    expect(onWarning).toHaveBeenCalledWith({
      code: "nestedPaste",
      paths: [path("src")],
      targetDir: path("src"),
    });
    expect(client.moveCalls.map((call) => call.src)).toEqual([path("a.txt")]);
    const outcome = store.getSnapshot().pasteOutcome;
    expect(outcome?.reason).toBe("completed");
    expect(outcome?.failures).toEqual([]);
    expect(store.getSnapshot().error).toBeNull();
    expect(store.getSnapshot().clipboard).toBeNull();
  });

  it("Windows 路徑風格下, 目標與來源僅大小寫不同仍視為嵌套", async () => {
    client = createMockClient({
      tree: {
        "C:/": [{ name: "Data", kind: "dir" }],
        "C:/Data": [{ name: "Sub", kind: "dir" }],
        "C:/Data/Sub": [],
        // 另一種大小寫寫法, 模擬 Windows 檔案系統本身不分大小寫, 兩種寫法解析到同一位置.
        "C:/DATA/Sub": [],
      },
      home: "C:/",
      roots: ["C:/"],
      pathStyle: "windows",
    });
    const onWarning = vi.fn();
    const store = await readyStore({ onWarning });
    store.selectOnly("C:/Data");
    store.cut();
    await store.navigateTo("C:/DATA/Sub");

    await store.paste();

    expect(onWarning).toHaveBeenCalledWith({
      code: "nestedPaste",
      paths: ["C:/Data"],
      targetDir: "C:/DATA/Sub",
    });
    expect(client.moveCalls).toEqual([]);
    expect(store.getSnapshot().pasteOutcome).toEqual({
      reason: "completed",
      done: 1,
      count: 1,
      name: "",
      failures: [],
    });
    expect(store.getSnapshot().clipboard).toBeNull();
  });

  it("貼到來源的父目錄 (原地複製) 不屬於嵌套, 照常走同名衝突流程", async () => {
    client = makeClipboardClient();
    const store = await readyStore();
    store.selectOnly(path("a.txt"));
    store.copy();

    const driver = driveConflicts(store, ["overwrite"]);
    await store.paste();
    driver.unsubscribe();

    expect(driver.askCount()).toBe(1);
    expect(client.copyCalls).toEqual([{ src: path("a.txt"), dst: path("a.txt"), overwrite: true }]);
  });
});

describe("剪貼與貼上: 種類不符", () => {
  it("目標存在且種類不同時直接拒絕該項且不詢問", async () => {
    const onWarning = vi.fn();
    client = makeClipboardClient({
      destEntries: [{ name: "a.txt", kind: "dir" }],
    });
    const store = await readyStore({ onWarning });
    store.selectOnly(path("a.txt"));
    store.copy();
    await store.navigateTo(path("dest"));

    // 若真的被詢問, 這裡會誤答覆寫; 藉此偵測是否真的完全不問.
    const driver = driveConflicts(store, ["overwrite"]);
    await store.paste();
    driver.unsubscribe();

    expect(driver.askCount()).toBe(0);
    expect(client.copyCalls).toEqual([]);
    expect(onWarning).not.toHaveBeenCalled();

    const outcome = store.getSnapshot().pasteOutcome;
    expect(outcome?.failures).toEqual([
      { path: path("a.txt"), name: "a.txt", reason: "typeMismatch", error: null },
    ]);
    // 種類不符沒有對應的錯誤代碼, 且已有專屬的狀態列說明 (第 6 章), 故不另設錯誤; 該
    // 情形由狀態列的批次結果型態呈現.
    expect(store.getSnapshot().error).toBeNull();
  });
});

describe("剪貼與貼上: 退回路徑 (無搬移能力)", () => {
  it("以重新命名完成剪下貼上, 目標已存在時記為失敗且不提供覆寫", async () => {
    client = makeClipboardClient({
      canMove: false,
      destEntries: [{ name: "b.txt", kind: "file" }],
    });
    const store = await readyStore({ returnMode: "multiple" });
    store.selectOnly(path("new.txt"));
    store.toggleSelection(path("b.txt"));
    store.cut();
    await store.navigateTo(path("dest"));

    await store.paste();

    // 成功項透過既有的 Rename 完成 (退回路徑), 全程未呼叫 Move.
    expect(client.calls).toContain(`rename:${path("new.txt")}`);
    expect(client.calls).not.toContain(`rename:${path("b.txt")}`);
    expect(client.moveCalls).toEqual([]);

    expect(store.getSnapshot().pasteOutcome).toEqual({
      reason: "completed",
      done: 2,
      count: 2,
      name: "",
      failures: [
        {
          path: path("b.txt"),
          name: "b.txt",
          reason: "error",
          error: { code: "already_exists", message: "", operation: "rename", path: destPath("b.txt") },
        },
      ],
    });
    expect(store.getSnapshot().error?.code).toBe("already_exists");
    expect(store.getSnapshot().clipboard).toBeNull();
    expect(names(store)).toContain("new.txt");
    expect(names(store)).toContain("b.txt");
  });
});

describe("剪貼與貼上: 取消", () => {
  it("取消進行中作業: 已完成部分保留, 剪貼內容保留, 批次收場為取消", async () => {
    client = makeClipboardClient();
    const store = await readyStore({ returnMode: "multiple" });
    store.selectOnly(path("a.txt"));
    store.toggleSelection(path("b.txt"));
    store.cut();
    await store.navigateTo(path("dest"));

    const unsubscribe = store.subscribe(() => {
      const progress = store.getSnapshot().pasteProgress;
      if (progress?.canCancel === true && progress.current === 2) {
        store.cancelPaste();
      }
    });
    await store.paste();
    unsubscribe();

    expect(store.getSnapshot().pasteOutcome).toEqual({
      reason: "canceled",
      done: 1,
      count: 2,
      name: "",
      failures: [],
    });
    expect(client.moveCalls.map((call) => call.src)).toEqual([path("a.txt"), path("b.txt")]);
    // 已完成的部分保留 (重新整理清單後看得到 a.txt 已在目標目錄); 剪貼內容比照斷線處理: 保留.
    expect(names(store)).toContain("a.txt");
    expect(store.getSnapshot().clipboard).not.toBeNull();
  });

  it("無取消能力時進行中作業不提供取消, cancelPaste 呼叫無作用", async () => {
    client = makeClipboardClient({ canCancel: false });
    const store = await readyStore();
    store.selectOnly(path("a.txt"));
    store.cut();
    await store.navigateTo(path("dest"));

    let capturedCanCancel: boolean | null = null;
    const unsubscribe = store.subscribe(() => {
      const progress = store.getSnapshot().pasteProgress;
      if (progress !== null && capturedCanCancel === null) {
        capturedCanCancel = progress.canCancel;
        store.cancelPaste();
      }
    });
    await store.paste();
    unsubscribe();

    expect(capturedCanCancel).toBe(false);
    expect(store.getSnapshot().pasteOutcome?.reason).toBe("completed");
    expect(client.moveCalls).toHaveLength(1);
  });
});

describe("剪貼與貼上: 斷線", () => {
  it("斷線立即停止批次, 不重新整理清單, 剪貼內容保留", async () => {
    const onError = vi.fn();
    client = makeClipboardClient();
    client.failures.set(`move:${path("b.txt")}`, { code: "disconnected", message: "connection lost" });
    const store = await readyStore({ returnMode: "multiple", onError });
    store.selectOnly(path("a.txt"));
    store.toggleSelection(path("b.txt"));
    store.toggleSelection(path("c.txt"));
    store.cut();
    await store.navigateTo(path("dest"));

    await store.paste();

    // c.txt 從未被嘗試: 斷線後立即停止批次, 不再嘗試剩餘項目.
    expect(client.moveCalls.map((call) => call.src)).toEqual([path("a.txt"), path("b.txt")]);
    expect(store.getSnapshot().pasteOutcome).toEqual({
      reason: "disconnected",
      done: 1,
      count: 3,
      name: "b.txt",
      failures: [],
    });
    expect(onError).toHaveBeenCalledWith({
      code: "disconnected",
      message: "connection lost",
      operation: "move",
      path: path("b.txt"),
    });
    // 結構化錯誤僅外拋給宿主, 不寫入狀態列 (避免與 pasteOutcome 的說明重複).
    expect(store.getSnapshot().error).toBeNull();
    // 斷線後清單不自動重新整理: a.txt 雖已實際搬移, 畫面仍維持斷線前的樣子.
    expect(names(store)).not.toContain("a.txt");
    expect(store.getSnapshot().clipboard).not.toBeNull();
    expect(store.getSnapshot().pasting).toBe(false);
  });
});
