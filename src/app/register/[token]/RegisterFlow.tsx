"use client";

import { useEffect, useState } from "react";
import { HouseholdForm } from "@/components/HouseholdForm";
import { ALREADY_REGISTERED_MESSAGE } from "@/lib/messages";
import { createClient } from "@/lib/supabase/client";
import type { RegistrationPayload, Shelter } from "@/lib/types";

type Stage = "loading" | "invalid" | "form";

const INVALID_MESSAGE = "このリンクは無効です。書記にご連絡ください。";

export function RegisterFlow({ token, shelters }: { token: string; shelters: Shelter[] }) {
  const [stage, setStage] = useState<Stage>("loading");

  useEffect(() => {
    const supabase = createClient();
    supabase
      .rpc("verify_registration_token", { p_token: token })
      .then(({ data, error }) => {
        setStage(error || !data?.valid ? "invalid" : "form");
      });
  }, [token]);

  async function handleSubmit(payload: RegistrationPayload) {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("submit_registration_with_token", {
      p_token: token,
      payload,
    });
    if (error) {
      return { ok: false, error: error.message };
    }
    if (!data?.ok) {
      if (data?.reason === "invalid_link") {
        setStage("invalid");
        return { ok: false, error: INVALID_MESSAGE };
      }
      if (data?.reason === "already_registered") {
        return { ok: false, error: ALREADY_REGISTERED_MESSAGE };
      }
      return { ok: false, error: "送信に失敗しました。時間をおいて再度お試しください。" };
    }
    return { ok: true };
  }

  if (stage === "loading") {
    return <p className="mt-6 text-sm text-slate-500">確認しています…</p>;
  }

  if (stage === "invalid") {
    return (
      <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
        {INVALID_MESSAGE}
      </div>
    );
  }

  return (
    <>
      <p className="mb-8 text-sm text-slate-600">
        本人・同居人・緊急連絡先の情報をご入力ください。
      </p>
      <HouseholdForm shelters={shelters} submitLabel="送信する" onSubmit={handleSubmit} />
    </>
  );
}
