"use client";

import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/ConfirmButton";
import { createClient } from "@/lib/supabase/client";

type Action = "delete" | "restore" | "purge";

const RPC: Record<Action, string> = {
  delete: "delete_household",
  restore: "restore_household",
  purge: "purge_household",
};

const LABEL: Record<Action, string> = {
  delete: "削除",
  restore: "復元",
  purge: "完全に削除",
};

function confirmMessage(action: Action, name: string): string {
  switch (action) {
    case "delete":
      return `「${name}」の回答を削除します。\n削除したものは「削除済み」から復元できます。`;
    case "restore":
      return `「${name}」の回答を復元します。`;
    case "purge":
      return `「${name}」の回答を完全に削除します。\nこの操作は元に戻せません。`;
  }
}

// 削除・復元・完全削除のボタン。完了後は redirectTo へ移動する（未指定なら画面を再読み込み）。
export function TrashActionButton({
  action,
  householdId,
  name,
  redirectTo,
}: {
  action: Action;
  householdId: string;
  name: string;
  redirectTo?: string;
}) {
  const router = useRouter();

  async function handleConfirm() {
    const supabase = createClient();
    const { error } = await supabase.rpc(RPC[action], { p_household_id: householdId });
    if (error) {
      return "処理に失敗しました。";
    }
    if (redirectTo) {
      router.push(redirectTo);
    }
    router.refresh();
    return null;
  }

  const className =
    action === "restore"
      ? "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
      : "rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50";

  return (
    <ConfirmButton
      label={LABEL[action]}
      message={confirmMessage(action, name)}
      confirmLabel={LABEL[action]}
      danger={action !== "restore"}
      className={className}
      onConfirm={handleConfirm}
    />
  );
}
