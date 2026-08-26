// 顯示格式化: 日期時間與兩種檔案大小單位制.

import { describe, expect, it } from "vitest";
import { formatDateTime, formatSize } from "@nexgus/fsb-core";

describe("formatDateTime", () => {
  it("以宿主系統時區呈現 ISO 含時差的格式", () => {
    // 測試時區固定為 Asia/Taipei (見 vitest.config.ts).
    expect(formatDateTime("2026-01-23T04:30:00Z")).toBe("2026-01-23 12:30+08:00");
  });

  it("跨日換算正確", () => {
    expect(formatDateTime("2026-01-22T17:05:00Z")).toBe("2026-01-23 01:05+08:00");
  });

  it("無法解析時回傳空字串", () => {
    expect(formatDateTime("")).toBe("");
    expect(formatDateTime("not a time")).toBe("");
  });
});

describe("formatSize", () => {
  it("SI 與 IEC 兩制的有效位數皆為三位", () => {
    expect(formatSize(48_700_000, "si")).toBe("48.7 MB");
    expect(formatSize(48_700_000, "iec")).toBe("46.4 MiB");
  });

  it("未滿一個進位單位時以整數位元組呈現", () => {
    expect(formatSize(0, "si")).toBe("0 B");
    expect(formatSize(512, "iec")).toBe("512 B");
    expect(formatSize(999, "si")).toBe("999 B");
  });

  it("依數值大小切換小數位以維持三位有效位數", () => {
    expect(formatSize(1_000, "si")).toBe("1.00 kB");
    expect(formatSize(1_024, "iec")).toBe("1.00 KiB");
    expect(formatSize(12_345, "si")).toBe("12.3 kB");
    expect(formatSize(123_456, "si")).toBe("123 kB");
    expect(formatSize(1_500_000_000, "si")).toBe("1.50 GB");
  });

  it("進位後恰好達到下一個單位時再升一級", () => {
    expect(formatSize(999_960, "si")).toBe("1.00 MB");
  });

  it("預設單位制為 SI", () => {
    expect(formatSize(2_000_000)).toBe("2.00 MB");
  });

  it("非有限數回傳空字串", () => {
    expect(formatSize(Number.NaN)).toBe("");
  });
});
