import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./SignOutButton";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // /admin/login はナビゲーションなしで表示する
    return <div className="min-h-screen bg-slate-50">{children}</div>;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role")
    .eq("id", user.id)
    .maybeSingle();

  // Supabase のログインアカウントは「奉仕報告管理」と共通のため、長老として登録されていない人も
  // ログイン自体はできてしまう。データは RLS で読めないが、空の画面ではなく権限がない旨を表示する。
  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50">
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="mb-3 text-lg font-bold text-slate-900">この画面を使う権限がありません</h1>
          <p className="mb-6 text-sm text-slate-600">
            {user.email} は、緊急連絡先の管理画面の利用者として登録されていません。
            <br />
            利用が必要な場合は書記にご連絡ください。
          </p>
          <SignOutButton />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/admin" className="text-sm font-bold text-slate-900">
            緊急連絡先 管理画面
          </Link>
          <div className="flex items-center gap-4 text-sm text-slate-600">
            <span>
              {profile?.display_name ?? user.email}（
              {profile?.role === "editor" ? "編集ロール" : "閲覧ロール"}）
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 print:max-w-none print:px-0 print:py-0">
        {children}
      </main>
    </div>
  );
}
