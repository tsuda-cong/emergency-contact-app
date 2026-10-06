import { type CircuitInfo, formatCircuitLine } from "@/lib/format";
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

function withJw(name: string, isJw: boolean): string {
  return isJw ? `${name} JW` : name;
}

const cell = "px-1.5 py-1 align-top";
// 同居人・緊急連絡先の各項目（氏名・続柄など）はそれぞれ独立した列にし、
// 列幅を実際の文字の長さに合わせて自動で決める（固定幅だと長い名前が隣に重なるため）。
// 1人1行で折り返さないので、同じ人の項目は横一列にそろう。
const subFirst = "py-1 pl-1.5 pr-1 align-top whitespace-nowrap";
const subMid = "py-1 px-1 align-top whitespace-nowrap";
const subLast = "py-1 pl-1 pr-1.5 align-top whitespace-nowrap";

function Lines({ values }: { values: string[] }) {
  return (
    <>
      {values.map((v, i) => (
        // 空欄でも行の高さを保ち、同じ人の他の項目と横位置がずれないようにする
        <div key={i}>{v || " "}</div>
      ))}
    </>
  );
}

export default async function AdminPrintPage() {
  const supabase = await createClient();
  const { data: circuitInfo } = await supabase
    .from("circuit_info")
    .select("circuit_name, overseer_name, overseer_phone, overseer_email")
    .eq("id", 1)
    .maybeSingle();
  const circuitLine = formatCircuitLine(circuitInfo as CircuitInfo | null);

  const { data } = await supabase
    .from("households")
    .select(
      "id, name, address, phones, shelters(name), cohabitants(name, relationship, phone, is_jw, sort_order), emergency_contacts(name, name_kana, relationship, phones, is_jw, sort_order)"
    )
    .is("deleted_at", null)
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
          @bottom-center {
            content: counter(page) " / " counter(pages);
            font-size: 8pt;
            color: #475569;
          }
        }
        @media print {
          /* 1人分（1行）が2ページにまたがらないようにする */
          tr, td {
            break-inside: avoid;
          }
        }
      `}</style>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <h1 className="text-lg font-bold text-slate-900">一覧PDF出力プレビュー</h1>
        <PrintButton />
      </div>
      <div className="mb-2 flex items-baseline gap-6">
        <h1 className="text-base font-bold text-slate-900">
          緊急連絡先 登録一覧　大阪府枚方市津田会衆（22046）
        </h1>
        {circuitLine && <span className="text-xs text-slate-800">{circuitLine}</span>}
        <span className="ml-auto shrink-0 text-xs text-slate-600">{printedAt}</span>
      </div>
      <table className="w-full border-collapse text-[8pt] leading-[1.35]">
        <thead>
          <tr className="bg-slate-200 text-left">
            <th className={cell}>氏名</th>
            <th className={cell}>住所・電話番号</th>
            <th className={cell} colSpan={3}>
              同居人
            </th>
            <th className={cell} colSpan={4}>
              緊急連絡先
            </th>
            <th className={cell}>指定避難場所</th>
          </tr>
        </thead>
        <tbody>
          {households.map((h, i) => {
            const cohabitants = h.cohabitants ?? [];
            const contacts = h.emergency_contacts ?? [];
            return (
              <tr key={h.id} className={i % 2 === 1 ? "bg-slate-100" : "bg-white"}>
                <td className={cell}>{h.name}</td>
                <td className={cell}>
                  <div>{h.address}</div>
                  <div className="whitespace-nowrap">{formatPhonesCompact(h.phones)}</div>
                </td>
                <td className={subFirst}>
                  <Lines values={cohabitants.map((p) => withJw(p.name, p.is_jw))} />
                </td>
                <td className={subMid}>
                  <Lines values={cohabitants.map((p) => p.relationship)} />
                </td>
                <td className={subLast}>
                  <Lines values={cohabitants.map((p) => p.phone ?? "")} />
                </td>
                <td className={subFirst}>
                  <Lines values={contacts.map((p) => withJw(p.name, p.is_jw))} />
                </td>
                <td className={subMid}>
                  <Lines values={contacts.map((p) => p.name_kana)} />
                </td>
                <td className={subMid}>
                  <Lines values={contacts.map((p) => p.relationship)} />
                </td>
                <td className={subLast}>
                  <Lines values={contacts.map((p) => formatPhonesCompact(p.phones))} />
                </td>
                <td className={cell}>{h.shelters?.name ?? ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
