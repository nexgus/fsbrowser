// 測試用的 mock client: 以記憶體中的目錄表模擬橋接層, 並可注入失敗 (計劃書第 5.1 節
// 所述 "單元測試以 mock client 進行").

import type { Entry, FsbClient, Kind, PathStyle } from "@nexgus/fsb-core";
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

export interface MockClientOptions {
  /** 目錄表: 目錄路徑 -> 其內容. */
  tree: Record<string, MockEntry[]>;
  home?: string;
  roots?: string[];
  pathStyle?: PathStyle;
}

/** MockClient 除 FsbClient 外另提供呼叫紀錄與失敗注入. */
export interface MockClient extends FsbClient {
  /** 呼叫紀錄, 形如 "list:/home". */
  calls: string[];
  /** 失敗注入表, 鍵形如 "list:/home"; 值為要拋出的結構化錯誤. */
  failures: Map<string, MockFailure>;
  /** 目前的目錄表, 供測試檢查寫入操作的結果. */
  tree: Record<string, MockEntry[]>;
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

/** createMockClient 建立測試用 client. */
export function createMockClient(options: MockClientOptions): MockClient {
  const tree: Record<string, MockEntry[]> = {};
  for (const [dir, nodes] of Object.entries(options.tree)) tree[dir] = nodes.map((node) => ({ ...node }));

  const calls: string[] = [];
  const failures = new Map<string, MockFailure>();

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
      const dir = parent(oldPath);
      const nodes = tree[dir] ?? [];
      const node = nodes.find((item) => item.name === base(oldPath));
      if (node !== undefined) node.name = base(newPath);
    },

    async delete(path) {
      record("delete", path);
      const dir = parent(path);
      const nodes = tree[dir];
      if (nodes !== undefined) tree[dir] = nodes.filter((item) => item.name !== base(path));
      delete tree[path];
    },
  };
}
