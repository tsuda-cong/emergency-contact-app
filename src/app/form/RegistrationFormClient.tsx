"use client";

import { HouseholdForm } from "@/components/HouseholdForm";
import { createClient } from "@/lib/supabase/client";
import { ALREADY_REGISTERED_MESSAGE } from "@/lib/messages";
import type { RegistrationPayload, Shelter } from "@/lib/types";

export function RegistrationFormClient({ shelters }: { shelters: Shelter[] }) {
  async function handleSubmit(payload: RegistrationPayload) {
    const supabase = createClient();
    const { error } = await supabase.rpc("submit_registration", { payload });
    if (error) {
      if (error.message.includes("form_closed")) {
        return {
          ok: false,
          error: "このフォームの受付は終了しました。登録を希望される方は書記にご連絡ください。",
        };
      }
      if (error.message.includes("already_registered")) {
        return { ok: false, error: ALREADY_REGISTERED_MESSAGE };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }

  return (
    <HouseholdForm shelters={shelters} submitLabel="送信する" onSubmit={handleSubmit} />
  );
}
