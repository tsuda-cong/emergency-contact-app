import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { katakanaToHiragana } from "@/lib/kana-romaji";
import type {
  CohabitantRow,
  EmergencyContactRow,
  HouseholdFormValues,
  HouseholdRow,
  Shelter,
} from "@/lib/types";
import { EditFormClient } from "./EditFormClient";

export const dynamic = "force-dynamic";

export default async function EditHouseholdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  if (profile?.role !== "editor") {
    redirect(`/admin/households/${id}`);
  }

  const [{ data: household }, { data: cohabitants }, { data: contacts }, { data: shelters }] =
    await Promise.all([
      supabase.from("households").select("*").eq("id", id).single(),
      supabase.from("cohabitants").select("*").eq("household_id", id).order("sort_order"),
      supabase.from("emergency_contacts").select("*").eq("household_id", id).order("sort_order"),
      supabase.from("shelters").select("id, name, sort_order").order("sort_order"),
    ]);

  if (!household) {
    notFound();
  }

  const h = household as HouseholdRow;

  const initialValues: HouseholdFormValues = {
    name: h.name,
    nameKana: katakanaToHiragana(h.name_kana),
    address: h.address,
    phones: h.phones ?? [],
    birthdate: h.birthdate,
    shelterId: h.shelter_id ?? "",
    consent: true,
    cohabitants: ((cohabitants as CohabitantRow[] | null) ?? []).map((c) => ({
      name: c.name,
      nameKana: katakanaToHiragana(c.name_kana),
      relationship: c.relationship,
      phone: c.phone ?? "",
      isJw: c.is_jw,
    })),
    emergencyContacts: ((contacts as EmergencyContactRow[] | null) ?? []).map((c) => ({
      name: c.name,
      nameKana: katakanaToHiragana(c.name_kana),
      relationship: c.relationship,
      phones: c.phones ?? [],
      isJw: c.is_jw,
    })),
  };

  return (
    <div>
      <h1 className="mb-6 text-lg font-bold text-slate-900">代理編集: {h.name}</h1>
      <EditFormClient
        householdId={id}
        shelters={(shelters as Shelter[]) ?? []}
        initialValues={initialValues}
      />
    </div>
  );
}
