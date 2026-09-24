"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/ConfirmButton";
import { createClient } from "@/lib/supabase/client";

export function FormOpenToggle({ formOpen, isEditor }: { formOpen: boolean; isEditor: boolean }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  async function handleToggle() {
    const supabase = createClient();
    const { error } = await supabase.rpc("set_form_open", { p_open: !formOpen });
    if (error) {
      return "切り替えに失敗しました。";
    }
    router.refresh();
    return null;
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(`${window.location.origin}/form`);
    setCopied(true);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm text-slate-700">一斉収集リンク（/form）:</span>
      <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
          formOpen ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-700"
        }`}
      >
        {formOpen ? "受付中" : "停止中"}
      </span>
      {formOpen && (
        <button onClick={handleCopy} className="text-sm text-blue-700 hover:underline">
          {copied ? "URLをコピー済" : "URLをコピー"}
        </button>
      )}
      {isEditor && (
        <ConfirmButton
          label={formOpen ? "受付を停止する" : "受付を再開する"}
          message={
            formOpen
              ? "一斉収集リンクの受付を停止します。\n停止中は /form から登録できなくなります。"
              : "一斉収集リンクの受付を再開します。\nリンクを知っている人は誰でも登録できるようになります。"
          }
          confirmLabel={formOpen ? "停止する" : "再開する"}
          className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
          onConfirm={handleToggle}
        />
      )}
    </div>
  );
}
