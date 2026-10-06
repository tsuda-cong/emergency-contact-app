export type PrintCohabitant = {
  name: string;
  relationship: string;
  phone: string | null;
  is_jw: boolean;
};

export type PrintContact = {
  name: string;
  name_kana: string;
  relationship: string;
  phones: string[];
  is_jw: boolean;
};

export type PrintHousehold = {
  id: string;
  name: string;
  address: string;
  phones: string[];
  cohabitants: PrintCohabitant[];
  emergency_contacts: PrintContact[];
  shelters: { name: string } | null;
};

export function formatPhonesCompact(phones: string[] | null | undefined): string {
  if (!phones || phones.length === 0) return "";
  return phones.filter(Boolean).join("/");
}

export function withJw(name: string, isJw: boolean): string {
  return isJw ? `${name} JW` : name;
}
