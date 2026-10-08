"use client";

import { useState } from "react";

// 生年月日の入力欄。ブラウザ標準の日付入力（カレンダー）は端末によっては月送りで何十年も
// さかのぼる必要があり年配の方に使いにくいため、年・月・日の3つの選択欄にしている。
// 年の選択肢には和暦を添える。値は "YYYY-MM-DD"（3つすべて選ぶまでは空文字）。

const OLDEST_YEAR = 1920;

// 改元の年は、その年に使われた2つの元号を併記する
const ERAS = [
  { name: "令和", start: 2019 },
  { name: "平成", start: 1989 },
  { name: "昭和", start: 1926 },
  { name: "大正", start: 1912 },
];

function eraLabel(year: number): string {
  const labels: string[] = [];
  for (let i = 0; i < ERAS.length; i++) {
    const era = ERAS[i];
    const nextStart = i === 0 ? Infinity : ERAS[i - 1].start;
    if (year >= era.start && year <= nextStart) {
      const n = year - era.start + 1;
      labels.unshift(`${era.name}${n === 1 ? "元" : n}年`);
    }
  }
  return labels.join("／");
}

function daysInMonth(year: number, month: number): number {
  // 年が未選択のときは、うるう年として扱い2月29日まで選べるようにする
  return new Date(year || 2000, month, 0).getDate();
}

function parse(value: string): { y: string; m: string; d: string } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return { y: "", m: "", d: "" };
  return { y: match[1], m: String(Number(match[2])), d: String(Number(match[3])) };
}

export function BirthdateSelect({
  value,
  onChange,
  required,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className: string;
}) {
  // 3つすべて選ぶまでは親に空文字を渡すため、途中の選択状態はここで持つ
  const [parts, setParts] = useState(() => parse(value));
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - OLDEST_YEAR + 1 }, (_, i) => OLDEST_YEAR + i);
  const maxDay = parts.m ? daysInMonth(Number(parts.y), Number(parts.m)) : 31;

  function update(next: Partial<typeof parts>) {
    const merged = { ...parts, ...next };
    // 月や年を変えて、選んでいた日がその月にない場合（2月30日など）は日を選び直してもらう
    if (merged.d && merged.m && Number(merged.d) > daysInMonth(Number(merged.y), Number(merged.m))) {
      merged.d = "";
    }
    setParts(merged);
    onChange(
      merged.y && merged.m && merged.d
        ? `${merged.y}-${merged.m.padStart(2, "0")}-${merged.d.padStart(2, "0")}`
        : ""
    );
  }

  return (
    // 年は和暦を添えて長くなるため1段目に幅いっぱいで置き、月・日は2段目に並べる
    <div className="grid grid-cols-2 gap-2">
      <select
        className={`${className} col-span-2 w-full`}
        required={required}
        value={parts.y}
        onChange={(e) => update({ y: e.target.value })}
        aria-label="生まれた年"
      >
        <option value="">年</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}年（{eraLabel(y)}）
          </option>
        ))}
      </select>
      <select
        className={`${className} w-full`}
        required={required}
        value={parts.m}
        onChange={(e) => update({ m: e.target.value })}
        aria-label="生まれた月"
      >
        <option value="">月</option>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
          <option key={m} value={m}>
            {m}月
          </option>
        ))}
      </select>
      <select
        className={`${className} w-full`}
        required={required}
        value={parts.d}
        onChange={(e) => update({ d: e.target.value })}
        aria-label="生まれた日"
      >
        <option value="">日</option>
        {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {d}日
          </option>
        ))}
      </select>
    </div>
  );
}
