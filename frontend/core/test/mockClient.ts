// 測試用的 mock client: 以記憶體中的目錄表模擬橋接層, 並可注入失敗 (計劃書第 5.1 節
// 所述 "單元測試以 mock client 進行").

import type { Entry, FsbClient, FsbOperationHandle, Kind, PathStyle } from "@nexgus/fsb-core";
import type { ErrorCode } from "@nexgus/fsb-core";

/** MockEntry 是建立測試資料用的簡寫形態. */
export interface MockEntry {
  name: string;
  kind?: Kind;
  isLink?: boolean;
  target?: Kind;
  size?: number;
  modTime?: string;
  hidden?: boolean;
}

/** MockFailure 是注入的失敗, 形態比照 Wails 拋出的例外 (cause 帶結構化錯誤). */
export interface MockFailure {
  code: ErrorCode;
  message: string;
}

/** MockOperationCall 是一次複製或搬移呼叫的紀錄 (含覆寫旗標). */
export interface MockOperationCall {
  src: string;
  dst: string;
  overwrite: boolean;
}

export interface MockClientOptions {
  /** 目錄表: 目錄路徑 -> 其內容. */
  tree: Record<string, MockEntry[]>;
  home?: string;
  roots?: string[];
  pathStyle?: PathStyle;
  /** 是否具備複製能力 (第 3.1 節); 預設為真. */
  canCopy?: boolean;
  /** 是否具備搬移能力; 預設為真. */
  canMove?: boolean;
  /** 是否具備取消能力; 預設為真. */
  canCancel?: boolean;
}

/** MockClient 除 FsbClient 外另提供呼叫紀錄與失敗注入. */
export interface MockClient extends FsbClient {
  /** 呼叫紀錄, 形如 "list:/home". */
  calls: string[];
  /** 失敗注入表, 鍵形如 "list:/home"; 值為要拋出的結構化錯誤. */
  failures: Map<string, MockFailure>;
  /** 目前的目錄表, 供測試檢查寫入操作的結果. */
  tree: Record<string, MockEntry[]>;
  /** 複製呼叫紀錄, 依呼叫順序排列; 每筆含覆寫旗標. */
  copyCalls: MockOperationCall[];
  /** 搬移呼叫紀錄, 依呼叫順序排列; 每筆含覆寫旗標. */
  moveCalls: MockOperationCall[];
}

function toEntry(dir: string, node: MockEntry): Entry {
  const kind: Kind = node.kind ?? "file";
  return {
    Name: node.name,
    Path: dir === "/" ? `/${node.name}` : `${dir}/${node.name}`,
    Kind: kind,
    IsLink: node.isLink === true,
    Target: node.target ?? kind,
    Size: node.size ?? 0,
    ModTime: node.modTime ?? "2026-01-23T04:30:00Z",
    Hidden: node.hidden === true,
  };
}

function parent(path: string): string {
  const index = path.lastIndexOf("/");
  if (index <= 0) return "/";
  return path.slice(0, index);
}

