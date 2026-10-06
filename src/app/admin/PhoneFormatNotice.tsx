"use client";

import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/ConfirmButton";
import { createClient } from "@/lib/supabase/client";

export type PhoneFixes = {
  households: { id: string; phones: string[] }[];
  cohabitants: { id: string; phone: string }[];
  emergency_contacts: { id: string; phones: string[] }[];
};

// 書式がそろっていない登録済みの電話番号を、まとめてそろえる（編集ロールのみ）。
// 入力時には自動でそろうため、これは以前に登録された分を整えるためのもの。
export function PhoneFormatNotice({ count, fixes }: { count: number; fixes: PhoneFixes }) {
  const router = useRouter();

  async function handleConfirm() {
    const supabase = createClient();
    const { error } = await supabase.rpc("reformat_phones", { p_updates: fixes });
    if (error) {
      return "処理に失敗しました。";
    }
    router.refresh();
    return null;
  }

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <span>書式がそろっていない電話番号が {count} 件あります（例: 09012345678 → 090-1234-5678）。</span>
      <ConfirmButton
        label="書式をそろえる"
        message={`電話番号 ${count} 件の区切り（ハイフン）をそろえます。\n番号そのものや最終更新日時は変わりません。`}
        confirmLabel="そろえる"
        className="rounded-md border border-amber-300 bg-white px-3 py-1 text-sm text-amber-900 hover:bg-amber-100"
        onConfirm={handleConfirm}
      />
    </div>
  );
}
