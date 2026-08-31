// createClient 的驗證, 回傳值收斂與錯誤正規化.

import { describe, expect, it } from "vitest";
import {
  FsbOperationError,
  REQUIRED_BINDING_METHODS,
  createClient,
  missingBindingMethods,
  normalizeError,
  toFsbError,
} from "@nexgus/fsb-core";
import type { FsbBindings } from "@nexgus/fsb-core";

function makeBindings(overrides: Partial<Record<string, unknown>> = {}): FsbBindings {
  const base: Record<string, unknown> = {
    List: async () => [],
    Stat: async () => ({}),
    Home: async () => "/home/gus",
    Roots: async () => ["/"],
    PathStyle: async () => "posix",
    MakeDir: async () => undefined,
    Rename: async () => undefined,
    Delete: async () => undefined,
    Capabilities: async () => ({ canCopy: true, canMove: true, canCancel: true }),
    Copy: () => Promise.resolve(undefined),
    Move: () => Promise.resolve(undefined),
    // 宿主端操作, client 不使用亦不驗證.
    SetFileSystem: async () => undefined,
  };
  return { ...base, ...overrides } as unknown as FsbBindings;
}

describe("createClient", () => {
  it("必要方法齊全時建立 client", () => {
    const client = createClient(makeBindings());
    expect(typeof client.list).toBe("function");
    expect(REQUIRED_BINDING_METHODS).toHaveLength(11);
    expect(REQUIRED_BINDING_METHODS).not.toContain("SetFileSystem");
  });

  it("缺少方法時丟出列出缺少方法名的錯誤", () => {
    const bindings = makeBindings();
    delete (bindings as unknown as Record<string, unknown>)["Rename"];
    delete (bindings as unknown as Record<string, unknown>)["Delete"];
    expect(() => createClient(bindings)).toThrowError(/Rename, Delete/);
    expect(missingBindingMethods(bindings)).toEqual(["Rename", "Delete"]);
  });

  it("傳入非物件時視為全部方法缺少", () => {
    expect(() => createClient(undefined as unknown as FsbBindings)).toThrowError(/List/);
    expect(missingBindingMethods(null)).toHaveLength(11);
  });

  it("缺少 SetFileSystem 不影響驗證", () => {
    const bindings = makeBindings();
    delete (bindings as unknown as Record<string, unknown>)["SetFileSystem"];
    expect(() => createClient(bindings)).not.toThrow();
  });

  it("把 bindings 回傳的項目收斂為 Entry, 欄位缺漏以安全預設補齊", async () => {
    const client = createClient(
      makeBindings({
        List: async () => [
          { Name: "a.txt", Path: "/a.txt", Kind: "file", IsLink: false, Target: "file", Size: 3, ModTime: "2026-01-23T04:30:00Z", Hidden: false },
          { Name: "weird" },
        ],
      }),
    );
    const entries = await client.list("/");
    expect(entries[0]?.Size).toBe(3);
    expect(entries[1]).toEqual({
      Name: "weird",
      Path: "",
      Kind: "unknown",
      IsLink: false,
      Target: "unknown",
      Size: 0,
      ModTime: "",
      Hidden: false,
    });
  });

  it("非法的路徑風格回退為 posix", async () => {
    const client = createClient(makeBindings({ PathStyle: async () => "nonsense" }));
    expect(await client.pathStyle()).toBe("posix");
  });

  it("呼叫失敗時把 cause 帶的結構化錯誤正規化並附上操作與路徑", async () => {
    const client = createClient(
      makeBindings({
        List: async () => {
          const error = new Error("boom");
          (error as Error & { cause?: unknown }).cause = {
            code: "permission_denied",
            message: "open /root: permission denied",
          };
          throw error;
        },
      }),
    );
    await expect(client.list("/root")).rejects.toBeInstanceOf(FsbOperationError);
    let error: FsbOperationError | null = null;
    try {
      await client.list("/root");
    } catch (thrown) {
      error = thrown as FsbOperationError;
    }
    expect(error?.toStructured()).toEqual({
      code: "permission_denied",
      message: "open /root: permission denied",
      operation: "list",
      path: "/root",
    });
  });
});

describe("normalizeError", () => {
  it("無法辨識的拋出物歸類為 unknown", () => {
    expect(toFsbError("boom", "delete", "/a")).toEqual({
      code: "unknown",
      message: "boom",
      operation: "delete",
      path: "/a",
    });
    expect(toFsbError(new Error("bang"), "home").code).toBe("unknown");
    expect(toFsbError({ cause: { code: "no_such_code", message: "x" } }, "stat").code).toBe("unknown");
  });

  it("拋出物本身帶結構化欄位時亦可辨識", () => {
    expect(toFsbError({ code: "not_empty", message: "dir not empty" }, "delete", "/d")).toEqual({
      code: "not_empty",
      message: "dir not empty",
      operation: "delete",
      path: "/d",
    });
  });

  it("已正規化的錯誤原樣回傳", () => {
    const first = normalizeError({ cause: { code: "io_error", message: "x" } }, "list", "/a");
    expect(normalizeError(first, "stat", "/b")).toBe(first);
  });
});
