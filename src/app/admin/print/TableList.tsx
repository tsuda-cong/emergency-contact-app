import type { PrintHousehold } from "./types";
import { formatPhonesCompact, withJw } from "./types";

const cell = "px-1.5 py-1 align-top";
// 同居人・緊急連絡先の各項目（氏名・続柄など）はそれぞれ独立した列にし、
// 列幅を実際の文字の長さに合わせて自動で決める（固定幅だと長い名前が隣に重なるため）。
// 1人1行で折り返さないので、同じ人の項目は横一列にそろう。
const subFirst = "py-1 pl-1.5 pr-1 align-top whitespace-nowrap";
const subMid = "py-1 px-1 align-top whitespace-nowrap";
const subLast = "py-1 pl-1 pr-1.5 align-top whitespace-nowrap";
// 同居人・緊急連絡先・指定避難場所のまとまりの境目に引く薄い縦線
const divider = "border-l border-slate-200";

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

// 表形式（A4横）。1世帯＝1行。
export function TableList({ households }: { households: PrintHousehold[] }) {
  return (
    <table className="w-full border-collapse text-[8pt] leading-[1.35] tabular-nums text-slate-900">
      <thead className="text-left text-slate-700">
        <tr>
          <th rowSpan={2} className={`${cell} align-bottom`}>
            氏名
          </th>
          <th rowSpan={2} className={`${cell} align-bottom`}>
            住所・電話番号
          </th>
          <th colSpan={3} className={`${cell} ${divider} pb-0`}>
            同居人
          </th>
          <th colSpan={4} className={`${cell} ${divider} pb-0`}>
            緊急連絡先
          </th>
          <th rowSpan={2} className={`${cell} ${divider} align-bottom`}>
            指定避難場所
          </th>
        </tr>
        <tr className="text-[7pt] text-slate-500">
          <th className={`${subFirst} ${divider} pt-0 font-normal`}>氏名</th>
          <th className={`${subMid} pt-0 font-normal`}>続柄</th>
          <th className={`${subLast} pt-0 font-normal`}>電話</th>
          <th className={`${subFirst} ${divider} pt-0 font-normal`}>氏名</th>
          <th className={`${subMid} pt-0 font-normal`}>ふりがな</th>
          <th className={`${subMid} pt-0 font-normal`}>続柄</th>
          <th className={`${subLast} pt-0 font-normal`}>電話</th>
        </tr>
        <tr>
          <th colSpan={10} className="h-0 border-b-[1.5px] border-slate-700 p-0" />
        </tr>
      </thead>
      <tbody>
        {households.map((h) => {
          const cohabitants = h.cohabitants ?? [];
          const contacts = h.emergency_contacts ?? [];
          return (
            <tr key={h.id} className="border-b border-slate-300">
              <td className={`${cell} font-semibold`}>{h.name}</td>
              <td className={cell}>
                <div>{h.address}</div>
                <div className="whitespace-nowrap">{formatPhonesCompact(h.phones)}</div>
              </td>
              <td className={`${subFirst} ${divider}`}>
                <Lines values={cohabitants.map((p) => withJw(p.name, p.is_jw))} />
              </td>
              <td className={subMid}>
                <Lines values={cohabitants.map((p) => p.relationship)} />
              </td>
              <td className={subLast}>
                <Lines values={cohabitants.map((p) => p.phone ?? "")} />
              </td>
              <td className={`${subFirst} ${divider}`}>
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
              <td className={`${cell} ${divider}`}>{h.shelters?.name ?? ""}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
