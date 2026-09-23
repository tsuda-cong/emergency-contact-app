import { createClient } from "@/lib/supabase/server";
import type { Shelter } from "@/lib/types";
import { UpdateFlow } from "./UpdateFlow";

export const dynamic = "force-dynamic";

export default async function UpdatePage({
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
      <h1 className="mb-8 text-xl font-bold text-slate-900">緊急連絡先情報の更新</h1>
      <UpdateFlow token={token} shelters={(shelters as Shelter[]) ?? []} />
    </main>
  );
}
