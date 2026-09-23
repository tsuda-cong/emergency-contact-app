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
    .single();

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
