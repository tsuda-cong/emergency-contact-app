import type { PrintHousehold } from "./types";
import { formatPhonesCompact, withJw } from "./types";

// カード形式（A4縦・2段組み）。1世帯＝1枚のカードで、ページをまたがない。
// 段組み（CSS columns）で上から下へ詰めて並べるため、カードの高さがまちまちでも隙間が出にくい。
export function CardList({ households }: { households: PrintHousehold[] }) {
  return (
    <div className="columns-2 gap-2.5 text-[8pt] leading-[1.35] tabular-nums text-slate-900">
      {households.map((h) => (
        <HouseholdCard key={h.id} h={h} />
      ))}
    </div>
  );
}

// 同居人と緊急連絡先は1つの表にまとめ、小見出しは各まとまりの1行目の左端に置く
// （小見出しだけの行をなくして高さを抑える。氏名・続柄・電話の列も両者でそろう）。
function HouseholdCard({ h }: { h: PrintHousehold }) {
  const cohabitants = h.cohabitants ?? [];
  const contacts = h.emergency_contacts ?? [];
  const label = "pr-1.5 text-[6.5pt] font-semibold text-slate-500";

  return (
    <div className="mb-1.5 break-inside-avoid rounded-md border border-slate-300 px-2 py-1.5">
      <div className="flex items-baseline justify-between gap-2 border-b border-slate-200 pb-0.5">
        <span className="text-[9.5pt] font-bold">{h.name}</span>
        {h.shelters?.name && (
          <span className="shrink-0 rounded-sm bg-slate-100 px-1.5 text-[7pt] text-slate-600">
            {h.shelters.name}
          </span>
        )}
      </div>
      <div className="mt-0.5 text-slate-700">{h.address}</div>
      <div className="whitespace-nowrap">{formatPhonesCompact(h.phones)}</div>

      {cohabitants.length + contacts.length > 0 && (
        <table className="mt-1 border-collapse">
          <tbody className="[&_td]:whitespace-nowrap [&_td]:align-top">
            {cohabitants.map((p, i) => (
              <tr key={`c${i}`}>
                <td className={label}>{i === 0 ? "同居人" : ""}</td>
                <td className="pr-2">{withJw(p.name, p.is_jw)}</td>
                <td className="pr-2 text-slate-600">{p.relationship}</td>
                <td>{p.phone ?? ""}</td>
              </tr>
            ))}
            {contacts.map((p, i) => (
              <tr
                key={`e${i}`}
                // 同居人のあとに続く場合だけ、境目に少し間隔をあける
                className={i === 0 && cohabitants.length > 0 ? "[&>td]:pt-1" : ""}
              >
                <td className={label}>{i === 0 ? "緊急連絡先" : ""}</td>
                <td className="pr-2">
                  <div>{withJw(p.name, p.is_jw)}</div>
                  <div className="text-[7pt] text-slate-500">{p.name_kana}</div>
                </td>
                <td className="pr-2 text-slate-600">{p.relationship}</td>
                <td>
                  {(p.phones ?? []).filter(Boolean).map((ph) => (
                    <div key={ph}>{ph}</div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
