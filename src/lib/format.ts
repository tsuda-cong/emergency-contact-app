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

export function maskAddress(address: string): string {
  if (address.length <= 8) return address;
  return `${address.slice(0, 8)}…`;
}

export function formatPhones(phones: string[] | null | undefined): string {
  if (!phones || phones.length === 0) return "-";
  const filtered = phones.filter(Boolean);
  return filtered.length > 0 ? filtered.join(" / ") : "-";
}
