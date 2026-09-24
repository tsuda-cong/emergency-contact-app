import { createClient } from "@/lib/supabase/server";
import type { Shelter } from "@/lib/types";
import { RegisterFlow } from "./RegisterFlow";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const { data: shelters } = await supabase
    .from("shelters")
    .select("id, name, sort_order")
    .order("sort_order", { ascending: true });

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-2 text-xl font-bold text-slate-900">緊急連絡先情報の登録</h1>
      <RegisterFlow token={token} shelters={(shelters as Shelter[]) ?? []} />
    </main>
  );
}
