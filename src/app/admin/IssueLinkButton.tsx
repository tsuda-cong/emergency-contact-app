"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props =
  | { kind: "update"; householdId: string }
  | { kind: "register" };

export function IssueLinkButton(props: Props) {
  const [issuedUrl, setIssuedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleIssue() {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const supabase = createClient();
      const { data, error } =
        props.kind === "update"
          ? await supabase.rpc("issue_update_token", {
              p_household_id: props.householdId,
              p_days_valid: 14,
            })
          : await supabase.rpc("issue_registration_token", { p_days_valid: 14 });
      if (error || !data?.token) {
        setError("リンクの発行に失敗しました。");
        return;
      }
      const path = props.kind === "update" ? "update" : "register";
      setIssuedUrl(`${window.location.origin}/${path}/${data.token}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!issuedUrl) return;
    await navigator.clipboard.writeText(issuedUrl);
    setCopied(true);
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        onClick={handleIssue}
        disabled={loading}
        className={
          props.kind === "update"
            ? "text-sm text-blue-700 hover:underline disabled:opacity-60"
            : "rounded-md bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-700 disabled:opacity-60"
        }
      >
        {loading ? "発行中…" : props.kind === "update" ? "更新リンクを発行" : "新規登録リンクを発行"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {issuedUrl && (
        <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
          <input
            readOnly
            value={issuedUrl}
            className="w-64 bg-transparent text-xs text-slate-700 outline-none"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button onClick={handleCopy} className="text-xs font-medium text-blue-700 hover:underline">
            {copied ? "コピー済" : "コピー"}
          </button>
        </div>
      )}
    </div>
  );
}
