"use client";

import { useRouter } from "next/navigation";
import { HouseholdForm } from "@/components/HouseholdForm";
import { createClient } from "@/lib/supabase/client";
import type { HouseholdFormValues, RegistrationPayload, Shelter } from "@/lib/types";

export function EditFormClient({
  householdId,
  shelters,
  initialValues,
}: {
  householdId: string;
  shelters: Shelter[];
  initialValues: HouseholdFormValues;
}) {
  const router = useRouter();

  async function handleSubmit(payload: RegistrationPayload) {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("admin_update_household", {
      p_household_id: householdId,
      payload,
    });
    if (error || !data?.ok) {
      return { ok: false, error: error?.message ?? "更新に失敗しました。" };
    }
    router.push(`/admin/households/${householdId}`);
    router.refresh();
    return { ok: true };
  }

  return (
    <HouseholdForm
      shelters={shelters}
      initialValues={initialValues}
      submitLabel="更新を保存する"
      requireConsent={false}
      cancelHref={`/admin/households/${householdId}`}
      onSubmit={handleSubmit}
    />
  );
}
