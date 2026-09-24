import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, formatPhones } from "@/lib/format";
import type { CohabitantRow, EmergencyContactRow, HouseholdRow, Shelter } from "@/lib/types";
import { TrashActionButton } from "../../TrashActions";

export const dynamic = "force-dynamic";

export default async function HouseholdDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: household }, { data: cohabitants }, { data: contacts }, { data: shelters }, { data: user }] =
    await Promise.all([
      supabase.from("households").select("*").eq("id", id).single(),
      supabase.from("cohabitants").select("*").eq("household_id", id).order("sort_order"),
      supabase.from("emergency_contacts").select("*").eq("household_id", id).order("sort_order"),
      supabase.from("shelters").select("id, name"),
      supabase.auth.getUser(),
    ]);

  if (!household) {
    notFound();
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.user!.id)
    .single();
  const isEditor = profile?.role === "editor";

  const h = household as HouseholdRow;
  const shelterName = (shelters as Shelter[] | null)?.find((s) => s.id === h.shelter_id)?.name;

  const isDeleted = h.deleted_at !== null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={isDeleted ? "/admin/trash" : "/admin"}
          className="text-sm text-blue-700 hover:underline"
        >
          {isDeleted ? "← 削除済み一覧に戻る" : "← 一覧に戻る"}
        </Link>
        {isEditor && (
          <div className="flex items-center gap-2">
            {isDeleted ? (
              <>
                <TrashActionButton action="restore" householdId={id} name={h.name} />
                <TrashActionButton
                  action="purge"
                  householdId={id}
                  name={h.name}
                  redirectTo="/admin/trash"
                />
              </>
            ) : (
              <>
                <Link
                  href={`/admin/households/${id}/edit`}
                  className="rounded-md bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
                >
                  編集
                </Link>
                <TrashActionButton
                  action="delete"
                  householdId={id}
                  name={h.name}
                  redirectTo="/admin"
                />
              </>
            )}
          </div>
        )}
      </div>

      {isDeleted && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          この回答は削除済みです（{formatDateTime(h.deleted_at)}）。一覧・PDFには表示されません。
        </div>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-slate-900">本人情報</h2>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="氏名" value={h.name} />
          <Field label="ふりがな" value={h.name_kana} />
          <Field label="住所" value={h.address} />
          <Field label="電話番号" value={formatPhones(h.phones)} />
          <Field label="生年月日" value={formatDate(h.birthdate)} />
          <Field label="指定避難場所" value={shelterName ?? "未選択"} />
          <Field label="回答日時" value={formatDateTime(h.created_at)} />
          <Field label="最終更新日時" value={formatDateTime(h.updated_at)} />
        </dl>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-slate-900">
          同居人情報（{cohabitants?.length ?? 0}人）
        </h2>
        {(cohabitants as CohabitantRow[] | null)?.length ? (
          <ul className="space-y-3">
            {(cohabitants as CohabitantRow[]).map((c) => (
              <li key={c.id} className="rounded-md border border-slate-200 p-3">
                <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Field label="氏名" value={c.name} />
                  <Field label="ふりがな" value={c.name_kana} />
                  <Field label="続柄" value={c.relationship} />
                  <Field label="電話番号" value={c.phone || "（本人と同じ）"} />
                  <Field label="JW" value={c.is_jw ? "はい" : "いいえ"} />
                </dl>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">登録なし</p>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-slate-900">
          緊急連絡先情報（{contacts?.length ?? 0}件）
        </h2>
        {(contacts as EmergencyContactRow[] | null)?.length ? (
          <ul className="space-y-3">
            {(contacts as EmergencyContactRow[]).map((c) => (
              <li key={c.id} className="rounded-md border border-slate-200 p-3">
                <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Field label="氏名" value={c.name} />
                  <Field label="ふりがな" value={c.name_kana} />
                  <Field label="続柄" value={c.relationship} />
                  <Field label="電話番号" value={formatPhones(c.phones)} />
                  <Field label="JW" value={c.is_jw ? "はい" : "いいえ"} />
                </dl>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">登録なし</p>
        )}
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-900">{value}</dd>
    </div>
  );
}
