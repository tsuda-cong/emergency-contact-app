import { createClient } from "@/lib/supabase/server";
import type { Shelter } from "@/lib/types";
import { RegistrationFormClient } from "./RegistrationFormClient";

export const dynamic = "force-dynamic";

export default async function FormPage() {
  const supabase = await createClient();
  const [{ data: settings }, { data: shelters }] = await Promise.all([
    supabase.from("settings").select("form_open").eq("id", 1).maybeSingle(),
    supabase.from("shelters").select("id, name, sort_order").order("sort_order", { ascending: true }),
  ]);

  const formOpen = settings?.form_open ?? false;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-2 text-xl font-bold text-slate-900">緊急連絡先情報の登録</h1>
      {formOpen ? (
        <>
          <p className="mb-8 text-sm text-slate-600">
            本人・同居人・緊急連絡先の情報をご入力ください。
          </p>
          <RegistrationFormClient shelters={(shelters as Shelter[]) ?? []} />
        </>
      ) : (
        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-6 text-slate-700">
          このフォームの受付は終了しました。登録を希望される方は書記にご連絡ください。
        </div>
      )}
    </main>
  );
}
