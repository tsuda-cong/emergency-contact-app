"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { type CircuitInfo, formatCircuitLine } from "@/lib/format";
import { normalizePhone } from "@/lib/normalize";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500";
const labelClass = "mb-1 block text-xs font-medium text-slate-500";

// PDF出力のタイトル行に表示する巡回区・巡回監督の連絡先。編集ロールのみ変更できる。
// 普段は名前と電話番号の1行だけを表示し、「編集」（閲覧ロールは「詳しく」）で入力欄を開く。
export function CircuitInfoForm({ initial, isEditor }: { initial: CircuitInfo; isEditor: boolean }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  // saved: 保存済みの値（1行表示に使う）。values: 入力中の値
  const [saved, setSaved] = useState<CircuitInfo>(initial);
  const [values, setValues] = useState<CircuitInfo>(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (!expanded) {
    const summary = [
      saved.overseer_name && `${saved.overseer_name}兄弟`,
      saved.overseer_phone,
    ]
      .filter(Boolean)
      .join("　");
    return (
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="min-w-0 truncate">
          <span className="mr-3 font-semibold text-slate-900">巡回監督</span>
          <span className="text-slate-700">{summary || "（未登録）"}</span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
        >
          {isEditor ? (summary ? "編集" : "登録する") : "詳しく"}
        </button>
      </div>
    );
  }

  function handleClose() {
    // 保存していない入力は破棄して、保存済みの内容に戻す
    setValues(saved);
    setMessage(null);
    setExpanded(false);
  }

  function update(key: keyof CircuitInfo, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setMessage(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("set_circuit_info", {
        p_circuit_name: values.circuit_name,
        p_overseer_name: values.overseer_name,
        p_overseer_phone: values.overseer_phone,
        p_overseer_email: values.overseer_email,
      });
      if (error) {
        setMessage({ ok: false, text: "保存に失敗しました。" });
        return;
      }
      setSaved(values);
      setMessage(null);
      setExpanded(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const preview = formatCircuitLine(values);

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="mb-3 text-sm font-semibold text-slate-900">巡回監督の連絡先（PDFのタイトル行に表示）</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div>
          <label className={labelClass}>巡回区</label>
          <div className="flex items-center gap-1.5">
            <input
              className={inputClass}
              value={values.circuit_name}
              onChange={(e) => update("circuit_name", e.target.value)}
              placeholder="近畿第7"
              disabled={!isEditor}
            />
            <span className="shrink-0 text-sm text-slate-600">巡回区</span>
          </div>
        </div>
        <div>
          <label className={labelClass}>名前</label>
          <div className="flex items-center gap-1.5">
            <input
              className={inputClass}
              value={values.overseer_name}
              onChange={(e) => update("overseer_name", e.target.value)}
              disabled={!isEditor}
            />
            <span className="shrink-0 text-sm text-slate-600">兄弟</span>
          </div>
        </div>
        <div>
          <label className={labelClass}>電話</label>
          <input
            className={inputClass}
            type="tel"
            value={values.overseer_phone}
            onChange={(e) => update("overseer_phone", e.target.value)}
            onBlur={(e) => update("overseer_phone", normalizePhone(e.target.value))}
            disabled={!isEditor}
          />
        </div>
        <div>
          <label className={labelClass}>メールアドレス</label>
          <input
            className={inputClass}
            type="email"
            value={values.overseer_email}
            onChange={(e) => update("overseer_email", e.target.value)}
            disabled={!isEditor}
          />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-xs text-slate-500">
          PDFの表示: {preview || "（未登録）"}
        </p>
        {message && (
          <span className={`text-sm ${message.ok ? "text-green-700" : "text-red-600"}`}>{message.text}</span>
        )}
        <button
          type="button"
          onClick={handleClose}
          disabled={saving}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {isEditor ? "やめる" : "閉じる"}
        </button>
        {isEditor && (
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {saving ? "保存中…" : "保存する"}
          </button>
        )}
      </div>
    </form>
  );
}
