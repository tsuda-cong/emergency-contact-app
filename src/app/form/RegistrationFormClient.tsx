"use client";

import { HouseholdForm } from "@/components/HouseholdForm";
import { createClient } from "@/lib/supabase/client";
import type { RegistrationPayload, Shelter } from "@/lib/types";

export function RegistrationFormClient({ shelters }: { shelters: Shelter[] }) {
  async function handleSubmit(payload: RegistrationPayload) {
    const supabase = createClient();
    const { error } = await supabase.rpc("submit_registration", { payload });
    if (error) {
      if (error.message.includes("form_closed")) {
        return {
          ok: false,
          error: "このフォームの受付は終了しました。登録を希望される方は長老にご連絡ください。",
        };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }

  return (
    <HouseholdForm shelters={shelters} submitLabel="送信する" onSubmit={handleSubmit} />
  );
}
