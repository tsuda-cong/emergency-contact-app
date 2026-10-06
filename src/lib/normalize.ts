// 全角数字の入力（スマホの入力モードなどで発生しやすい）を半角に正規化するユーティリティ。

import { parsePhoneNumberFromString } from "libphonenumber-js";

export function toHalfWidthDigits(input: string): string {
  return input.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}

// 数字の区切りとして使われる全角ハイフン類（－/―/‐）を半角に統一する。
// カタカナの長音符「ー」（U+30FC）は対象に含めない（建物名などで正当に使われるため）。
function normalizeHyphens(input: string): string {
  return input.replace(/[－―‐]/g, "-");
}

// 電話番号を「090-1234-5678」「072-891-2345」「06-1234-5678」の形にそろえる。
// 市外局番の桁数は地域ごとに異なるため、libphonenumber の日本の番号体系の情報を使って区切る。
// 番号として成り立たないもの（桁の入力漏れなど）は区切りを付けず、全角→半角とスペース除去だけ行う。
export function normalizePhone(input: string): string {
  const cleaned = normalizeHyphens(toHalfWidthDigits(input)).trim();
  return formatJapanesePhone(cleaned) ?? cleaned.replace(/\s+/g, "");
}

// 日本の電話番号として成り立つか（桁の入力漏れなどがないか）
export function isValidPhone(input: string): boolean {
  return formatJapanesePhone(normalizeHyphens(toHalfWidthDigits(input))) !== null;
}

function formatJapanesePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;

  const parsed = parsePhoneNumberFromString(digits, "JP");
  if (!parsed?.isValid()) return null;
  const formatted = parsed.formatNational();
  // 区切り以外が変わっていないことを確認する（桁が欠けた番号が別の番号として解釈されるのを防ぐ）
  return formatted.replace(/\D/g, "") === digits ? formatted : null;
}

export function normalizeAddress(input: string): string {
  return normalizeHyphens(toHalfWidthDigits(input));
}
