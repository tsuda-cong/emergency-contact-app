"use client";

import { useEffect, useState } from "react";
import { HouseholdForm } from "@/components/HouseholdForm";
import { createClient } from "@/lib/supabase/client";
import { katakanaToHiragana } from "@/lib/kana-romaji";
import type { HouseholdFormValues, RegistrationPayload, Shelter } from "@/lib/types";

type Stage = "loading" | "invalid" | "identity" | "edit";

const INVALID_MESSAGES: Record<string, string> = {
  not_found: "このリンクは無効です。書記にご連絡ください。",
  used: "このリンクは無効です。書記にご連絡ください。",
  locked: "このリンクは無効です。書記にご連絡ください。",
  expired: "このリンクは無効です。書記にご連絡ください。",
  invalid_link: "このリンクは無効です。書記にご連絡ください。",
};

export function UpdateFlow({ token, shelters }: { token: string; shelters: Shelter[] }) {
  const [stage, setStage] = useState<Stage>("loading");
  const [invalidMessage, setInvalidMessage] = useState("");
  const [name, setName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [initialValues, setInitialValues] = useState<HouseholdFormValues | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .rpc("verify_update_token", { p_token: token })
      .then(({ data, error }) => {
        if (error || !data?.valid) {
          setInvalidMessage(INVALID_MESSAGES[data?.reason ?? "invalid_link"] ?? INVALID_MESSAGES.invalid_link);
          setStage("invalid");
          return;
        }
        setName(data.name ?? "");
        setStage("identity");
      });
  }, [token]);

  async function handleIdentitySubmit(e: React.FormEvent) {
    e.preventDefault();
    setIdentityError(null);
    setChecking(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("confirm_update_identity", {
        p_token: token,
        p_birthdate: birthdate,
      });

      if (error) {
        setIdentityError("確認に失敗しました。時間をおいて再度お試しください。");
        return;
      }

      if (!data?.ok) {
        if (data?.reason === "invalid_link") {
          setInvalidMessage(INVALID_MESSAGES.invalid_link);
          setStage("invalid");
          return;
        }
        setIdentityError("確認できませんでした。書記にご連絡ください。");
        return;
      }

      const household = data.household;
      setInitialValues({
        name: household.name,
        nameKana: katakanaToHiragana(household.nameKana),
        address: household.address,
        phones: household.phones ?? [],
        birthdate: household.birthdate,
        shelterId: household.shelterId ?? "",
        cohabitants: (data.cohabitants ?? []).map((c: Record<string, unknown>) => ({
          name: c.name as string,
          nameKana: katakanaToHiragana(c.name_kana as string),
          relationship: c.relationship as string,
          phone: (c.phone as string) ?? "",
          isJw: Boolean(c.is_jw),
        })),
        emergencyContacts: (data.emergencyContacts ?? []).map((c: Record<string, unknown>) => ({
          name: c.name as string,
          nameKana: katakanaToHiragana(c.name_kana as string),
          relationship: c.relationship as string,
          phones: (c.phones as string[]) ?? [],
          isJw: Boolean(c.is_jw),
        })),
        consent: false,
      });
      setStage("edit");
    } finally {
      setChecking(false);
    }
  }

  async function handleEditSubmit(payload: RegistrationPayload) {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("submit_update", { p_token: token, payload });
    if (error) {
      return { ok: false, error: error.message };
    }
    if (!data?.ok) {
      if (data?.reason === "invalid_link") {
        setInvalidMessage(INVALID_MESSAGES.invalid_link);
        setStage("invalid");
        return { ok: false, error: "このリンクは無効です。" };
      }
      return { ok: false, error: "更新に失敗しました。時間をおいて再度お試しください。" };
    }
    return { ok: true };
  }

  if (stage === "loading") {
    return <p className="text-sm text-slate-500">確認しています…</p>;
  }

  if (stage === "invalid") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
        {invalidMessage}
      </div>
    );
  }

  if (stage === "identity") {
    return (
      <form onSubmit={handleIdentitySubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">
          本人確認のため、生年月日を入力してください。
        </p>
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">氏名</span>
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-base text-slate-900">
            {name}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">生年月日</label>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-base text-slate-900"
            required
            type="date"
            value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
          />
        </div>
        {identityError && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {identityError}
          </div>
        )}
        <button
          type="submit"
          disabled={checking}
          className="w-full rounded-md bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {checking ? "確認中…" : "確認する"}
        </button>
      </form>
    );
  }

  if (stage === "edit" && initialValues) {
    return (
      <HouseholdForm
        shelters={shelters}
        initialValues={initialValues}
        submitLabel="更新する"
        onSubmit={handleEditSubmit}
      />
    );
  }

  return null;
}
