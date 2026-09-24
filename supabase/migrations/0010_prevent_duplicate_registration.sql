-- 変更内容:
--   新規登録（一斉収集リンク・新規登録リンクの両方）で、氏名と生年月日が
--   既存の回答（削除済みを除く）と一致する場合は登録せず 'already_registered' を返す。
--   公開フォームからの上書きは許可しない（内容の変更は長老が発行する更新リンクで行う）。

-- 氏名比較用の正規化: 全角・半角の違い（NFKC）とスペースの有無を吸収する。
-- 異体字・旧字体（斉藤／齋藤など）は意図的に吸収しない（別人と誤認識するリスクを避けるため）。
create or replace function emg.normalize_name(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace(normalize(coalesce(p_name, ''), NFKC), ' ', '');
$$;

create or replace function emg._is_registered(payload jsonb)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from emg.households
    where deleted_at is null
      and birthdate = (payload->>'birthdate')::date
      and emg.normalize_name(name) = emg.normalize_name(payload->>'name')
  );
$$;

revoke execute on function emg.normalize_name(text) from public, anon, authenticated;
revoke execute on function emg._is_registered(jsonb) from public, anon, authenticated;

create or replace function emg.submit_registration(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce((select form_open from emg.settings where id = 1), false) then
    raise exception 'form_closed';
  end if;
  if coalesce((payload->>'consent')::boolean, false) is not true then
    raise exception 'consent_required';
  end if;
  if emg._is_registered(payload) then
    raise exception 'already_registered';
  end if;

  return emg._insert_household(payload);
end;
$$;

create or replace function emg.submit_registration_with_token(p_token text, payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row emg.registration_tokens%rowtype;
  v_household_id uuid;
begin
  select * into v_row from emg.registration_tokens where token = p_token for update;

  if not found or v_row.used_at is not null or v_row.expires_at < now() then
    return jsonb_build_object('ok', false, 'reason', 'invalid_link');
  end if;
  if coalesce((payload->>'consent')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'reason', 'consent_required');
  end if;
  -- 重複時はリンクを使用済みにしない（長老が状況を確認できるように）
  if emg._is_registered(payload) then
    return jsonb_build_object('ok', false, 'reason', 'already_registered');
  end if;

  v_household_id := emg._insert_household(payload);

  update emg.registration_tokens
    set used_at = now(), household_id = v_household_id
    where id = v_row.id;

  return jsonb_build_object('ok', true);
end;
$$;
