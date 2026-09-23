// 全角数字の入力（スマホの入力モードなどで発生しやすい）を半角に正規化するユーティリティ。

export function toHalfWidthDigits(input: string): string {
  return input.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}

// 数字の区切りとして使われる全角ハイフン類（－/―/‐）を半角に統一する。
// カタカナの長音符「ー」（U+30FC）は対象に含めない（建物名などで正当に使われるため）。
function normalizeHyphens(input: string): string {
  return input.replace(/[－―‐]/g, "-");
}

export function normalizePhone(input: string): string {
  return normalizeHyphens(toHalfWidthDigits(input));
}

export function normalizeAddress(input: string): string {
  return normalizeHyphens(toHalfWidthDigits(input));
}
