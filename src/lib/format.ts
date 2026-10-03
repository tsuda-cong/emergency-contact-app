export function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function formatPhones(phones: string[] | null | undefined): string {
  if (!phones || phones.length === 0) return "-";
  const filtered = phones.filter(Boolean);
  return filtered.length > 0 ? filtered.join(" / ") : "-";
}

export type CircuitInfo = {
  circuit_name: string;
  overseer_name: string;
  overseer_phone: string;
  overseer_email: string;
};

// PDFのタイトル行に表示する巡回区・巡回監督の連絡先
// 例: 「近畿第7 巡回区　山田太郎兄弟　090-1234-5678　abcd@jwpub.org」（未入力の項目は省く）
export function formatCircuitLine(info: CircuitInfo | null | undefined): string {
  if (!info) return "";
  return [
    info.circuit_name && `${info.circuit_name} 巡回区`,
    info.overseer_name && `${info.overseer_name}兄弟`,
    info.overseer_phone,
    info.overseer_email,
  ]
    .filter(Boolean)
    .join("　");
}
