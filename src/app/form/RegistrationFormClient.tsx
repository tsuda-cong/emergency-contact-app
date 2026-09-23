"use client";

import { HouseholdForm } from "@/components/HouseholdForm";
import { createClient } from "@/lib/supabase/client";
import type { RegistrationPayload, Shelter } from "@/lib/types";

export function RegistrationFormClient({ shelters }: { shelters: Shelter[] }) {
  async function handleSubmit(payload: RegistrationPayload) {
    const supabase = createClient();
    const { error } = await supabase.rpc("submit_registration", { payload });
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }

  return (
    <HouseholdForm shelters={shelters} submitLabel="送信する" onSubmit={handleSubmit} />
  );
}
