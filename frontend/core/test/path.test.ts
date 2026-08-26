// 路徑工具: 內部形式的處理, Windows 磁碟機字首與使用者輸入正規化.

import { describe, expect, it } from "vitest";
import {
  baseName,
  fromDisplayPath,
  isAbsolutePath,
  isRootPath,
  isValidName,
  joinPath,
  normalizePath,
  parentDir,
  rootOf,
  toDisplayPath,
} from "@nexgus/fsb-core";

describe("normalizePath", () => {
  it("折除重複分隔符與 . 段", () => {
    expect(normalizePath("/home//gus/./docs/")).toBe("/home/gus/docs");
  });

  it("就地解析 .. 段", () => {
    expect(normalizePath("/home/gus/docs/../pics")).toBe("/home/gus/pics");
    expect(normalizePath("/home/gus/../..")).toBe("/");
    expect(normalizePath("/..")).toBe("/");
  });

  it("使用者輸入的 \\ 一律轉為內部形式", () => {
    expect(normalizePath("C:\\Users\\gus\\Documents")).toBe("C:/Users/gus/Documents");
    expect(normalizePath("C:/Users\\gus")).toBe("C:/Users/gus");
    expect(fromDisplayPath("  C:\\Users\\gus\\  ")).toBe("C:/Users/gus");
  });

  it("Windows 磁碟機根保留字首形式", () => {
    expect(normalizePath("C:")).toBe("C:/");
    expect(normalizePath("C:/")).toBe("C:/");
    expect(normalizePath("C:\\")).toBe("C:/");
    expect(normalizePath("C:/Users/..")).toBe("C:/");
  });

  it("相對路徑保留無法解析的 .. 段", () => {
    expect(normalizePath("docs/../pics")).toBe("pics");
    expect(normalizePath("../docs")).toBe("../docs");
  });
});

describe("根與父目錄", () => {
  it("rootOf 取得所屬的根", () => {
    expect(rootOf("/home/gus")).toBe("/");
    expect(rootOf("C:/Users/gus")).toBe("C:/");
    expect(rootOf("docs")).toBe("");
  });

  it("isAbsolutePath 與 isRootPath", () => {
    expect(isAbsolutePath("/a")).toBe(true);
    expect(isAbsolutePath("D:/a")).toBe(true);
    expect(isAbsolutePath("a/b")).toBe(false);
    expect(isRootPath("/")).toBe(true);
    expect(isRootPath("C:/")).toBe(true);
    expect(isRootPath("C:/Users")).toBe(false);
  });

  it("parentDir 於根回傳根本身", () => {
    expect(parentDir("/home/gus")).toBe("/home");
    expect(parentDir("/home")).toBe("/");
    expect(parentDir("/")).toBe("/");
    expect(parentDir("C:/Users/gus")).toBe("C:/Users");
    expect(parentDir("C:/Users")).toBe("C:/");
    expect(parentDir("C:/")).toBe("C:/");
  });

  it("baseName 取得最後一段", () => {
    expect(baseName("/home/gus/a.txt")).toBe("a.txt");
    expect(baseName("C:/")).toBe("C:/");
    expect(baseName("/")).toBe("/");
  });
});

describe("joinPath", () => {
  it("串接後經正規化", () => {
    expect(joinPath("/home/gus", "docs")).toBe("/home/gus/docs");
    expect(joinPath("/", "home")).toBe("/home");
    expect(joinPath("C:/", "Users", "gus")).toBe("C:/Users/gus");
    expect(joinPath("/home/gus/", "docs/")).toBe("/home/gus/docs");
    expect(joinPath("/home/gus")).toBe("/home/gus");
  });
});

describe("顯示風格轉換", () => {
  it("Windows 風格以 \\ 呈現, POSIX 原樣", () => {
    expect(toDisplayPath("C:/Users/gus", "windows")).toBe("C:\\Users\\gus");
    expect(toDisplayPath("/home/gus", "posix")).toBe("/home/gus");
    expect(toDisplayPath("C:/", "windows")).toBe("C:\\");
  });
});

describe("isValidName", () => {
  it("拒絕空白, 分隔符與 . 或 ..", () => {
    expect(isValidName("docs")).toBe(true);
    expect(isValidName("  ")).toBe(false);
    expect(isValidName(".")).toBe(false);
    expect(isValidName("..")).toBe(false);
    expect(isValidName("a/b")).toBe(false);
    expect(isValidName("a\\b")).toBe(false);
  });
});
