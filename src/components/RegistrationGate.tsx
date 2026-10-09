"use client";

import { useState } from "react";
import { BirthdateSelect } from "@/components/BirthdateSelect";
import { HouseholdForm, emptyHouseholdFormValues } from "@/components/HouseholdForm";
import { LIMITS } from "@/lib/limits";
import { ALREADY_REGISTERED_MESSAGE, FORM_CLOSED_MESSAGE } from "@/lib/messages";
import { createClient } from "@/lib/supabase/client";
import type { RegistrationPayload, Shelter } from "@/lib/types";

type Stage = "check" | "registered" | "closed" | "form";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2.5 text-base text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500";

// 新規登録の入口。最初に氏名と生年月日だけを入力して登録済みかどうかを確認し、
// 未登録の場合だけ残りの項目の入力に進む（すべて入力してから重複ではじかれる手間をなくすため）。
// token: 新規登録リンクのトークン（一斉収集リンクの場合は省略）
export function RegistrationGate({
  shelters,
  token,
  onSubmit,
  onInvalidLink,
}: {
  shelters: Shelter[];
  token?: string;
  onSubmit: (payload: RegistrationPayload) => Promise<{ ok: boolean; error?: string }>;
  onInvalidLink?: () => void;
}) {
  const [stage, setStage] = useState<Stage>("check");
  const [name, setName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setChecking(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("check_registered", {
        p_name: name.trim(),
        p_birthdate: birthdate,
        p_token: token ?? null,
      });
      if (error) {
        setError("確認に失敗しました。時間をおいて再度お試しください。");
        return;
      }
      if (!data?.ok) {
        if (data?.reason === "invalid_link") {
          onInvalidLink?.();
        } else if (data?.reason === "form_closed") {
          setStage("closed");
        } else {
          setError("確認に失敗しました。時間をおいて再度お試しください。");
        }
        return;
      }
      setStage(data.registered ? "registered" : "form");
    } finally {
      setChecking(false);
    }
  }

  if (stage === "closed") {
    return (
      <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-6 text-slate-700">
        {FORM_CLOSED_MESSAGE}
      </div>
    );
  }

  if (stage === "registered") {
    return (
      <div className="mt-6 space-y-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-900">
          {ALREADY_REGISTERED_MESSAGE}
        </div>
        <button
          type="button"
          onClick={() => setStage("check")}
          className="text-sm text-slate-600 underline hover:text-slate-900"
        >
          氏名・生年月日を入力し直す
        </button>
      </div>
    );
  }

  if (stage === "form") {
    return (
      <>
        <p className="mb-8 text-sm text-slate-600">
          本人・同居人・緊急連絡先の情報をご入力ください。
        </p>
        <HouseholdForm
          shelters={shelters}
          initialValues={{ ...emptyHouseholdFormValues(), name: name.trim(), birthdate }}
          submitLabel="送信する"
          onSubmit={onSubmit}
        />
      </>
    );
  }

  return (
    <form
      onSubmit={handleCheck}
      className="mt-6 space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <p className="text-sm text-slate-600">
        はじめに、氏名と生年月日を入力してください。登録済みかどうかを確認します。
      </p>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">氏名 *</label>
        <input
          className={inputClass}
          required
          maxLength={LIMITS.name}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">生年月日 *</label>
        <BirthdateSelect
          className="rounded-md border border-slate-300 px-3 py-2.5 text-base text-slate-900 shadow-sm"
          required
          value={birthdate}
          onChange={setBirthdate}
        />
      </div>
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      <button
        type="submit"
        disabled={checking}
        className="w-full rounded-md bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {checking ? "確認中…" : "次へ"}
      </button>
    </form>
  );
}
