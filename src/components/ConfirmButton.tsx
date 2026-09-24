"use client";

import { useState } from "react";

// ブラウザ標準の confirm() は環境によって表示されない（自動でキャンセル扱いになる）ことがあるため、
// ページ内に確認ダイアログを表示するボタン。
export function ConfirmButton({
  label,
  message,
  confirmLabel,
  danger = false,
  className,
  onConfirm,
}: {
  label: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  className: string;
  onConfirm: () => Promise<string | null>; // 失敗時はエラーメッセージを返す
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const result = await onConfirm();
      if (result) {
        setError(result);
      } else {
        setOpen(false);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg">
            <p className="whitespace-pre-line text-sm text-slate-800">{message}</p>
            {error && (
              <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setError(null);
                }}
                disabled={loading}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                やめる
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading}
                className={`rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                  danger ? "bg-red-600 hover:bg-red-700" : "bg-slate-900 hover:bg-slate-800"
                }`}
              >
                {loading ? "処理中…" : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
