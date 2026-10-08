-- 変更内容:
--   登録フォームの最初の画面で、氏名と生年月日だけを入力して登録済みかどうかを確認する RPC を追加。
--   すべて入力してから重複ではじかれる手間をなくし、本人が登録の有無を確かめられるようにする。
--   一斉収集リンク（p_token なし）は受付中の間だけ、新規登録リンクは有効なリンクを持つ人だけが使える。
--   登録済みかどうか以外の情報（登録内容など）は返さない。

create or replace function emg.check_registered(p_name text, p_birthdate date, p_token text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row emg.registration_tokens%rowtype;
begin
  if p_token is null then
    if not coalesce((select form_open from emg.settings where id = 1), false) then
      return jsonb_build_object('ok', false, 'reason', 'form_closed');
    end if;
  else
    select * into v_row from emg.registration_tokens where token = p_token;
    if not found or v_row.used_at is not null or v_row.expires_at < now() then
      return jsonb_build_object('ok', false, 'reason', 'invalid_link');
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'registered', emg._is_registered(jsonb_build_object('name', p_name, 'birthdate', p_birthdate))
  );
end;
$$;

revoke execute on function emg.check_registered(text, date, text) from public;
grant execute on function emg.check_registered(text, date, text) to anon, authenticated;
