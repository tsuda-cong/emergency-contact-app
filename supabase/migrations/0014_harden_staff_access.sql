-- 変更内容（セキュリティ点検での指摘への対応）:
--   1. 新しいログインアカウントを自動で閲覧ロール（emg.profiles）に登録するトリガーを廃止する。
--      Supabase のログインアカウントは「奉仕報告管理」と共通のため、奉仕報告管理の利用者を
--      追加しただけで緊急連絡先の閲覧権限まで付いてしまっていた。また新規登録や匿名ログインが
--      オンになると、外部の人が自分でアカウントを作って全データを読めてしまう。
--      長老の登録は、今後も SQL で1人ずつ明示的に行う。
--   2. 更新リンク・新規登録リンクの合言葉（トークン）の表を、長老も直接読めないようにする。
--      閲覧ロールが他人の更新リンクを使って内容を書き換えられてしまうのを防ぐ。
--      アプリはこれらの表を直接読まず、発行・利用はすべて SECURITY DEFINER の関数経由のため、
--      画面の動きは変わらない。

-- 1. 自動登録トリガーの廃止
drop trigger if exists emg_on_auth_user_created on auth.users;
drop function if exists emg.handle_new_user();

-- 2. トークンの表の参照を禁止する（RLS のポリシーと、表への参照権限の両方を外す）
drop policy if exists "emg_update_tokens_staff_select" on emg.update_tokens;
drop policy if exists "emg_registration_tokens_staff_select" on emg.registration_tokens;

revoke all on emg.update_tokens from anon, authenticated;
revoke all on emg.registration_tokens from anon, authenticated;
