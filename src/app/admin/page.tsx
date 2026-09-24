import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, formatPhones, maskAddress } from "@/lib/format";
import { FormOpenToggle } from "./FormOpenToggle";
import { IssueLinkButton } from "./IssueLinkButton";

export const dynamic = "force-dynamic";

type SortKey = "romaji" | "created" | "updated";

const SORT_LABELS: Record<SortKey, string> = {
  romaji: "ふりがな順",
  created: "回答日時順",
  updated: "更新日時順",
};

type HouseholdListRow = {
  id: string;
  name: string;
  name_kana: string;
  birthdate: string;
  address: string;
  phones: string[];
  created_at: string;
  updated_at: string;
  cohabitants: { count: number }[];
  emergency_contacts: { count: number }[];
};

export default async function AdminHouseholdsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const { q = "", sort: sortParam } = await searchParams;
  const sort: SortKey = sortParam === "created" || sortParam === "updated" ? sortParam : "romaji";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();
  const isEditor = profile?.role === "editor";

  const [{ data: settings }, { count: trashCount }] = await Promise.all([
    supabase.from("settings").select("form_open").eq("id", 1).maybeSingle(),
    supabase
      .from("households")
      .select("id", { count: "exact", head: true })
      .not("deleted_at", "is", null),
  ]);

  let query = supabase
    .from("households")
    .select(
      "id, name, name_kana, birthdate, address, phones, created_at, updated_at, cohabitants(count), emergency_contacts(count)"
    )
    .is("deleted_at", null);

  if (q.trim()) {
    query = query.ilike("name", `%${q.trim()}%`);
  }

  if (sort === "created") {
    query = query.order("created_at", { ascending: false });
  } else if (sort === "updated") {
    query = query.order("updated_at", { ascending: false });
  } else {
    query = query.order("name_kana_romaji", { ascending: true });
  }

  const { data, error } = await query;
  const households = (data as HouseholdListRow[] | null) ?? [];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <FormOpenToggle formOpen={settings?.form_open ?? false} isEditor={isEditor} />
        {isEditor && <IssueLinkButton kind="register" />}
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-lg font-bold text-slate-900">回答一覧（{households.length}件）</h1>
        <div className="flex flex-wrap items-center gap-3">
          {isEditor && (
            <Link href="/admin/trash" className="text-sm text-slate-600 hover:underline">
              削除済み（{trashCount ?? 0}件）
            </Link>
          )}
          <Link
            href="/admin/print"
            target="_blank"
            className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            PDF出力（印刷用ビュー）
          </Link>
        </div>
      </div>

      <form className="mb-4 flex flex-wrap items-center gap-3" method="get">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="氏名で検索"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
        <input type="hidden" name="sort" value={sort} />
        <button type="submit" className="rounded-md bg-slate-800 px-3 py-1.5 text-sm text-white">
          検索
        </button>
        <div className="ml-auto flex gap-2 text-sm">
          {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
            <Link
              key={key}
              href={`/admin?${new URLSearchParams({ q, sort: key }).toString()}`}
              className={`rounded-md px-3 py-1.5 ${
                sort === key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {SORT_LABELS[key]}
            </Link>
          ))}
        </div>
      </form>

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
              <th className="px-4 py-2">回答日時</th>
              <th className="px-4 py-2">最終更新日時</th>
              <th className="px-4 py-2">住所・電話番号</th>
              <th className="px-4 py-2">同居人／緊急連絡先</th>
              <th className="px-4 py-2">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {households.map((h) => (
              <tr key={h.id}>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{h.name}</div>
                  <div className="text-xs text-slate-500">{h.name_kana}</div>
                </td>
                <td className="px-4 py-3 text-slate-700">{formatDate(h.birthdate)}</td>
                <td className="px-4 py-3 text-slate-700">{formatDateTime(h.created_at)}</td>
                <td className="px-4 py-3 text-slate-700">{formatDateTime(h.updated_at)}</td>
                <td className="px-4 py-3 text-slate-700">
                  <div>{maskAddress(h.address)}</div>
                  <div className="text-xs text-slate-500">{formatPhones(h.phones)}</div>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {h.cohabitants?.[0]?.count ?? 0}人 ／ {h.emergency_contacts?.[0]?.count ?? 0}件
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-2">
                    <Link href={`/admin/households/${h.id}`} className="text-sm text-blue-700 hover:underline">
                      詳細を見る
                    </Link>
                    {isEditor && (
                      <>
                        <Link
                          href={`/admin/households/${h.id}/edit`}
                          className="text-sm text-blue-700 hover:underline"
                        >
                          編集
                        </Link>
                        <IssueLinkButton kind="update" householdId={h.id} />
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {households.length === 0 && !error && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  該当する回答がありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
