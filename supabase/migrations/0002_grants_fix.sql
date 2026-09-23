-- 0001 で GRANT が不足していた点の修正。
--
-- Postgres では RLS ポリシーとは別に、テーブルへの基本的な操作権限（GRANT）が
-- 必要です。public スキーマでは Supabase がデフォルトで anon/authenticated に
-- 権限を付与していますが、新規スキーマ（emg）ではその自動付与が効かないため、
-- 明示的に GRANT する必要があります。
--
-- Supabase の SQL Editor でこのファイルの内容を実行してください。

-- shelters は回答フォームのプルダウン用に anon からも参照する
grant select on emg.shelters to anon, authenticated;

-- households 以下は担当者（authenticated）のみが直接 SELECT する
-- （anon からの読み書きは SECURITY DEFINER 関数経由のみで、直接のテーブルアクセスはない）
grant select on emg.households to authenticated;
grant select on emg.cohabitants to authenticated;
grant select on emg.emergency_contacts to authenticated;
grant select on emg.update_tokens to authenticated;
grant select on emg.profiles to authenticated;
