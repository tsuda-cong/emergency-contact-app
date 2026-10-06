import type { PrintHousehold } from "./types";
import { formatPhonesCompact, withJw } from "./types";

// 案C: A4縦・2段組みのカード表示。1世帯＝1枚のカードで、ページをまたがない。
// 段組み（CSS columns）で上から下へ詰めて並べるため、カードの高さがまちまちでも隙間が出にくい。
export function CardList({ households }: { households: PrintHousehold[] }) {
  return (
    <div className="columns-2 gap-3 text-[8pt] leading-[1.35] tabular-nums text-slate-900">
      {households.map((h) => (
        <HouseholdCard key={h.id} h={h} />
      ))}
    </div>
  );
}

function HouseholdCard({ h }: { h: PrintHousehold }) {
  const cohabitants = h.cohabitants ?? [];
  const contacts = h.emergency_contacts ?? [];

  return (
    <div className="mb-2.5 break-inside-avoid rounded-md border border-slate-300 px-2.5 py-2">
      <div className="flex items-baseline justify-between gap-2 border-b border-slate-200 pb-1">
        <span className="text-[9.5pt] font-bold">{h.name}</span>
        {h.shelters?.name && (
          <span className="shrink-0 rounded-sm bg-slate-100 px-1.5 text-[7pt] text-slate-600">
            {h.shelters.name}
          </span>
        )}
      </div>
      <div className="mt-1 text-slate-700">{h.address}</div>
      <div className="whitespace-nowrap">{formatPhonesCompact(h.phones)}</div>

      {cohabitants.length > 0 && (
        <Section label="同居人">
          {cohabitants.map((p, i) => (
            <tr key={i}>
              <td className="pr-2">{withJw(p.name, p.is_jw)}</td>
              <td className="pr-2 text-slate-600">{p.relationship}</td>
              <td>{p.phone ?? ""}</td>
            </tr>
          ))}
        </Section>
      )}

      {contacts.length > 0 && (
        <Section label="緊急連絡先">
          {contacts.map((p, i) => (
            <tr key={i}>
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
        </Section>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-1.5">
      <div className="text-[7pt] font-semibold text-slate-500">{label}</div>
      <table className="border-collapse">
        <tbody className="[&_td]:whitespace-nowrap [&_td]:align-top">{children}</tbody>
      </table>
    </div>
  );
}
