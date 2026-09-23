import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 text-center">
      <h1 className="mb-6 text-xl font-bold text-slate-900">緊急連絡先管理</h1>
      <div className="space-y-3">
        <Link
          href="/form"
          className="block rounded-md bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
        >
          緊急連絡先情報を登録する
        </Link>
        <Link
          href="/admin/login"
          className="block rounded-md border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          長老ログイン
        </Link>
      </div>
    </main>
  );
}
