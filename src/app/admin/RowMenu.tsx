"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmButton";
import { createClient } from "@/lib/supabase/client";
import { IssuedLinkBox, issueLink } from "./IssueLinkButton";

const MENU_WIDTH = 176;
const itemClass = "block w-full px-3 py-2 text-left text-sm hover:bg-slate-100 disabled:opacity-60";

// 回答一覧の各行の操作メニュー（縦三点）
export function RowMenu({
  householdId,
  name,
  isEditor,
}: {
  householdId: string;
  name: string;
  isEditor: boolean;
}) {
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // 一覧の表は横スクロールの枠の中にあり、その中に置くと下の方の行でメニューが切れるため、
  // 画面に対する固定位置で表示する
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [issuedUrl, setIssuedUrl] = useState<string | null>(null);
  const [issueError, setIssueError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const open = position !== null;

  function toggle() {
    if (open) {
      setPosition(null);
      return;
    }
    const rect = buttonRef.current!.getBoundingClientRect();
    const menuHeight = isEditor ? 168 : 44;
    // 下に入りきらない場合は上に開く
    const top =
      rect.bottom + 4 + menuHeight > window.innerHeight ? rect.top - 4 - menuHeight : rect.bottom + 4;
    setPosition({ top, left: Math.max(8, rect.right - MENU_WIDTH) });
  }

  useEffect(() => {
    if (!open) return;
    function close(e: Event) {
      if (
        e.type === "mousedown" &&
        (menuRef.current?.contains(e.target as Node) || buttonRef.current?.contains(e.target as Node))
      ) {
        return;
      }
      setPosition(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPosition(null);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  async function handleIssue() {
    setIssuing(true);
    setIssueError(false);
    try {
      const url = await issueLink({ kind: "update", householdId });
      if (url) {
        setIssuedUrl(url);
      } else {
        setIssueError(true);
      }
    } finally {
      setIssuing(false);
      setPosition(null);
    }
  }

  async function handleDelete() {
    const supabase = createClient();
    const { error } = await supabase.rpc("delete_household", { p_household_id: householdId });
    if (error) {
      return "処理に失敗しました。";
    }
    router.refresh();
    return null;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-label="操作メニュー"
        aria-expanded={open}
        className={`rounded-md px-2 py-1 text-lg leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-900 ${
          open ? "bg-slate-100 text-slate-900" : ""
        }`}
      >
        ⋮
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
          className="fixed z-40 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          <Link href={`/admin/households/${householdId}`} className={`${itemClass} text-slate-800`}>
            詳細を見る
          </Link>
          {isEditor && (
            <>
              <Link href={`/admin/households/${householdId}/edit`} className={`${itemClass} text-slate-800`}>
                編集
              </Link>
              <button type="button" onClick={handleIssue} disabled={issuing} className={`${itemClass} text-slate-800`}>
                {issuing ? "発行中…" : "更新リンクを発行"}
              </button>
              <div className="my-1 border-t border-slate-100" />
              <button
                type="button"
                onClick={() => {
                  setPosition(null);
                  setConfirmDelete(true);
                }}
                className={`${itemClass} text-red-700 hover:bg-red-50`}
              >
                削除
              </button>
            </>
          )}
        </div>
      )}

      {issueError && <p className="text-xs text-red-600">リンクの発行に失敗しました。</p>}
      {issuedUrl && <IssuedLinkBox key={issuedUrl} url={issuedUrl} />}

      {confirmDelete && (
        <ConfirmDialog
          message={`「${name}」の回答を削除します。\n削除したものは「削除済み」から復元できます。`}
          confirmLabel="削除"
          danger
          onConfirm={handleDelete}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
