"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Target = { kind: "update"; householdId: string } | { kind: "register" };

// リンクを発行して URL を返す（失敗時は null）
export async function issueLink(target: Target): Promise<string | null> {
  const supabase = createClient();
  const { data, error } =
    target.kind === "update"
      ? await supabase.rpc("issue_update_token", {
          p_household_id: target.householdId,
          p_days_valid: 14,
        })
      : await supabase.rpc("issue_registration_token", { p_days_valid: 14 });
  if (error || !data?.token) {
    return null;
  }
  const path = target.kind === "update" ? "update" : "register";
  return `${window.location.origin}/${path}/${data.token}`;
}

// 発行したリンクの表示とコピー
export function IssuedLinkBox({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
      <input
        readOnly
        value={url}
        className="w-64 bg-transparent text-xs text-slate-700 outline-none"
        onFocus={(e) => e.currentTarget.select()}
      />
      <button onClick={handleCopy} className="text-xs font-medium text-blue-700 hover:underline">
        {copied ? "コピー済" : "コピー"}
      </button>
    </div>
  );
}

// 新規登録リンクの発行ボタン（管理画面上部）
export function IssueLinkButton() {
  const [issuedUrl, setIssuedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleIssue() {
    setLoading(true);
    setError(null);
    setIssuedUrl(null);
    try {
      const url = await issueLink({ kind: "register" });
      if (!url) {
        setError("リンクの発行に失敗しました。");
        return;
      }
      setIssuedUrl(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        onClick={handleIssue}
        disabled={loading}
        className="rounded-md bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-700 disabled:opacity-60"
      >
        {loading ? "発行中…" : "新規登録リンクを発行"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {issuedUrl && <IssuedLinkBox key={issuedUrl} url={issuedUrl} />}
    </div>
  );
}