function base(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function joinChild(dir: string, name: string): string {
  return dir === "/" ? `/${name}` : `${dir}/${name}`;
}

function findNode(tree: Record<string, MockEntry[]>, path: string): MockEntry | undefined {
  const nodes = tree[parent(path)];
  return nodes?.find((item) => item.name === base(path));
}

/**
 * removeNode 把節點從其所屬目錄移除, 並清掉其巢狀列表 (若為目錄); 供搬移操作使用.
 */
function removeNode(tree: Record<string, MockEntry[]>, path: string): void {
  const dir = parent(path);
  const nodes = tree[dir];
  if (nodes !== undefined) tree[dir] = nodes.filter((item) => item.name !== base(path));
  delete tree[path];
  for (const key of Object.keys(tree)) {
    if (key.startsWith(`${path}/`)) delete tree[key];
  }
}

/**
 * copyEntryInto 把 src 節點複製進 dstDir 底下, 名稱為 name, 模擬遞迴複製的頂層效果
 * (第 3.1, 5.4 節): 資料夾對資料夾為合併, 目標原有而來源沒有的成員保留, 裡層同名項目
 * 一律覆寫; 檔案對檔案為取代. overwrite 為 false 且目標已存在時, 呼叫前置條件應已由
 * store 排除 (種類比對, 衝突詢問), 此處僅單純插入不覆寫.
 */
function copyEntryInto(
  tree: Record<string, MockEntry[]>,
  src: string,
  dstDir: string,
  name: string,
  overwrite: boolean,
): void {
  const node = findNode(tree, src);
  if (node === undefined) return;
  const nodes = (tree[dstDir] ??= []);
  const index = nodes.findIndex((item) => item.name === name);
  if (index < 0) nodes.push({ ...node, name });
  else if (overwrite) nodes[index] = { ...node, name };

  if (node.kind === "dir") {
    const dstPath = joinChild(dstDir, name);
    tree[dstPath] ??= [];
    const children = tree[src] ?? [];
    for (const child of children) {
      copyEntryInto(tree, joinChild(src, child.name), dstPath, child.name, true);
    }
  }
}

/**
 * startOperation 模擬一次複製或搬移呼叫: 同步回傳把手, 結果於下一個微任務才 settle,
 * 使呼叫端有機會在完成前呼叫 cancel (比照真實的非同步作業). 已 settle 後 cancel 無動作.
 */
function startOperation(
  key: string,
  applyMutation: () => void,
  calls: string[],
  failures: Map<string, MockFailure>,
  canCancel: boolean,
): FsbOperationHandle {
  calls.push(key);
  let settled = false;
  let resolveFn!: () => void;
  let rejectFn!: (reason: unknown) => void;
  const result = new Promise<void>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  const failure = failures.get(key);
  void Promise.resolve().then(() => {
    if (settled) return;
    settled = true;
    if (failure !== undefined) {
      const error = new Error(`mock failure: ${key}`);
      (error as Error & { cause?: unknown }).cause = { code: failure.code, message: failure.message };
      rejectFn(error);
      return;
    }
    applyMutation();
    resolveFn();
  });

  if (!canCancel) return { result };
  return {
    result,
    cancel: () => {
      if (settled) return;
      settled = true;
      const error = new Error("mock canceled");
      (error as Error & { cause?: unknown }).cause = { code: "canceled", message: "" };
      rejectFn(error);
    },
  };
}

/** createMockClient 建立測試用 client. */
export function createMockClient(options: MockClientOptions): MockClient {
  const tree: Record<string, MockEntry[]> = {};
  for (const [dir, nodes] of Object.entries(options.tree)) tree[dir] = nodes.map((node) => ({ ...node }));

  const calls: string[] = [];
  const failures = new Map<string, MockFailure>();
  const copyCalls: MockOperationCall[] = [];
  const moveCalls: MockOperationCall[] = [];
  const canCopy = options.canCopy ?? true;
  const canMove = options.canMove ?? true;
  const canCancel = options.canCancel ?? true;

  function record(operation: string, path?: string): void {
    const key = path === undefined ? operation : `${operation}:${path}`;
    calls.push(key);
    const failure = failures.get(key);
    if (failure !== undefined) {
      // 形態比照 @wailsio/runtime: 拋出的例外把結構化錯誤掛在 cause 屬性上.
      const error = new Error(`mock failure: ${key}`);
      (error as Error & { cause?: unknown }).cause = { code: failure.code, message: failure.message };
      throw error;
    }
  }

  return {
    calls,
    failures,
    tree,
    copyCalls,
    moveCalls,

    async list(dir) {
      record("list", dir);
      const nodes = tree[dir];
      if (nodes === undefined) {
        const error = new Error("not found");
        (error as Error & { cause?: unknown }).cause = { code: "not_found", message: dir };
        throw error;
      }
      return nodes.map((node) => toEntry(dir, node));
    },

    async stat(path) {
      record("stat", path);
      const nodes = tree[parent(path)] ?? [];
      const node = nodes.find((item) => item.name === base(path));
      if (node === undefined) {
        const error = new Error("not found");
        (error as Error & { cause?: unknown }).cause = { code: "not_found", message: path };
        throw error;
      }
      return toEntry(parent(path), node);
    },

    async home() {
      record("home");
      return options.home ?? "/home/gus";
    },

    async roots() {
      record("roots");
      return options.roots ?? ["/"];
    },

    async pathStyle() {
      record("pathStyle");
      return options.pathStyle ?? "posix";
    },

    async makeDir(path) {
      record("makeDir", path);
      const dir = parent(path);
      (tree[dir] ??= []).push({ name: base(path), kind: "dir" });
      tree[path] ??= [];
    },

    async rename(oldPath, newPath) {
      record("rename", oldPath);
      // 比照真實檔案系統的 rename: 支援跨目錄搬移 (剪下貼上的退回路徑正是靠這點運作,
      // 第 3.1 節), 因此需把節點從原目錄的列表移出, 再以新名稱放進目標目錄的列表.
      const oldDir = parent(oldPath);
      const newDir = parent(newPath);
      const nodes = tree[oldDir];
      if (nodes === undefined) return;
      const index = nodes.findIndex((item) => item.name === base(oldPath));
      if (index < 0) return;
      const [node] = nodes.splice(index, 1);
      if (node === undefined) return;
      node.name = base(newPath);
      (tree[newDir] ??= []).push(node);
    },

    async delete(path) {
      record("delete", path);
      const dir = parent(path);
      const nodes = tree[dir];
      if (nodes !== undefined) tree[dir] = nodes.filter((item) => item.name !== base(path));
      delete tree[path];
    },

    async capabilities() {
      record("capabilities");
      return { canCopy, canMove, canCancel };
    },

    copy(src, dst, overwrite) {
      copyCalls.push({ src, dst, overwrite });
      return startOperation(
        `copy:${src}`,
        () => copyEntryInto(tree, src, parent(dst), base(dst), overwrite),
        calls,
        failures,
        canCancel,
      );
    },

    move(src, dst, overwrite) {
      moveCalls.push({ src, dst, overwrite });
      return startOperation(
        `move:${src}`,
        () => {
          copyEntryInto(tree, src, parent(dst), base(dst), overwrite);
          removeNode(tree, src);
        },
        calls,
        failures,
        canCancel,
      );
    },
  };
}
