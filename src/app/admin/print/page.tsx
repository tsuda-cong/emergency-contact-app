import Link from "next/link";
import { type CircuitInfo, formatCircuitLine } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { CardList } from "./CardList";
import { PrintButton } from "./PrintButton";
import { TableList } from "./TableList";
import type { PrintHousehold } from "./types";

export const dynamic = "force-dynamic";

type Layout = "table" | "card";

const LAYOUT_LABELS: Record<Layout, string> = {
  table: "表形式（A4横）",
  card: "カード形式（A4縦）",
};

export default async function AdminPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ layout?: string }>;
}) {
  const layout: Layout = (await searchParams).layout === "card" ? "card" : "table";
  const isCard = layout === "card";

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

  const households = (data as PrintHousehold[] | null) ?? [];
  const now = new Date();
  const printedAt = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;

  return (
    // 画面上のプレビュー幅は、印刷時の用紙の印字幅（A4横 277mm／A4縦 190mm）に合わせている
    <div
      className={`${isCard ? "w-[766px]" : "w-[1050px]"} max-w-none bg-white p-6 print:w-full print:p-0`}
    >
      <style>{`
        @page {
          size: A4 ${isCard ? "portrait" : "landscape"};
          margin: 10mm;
          @bottom-center {
            content: counter(page) " / " counter(pages);
            font-size: 8pt;
            color: #475569;
          }
        }
        @media print {
          /* 1世帯分（表の1行／カード1枚）が2ページにまたがらないようにする */
          tr, td {
            break-inside: avoid;
          }
        }
      `}</style>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="text-lg font-bold text-slate-900">一覧PDF出力プレビュー</h1>
        <div className="flex items-center gap-3">
          <div className="flex rounded-md border border-slate-300 p-0.5 text-sm">
            {(Object.keys(LAYOUT_LABELS) as Layout[]).map((key) => (
              <Link
                key={key}
                href={`/admin/print?layout=${key}`}
                className={`rounded px-3 py-1 ${
                  layout === key ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {LAYOUT_LABELS[key]}
              </Link>
            ))}
          </div>
          <PrintButton />
        </div>
      </div>

      {isCard ? (
        // A4縦は幅が狭いため、タイトルと巡回監督の連絡先を2行に分ける
        <div className="mb-3 border-b-[1.5px] border-slate-700 pb-1.5">
          <div className="flex items-baseline justify-between gap-4">
            <h1 className="text-base font-bold text-slate-900">
              緊急連絡先 登録一覧　大阪府枚方市津田会衆（22046）
            </h1>
            <span className="shrink-0 text-xs text-slate-600">{printedAt}</span>
          </div>
          {circuitLine && <div className="text-xs text-slate-800">{circuitLine}</div>}
        </div>
      ) : (
        <div className="mb-2 flex items-baseline gap-6">
          <h1 className="text-base font-bold text-slate-900">
            緊急連絡先 登録一覧　大阪府枚方市津田会衆（22046）
          </h1>
          {circuitLine && <span className="text-xs text-slate-800">{circuitLine}</span>}
          <span className="ml-auto shrink-0 text-xs text-slate-600">{printedAt}</span>
        </div>
      )}

      {isCard ? <CardList households={households} /> : <TableList households={households} />}
    </div>
  );
}
