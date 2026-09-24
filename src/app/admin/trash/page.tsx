import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime } from "@/lib/format";
import { TrashActionButton } from "../TrashActions";

export const dynamic = "force-dynamic";

type TrashRow = {
  id: string;
  name: string;
  name_kana: string;
  birthdate: string;
  deleted_at: string;
};

export default async function AdminTrashPage() {
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
    redirect("/admin");
  }

  const { data, error } = await supabase
    .from("households")
    .select("id, name, name_kana, birthdate, deleted_at")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  const households = (data as TrashRow[] | null) ?? [];

  return (
    <div>
      <Link href="/admin" className="text-sm text-blue-700 hover:underline">
        ← 一覧に戻る
      </Link>
      <h1 className="mb-2 mt-4 text-lg font-bold text-slate-900">削除済み（{households.length}件）</h1>
      <p className="mb-6 text-sm text-slate-600">
        削除した回答は、ここから復元できます。「完全に削除」すると元に戻せません。
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          読み込みに失敗しました: {error.message}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
            <tr>
              <th className="px-4 py-2">氏名／ふりがな</th>
              <th className="px-4 py-2">生年月日</th>
              <th className="px-4 py-2">削除日時</th>
              <th className="px-4 py-2">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {households.map((h) => (
              <tr key={h.id}>
                <td className="px-4 py-3">
                  <Link href={`/admin/households/${h.id}`} className="font-medium text-blue-700 hover:underline">
                    {h.name}
                  </Link>
                  <div className="text-xs text-slate-500">{h.name_kana}</div>
                </td>
                <td className="px-4 py-3 text-slate-700">{formatDate(h.birthdate)}</td>
                <td className="px-4 py-3 text-slate-700">{formatDateTime(h.deleted_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <TrashActionButton action="restore" householdId={h.id} name={h.name} />
                    <TrashActionButton action="purge" householdId={h.id} name={h.name} />
                  </div>
                </td>
              </tr>
            ))}
            {households.length === 0 && !error && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  削除済みの回答はありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
