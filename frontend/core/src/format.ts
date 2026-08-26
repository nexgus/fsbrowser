// 顯示格式化: 日期時間與檔案大小 (計劃書第 6.3 節). 格式固定, 不隨語言與 theme 變化.

/** SizeUnitSystem 是檔案大小的單位制, 由開啟參數擇一. */
export type SizeUnitSystem = "si" | "iec";

const SI_UNITS = ["B", "kB", "MB", "GB", "TB", "PB", "EB"] as const;
const IEC_UNITS = ["B", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB"] as const;

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/**
 * formatDateTime 把介面傳輸的 UTC ISO 字串格式化為 "2026-01-23 12:30+08:00".
 *
 * 顯示時區固定為宿主系統時區, 由前端自行取得, 不設參數 (第 6.3 節). 輸入無法解析時
 * 回傳空字串, 使列表不因單一列的異常資料而中斷.
 */
export function formatDateTime(isoUtc: string): string {
  if (isoUtc === "") return "";
  const date = new Date(isoUtc);
  const time = date.getTime();
  if (Number.isNaN(time)) return "";

  const stamp =
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}` +
    ` ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

  // getTimezoneOffset 回傳的是 "UTC 減本地" 的分鐘數, 與顯示用的時差正負號相反.
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes < 0 ? "-" : "+";
  const absolute = Math.abs(offsetMinutes);
  return `${stamp}${sign}${pad2(Math.floor(absolute / 60))}:${pad2(absolute % 60)}`;
}

/**
 * formatSize 把位元組數格式化為 "48.7 MB" (SI) 或 "46.4 MiB" (IEC), 有效位數固定
 * 三位; 未滿一個進位單位時以整數位元組呈現 (例如 "512 B").
 */
export function formatSize(bytes: number, system: SizeUnitSystem = "si"): string {
  if (!Number.isFinite(bytes)) return "";
  const base = system === "si" ? 1000 : 1024;
  const units = system === "si" ? SI_UNITS : IEC_UNITS;

  let value = bytes;
  let index = 0;
  while (Math.abs(value) >= base && index < units.length - 1) {
    value /= base;
    index += 1;
  }
  if (index === 0) return `${Math.round(value)} ${units[0]}`;

  let text = toThreeSignificant(value);
  // 進位後可能恰好達到下一個單位 (例如 999.6 kB 進位為 1000 kB), 此時再升一級.
  if (Math.abs(Number(text)) >= base && index < units.length - 1) {
    value /= base;
    index += 1;
    text = toThreeSignificant(value);
  }
  return `${text} ${units[index] as string}`;
}

/** toThreeSignificant 以固定三位有效位數格式化 1 至 base 之間的數值. */
function toThreeSignificant(value: number): string {
  const magnitude = Math.abs(value);
  const digits = magnitude >= 100 ? 0 : magnitude >= 10 ? 1 : 2;
  return value.toFixed(digits);
}
