import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

type Cohabitant = {
  name: string;
  relationship: string;
  phone: string | null;
  is_jw: boolean;
};

type Contact = {
  name: string;
  name_kana: string;
  relationship: string;
  phones: string[];
  is_jw: boolean;
};

type Row = {
  id: string;
  name: string;
  address: string;
  phones: string[];
  cohabitants: Cohabitant[];
  emergency_contacts: Contact[];
  shelters: { name: string } | null;
};

function formatPhonesCompact(phones: string[] | null | undefined): string {
  if (!phones || phones.length === 0) return "";
  return phones.filter(Boolean).join("/");
}

const cell = "px-1.5 py-1 align-top";

function CohabitantRow({ p }: { p: Cohabitant }) {
  return (
    <div className="flex gap-1 whitespace-nowrap">
      <span className="w-[100px] shrink-0">
        {p.name}
        {p.is_jw ? " JW" : ""}
      </span>
      <span className="w-[45px] shrink-0">{p.relationship}</span>
      <span>{p.phone ?? ""}</span>
    </div>
  );
}

function ContactRow({ p }: { p: Contact }) {
  return (
    <div className="flex gap-1 whitespace-nowrap">
      <span className="w-[100px] shrink-0">
        {p.name}
        {p.is_jw ? " JW" : ""}
      </span>
      <span className="w-[68px] shrink-0">{p.name_kana}</span>
      <span className="w-[45px] shrink-0">{p.relationship}</span>
      <span>{formatPhonesCompact(p.phones)}</span>
    </div>
  );
}

export default async function AdminPrintPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("households")
    .select(
      "id, name, address, phones, shelters(name), cohabitants(name, relationship, phone, is_jw, sort_order), emergency_contacts(name, name_kana, relationship, phones, is_jw, sort_order)"
    )
    .order("name_kana_romaji", { ascending: true })
    .order("sort_order", { referencedTable: "cohabitants" })
    .order("sort_order", { referencedTable: "emergency_contacts" });

  const households = (data as Row[] | null) ?? [];
  const now = new Date();
  const printedAt = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;

  return (
    <div className="w-[1050px] max-w-none bg-white p-6 print:w-full print:p-0">
      <style>{`
        @page {
          size: A4 landscape;
          margin: 10mm;
        }
      `}</style>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <h1 className="text-lg font-bold text-slate-900">一覧PDF出力プレビュー</h1>
        <PrintButton />
      </div>
      <div className="mb-2 flex items-baseline justify-between">
        <h1 className="text-base font-bold text-slate-900">
          緊急連絡先 登録一覧　大阪府枚方市津田会衆（22046）
        </h1>
        <span className="text-xs text-slate-600">{printedAt}</span>
      </div>
      <table className="w-full border-collapse text-[8pt]">
        <thead>
          <tr className="bg-slate-200 text-left">
            <th className={`${cell} w-[9%]`}>氏名</th>
            <th className={`${cell} w-[19%]`}>住所・電話番号</th>
            <th className={`${cell} w-[26%]`}>同居人</th>
            <th className={`${cell} w-[37%]`}>緊急連絡先</th>
            <th className={`${cell} w-[9%]`}>指定避難場所</th>
          </tr>
        </thead>
        <tbody>
          {households.map((h, i) => (
            <tr key={h.id} className={i % 2 === 1 ? "bg-slate-100" : "bg-white"}>
              <td className={cell}>{h.name}</td>
              <td className={`${cell} whitespace-nowrap`}>
                <div>{h.address}</div>
                <div>{formatPhonesCompact(h.phones)}</div>
              </td>
              <td className={cell}>
                {(h.cohabitants ?? []).map((p, idx) => (
                  <CohabitantRow key={idx} p={p} />
                ))}
              </td>
              <td className={cell}>
                {(h.emergency_contacts ?? []).map((p, idx) => (
                  <ContactRow key={idx} p={p} />
                ))}
              </td>
              <td className={cell}>{h.shelters?.name ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
