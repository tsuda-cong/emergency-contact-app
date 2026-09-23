-- 公開フォーム用 RPC（submit_registration / verify_update_token /
-- confirm_update_identity / submit_update）は、本来 anon（未ログインの回答者）
-- 向けに公開しているが、authenticated（担当者など）が呼んだ場合にも
-- 権限エラーにならないよう、authenticated にも実行権限を付与する。
--
-- これらの関数はロールで権限を制御しておらず、トークンや本人確認自体が
-- セキュリティ境界になっているため、authenticated からの呼び出しを許可しても
-- 安全性は変わらない。
--
-- 背景: 担当者が同じブラウザで管理画面にログインしたまま発行済みの更新リンクを
-- 開くと、Supabase クライアントはログインセッションの認証情報（authenticated）を
-- 優先して使うため、anon にしか許可していなかった関数の呼び出しが権限エラーになっていた。

grant execute on function emg.submit_registration(jsonb) to authenticated;
grant execute on function emg.verify_update_token(text) to authenticated;
grant execute on function emg.confirm_update_identity(text, text, date) to authenticated;
grant execute on function emg.submit_update(text, jsonb) to authenticated;
