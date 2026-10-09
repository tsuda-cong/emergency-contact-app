"use client";

import { RegistrationGate } from "@/components/RegistrationGate";
import { createClient } from "@/lib/supabase/client";
import {
  ALREADY_REGISTERED_MESSAGE,
  FORM_CLOSED_MESSAGE,
  SUBMIT_FAILED_MESSAGE,
} from "@/lib/messages";
import type { RegistrationPayload, Shelter } from "@/lib/types";

export function RegistrationFormClient({ shelters }: { shelters: Shelter[] }) {
  async function handleSubmit(payload: RegistrationPayload) {
    const supabase = createClient();
    const { error } = await supabase.rpc("submit_registration", { payload });
    if (error) {
      if (error.message.includes("form_closed")) {
        return { ok: false, error: FORM_CLOSED_MESSAGE };
      }
      if (error.message.includes("already_registered")) {
        return { ok: false, error: ALREADY_REGISTERED_MESSAGE };
      }
      return { ok: false, error: SUBMIT_FAILED_MESSAGE };
    }
    return { ok: true };
  }

  return <RegistrationGate shelters={shelters} onSubmit={handleSubmit} />;
}
