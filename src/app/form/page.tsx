import { createClient } from "@/lib/supabase/server";
import type { Shelter } from "@/lib/types";
import { RegistrationFormClient } from "./RegistrationFormClient";

export const dynamic = "force-dynamic";

export default async function FormPage() {
  const supabase = await createClient();
  const { data: shelters, error } = await supabase
    .from("shelters")
    .select("id, name, sort_order")
    .order("sort_order", { ascending: true });

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-2 text-xl font-bold text-slate-900">緊急連絡先情報の登録</h1>
      <p className="mb-8 text-sm text-slate-600">
        本人・同居人・緊急連絡先の情報をご入力ください。
      </p>
      {error && (() => {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
        const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
        const findBad = (s: string) => {
          for (let i = 0; i < s.length; i++) {
            if (s.charCodeAt(i) > 255) return `index ${i}: "${s[i]}" (U+${s.charCodeAt(i).toString(16)})`;
          }
          return "none";
        };
        return (
          <pre className="mb-4 whitespace-pre-wrap break-all rounded bg-red-50 p-3 text-xs text-red-800">
            DEBUG shelters error: {JSON.stringify(error, null, 2)}
            {"\n"}url (len {url.length}): [{url}]
            {"\n"}url bad char: {findBad(url)}
            {"\n"}anon (len {anon.length}): [{anon}]
            {"\n"}anon bad char: {findBad(anon)}
          </pre>
        );
      })()}
      <RegistrationFormClient shelters={(shelters as Shelter[]) ?? []} />
    </main>
  );
}
