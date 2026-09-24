-- 変更内容:
--   1. 一斉収集リンク（/form）の受付・停止を切り替える設定テーブル emg.settings を追加
--   2. 新規登録用の一度限りリンク（emg.registration_tokens）を追加
--   3. 回答レコードの削除をゴミ箱方式にする（households.deleted_at）
--      削除 → 復元 / 完全に削除
--   4. 登録・上書き処理を内部ヘルパー関数に集約し、既存の RPC をそれを使う形に再定義

-- =========================================================
-- 1. 受付設定（1行だけのテーブル）
-- =========================================================
create table if not exists emg.settings (
  id int primary key default 1 check (id = 1),
  form_open boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into emg.settings (id) values (1) on conflict (id) do nothing;

alter table emg.settings enable row level security;

-- 受付状態は /form（未ログイン）でも参照するため誰でも参照可。変更は set_form_open() 経由のみ。
drop policy if exists "emg_settings_select_all" on emg.settings;
create policy "emg_settings_select_all" on emg.settings
  for select using (true);

grant select on emg.settings to anon, authenticated;

-- =========================================================
-- 2. ゴミ箱（論理削除）
-- =========================================================
alter table emg.households add column if not exists deleted_at timestamptz;

create index if not exists emg_households_deleted_at_idx on emg.households (deleted_at);

-- =========================================================
-- 3. 新規登録用の一度限りリンク
-- =========================================================
create table if not exists emg.registration_tokens (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  -- 使用時に登録された回答レコード（完全削除されたら null になる）
  household_id uuid references emg.households(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table emg.registration_tokens enable row level security;

drop policy if exists "emg_registration_tokens_staff_select" on emg.registration_tokens;
create policy "emg_registration_tokens_staff_select" on emg.registration_tokens
  for select using (emg.is_staff());

grant select on emg.registration_tokens to authenticated;

-- =========================================================
-- 4. 内部ヘルパー関数
--    SECURITY INVOKER（既定）のため、直接呼ばれてもテーブルへの書き込み権限がなく失敗する。
--    さらに EXECUTE 権限も剥奪し、SECURITY DEFINER の RPC からのみ使う。
-- =========================================================

create or replace function emg._insert_members(p_household_id uuid, payload jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_item jsonb;
begin
  for v_item in select * from jsonb_array_elements(coalesce(payload->'cohabitants', '[]'::jsonb))
  loop
    insert into emg.cohabitants (household_id, name, name_kana, relationship, phone, is_jw, sort_order)
    values (
      p_household_id,
      v_item->>'name',
      v_item->>'nameKana',
      v_item->>'relationship',
      nullif(v_item->>'phone', ''),
      coalesce((v_item->>'isJw')::boolean, false),
      coalesce((v_item->>'sortOrder')::int, 0)
    );
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(payload->'emergencyContacts', '[]'::jsonb))
  loop
    insert into emg.emergency_contacts (household_id, name, name_kana, relationship, phones, is_jw, sort_order)
    values (
      p_household_id,
      v_item->>'name',
      v_item->>'nameKana',
      v_item->>'relationship',
      coalesce(v_item->'phones', '[]'::jsonb),
      coalesce((v_item->>'isJw')::boolean, false),
      coalesce((v_item->>'sortOrder')::int, 0)
    );
  end loop;
end;
$$;

create or replace function emg._insert_household(payload jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_household_id uuid;
begin
  insert into emg.households (
    name, name_kana, name_kana_romaji, address, phones, birthdate, shelter_id, consent_at
  ) values (
    payload->>'name',
    payload->>'nameKana',
    payload->>'nameKanaRomaji',
    payload->>'address',
    coalesce(payload->'phones', '[]'::jsonb),
    (payload->>'birthdate')::date,
    nullif(payload->>'shelterId', '')::uuid,
    now()
  )
  returning id into v_household_id;

  perform emg._insert_members(v_household_id, payload);

  return v_household_id;
end;
$$;

create or replace function emg._replace_household(p_household_id uuid, payload jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update emg.households set
    name = payload->>'name',
    name_kana = payload->>'nameKana',
    name_kana_romaji = payload->>'nameKanaRomaji',
    address = payload->>'address',
    phones = coalesce(payload->'phones', '[]'::jsonb),
    birthdate = (payload->>'birthdate')::date,
    shelter_id = nullif(payload->>'shelterId', '')::uuid,
    updated_at = now()
  where id = p_household_id;

  delete from emg.cohabitants where household_id = p_household_id;
  delete from emg.emergency_contacts where household_id = p_household_id;

  perform emg._insert_members(p_household_id, payload);
end;
$$;

revoke execute on function emg._insert_members(uuid, jsonb) from public, anon, authenticated;
revoke execute on function emg._insert_household(jsonb) from public, anon, authenticated;
revoke execute on function emg._replace_household(uuid, jsonb) from public, anon, authenticated;

-- =========================================================
-- 5. 公開 RPC（anon / authenticated）
-- =========================================================

-- 一斉収集リンクからの新規登録（受付停止中は拒否）
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

  return emg._insert_household(payload);
end;
$$;

-- 新規登録リンクの有効性チェック
create or replace function emg.verify_registration_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row emg.registration_tokens%rowtype;
begin
  select * into v_row from emg.registration_tokens where token = p_token;

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'not_found');
  elsif v_row.used_at is not null then
    return jsonb_build_object('valid', false, 'reason', 'used');
  elsif v_row.expires_at < now() then
    return jsonb_build_object('valid', false, 'reason', 'expired');
  end if;

  return jsonb_build_object('valid', true);
end;
$$;

-- 新規登録リンクからの登録（受付停止中でも有効。使用済みにする）
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

  v_household_id := emg._insert_household(payload);

  update emg.registration_tokens
    set used_at = now(), household_id = v_household_id
    where id = v_row.id;

  return jsonb_build_object('ok', true);
end;
$$;

-- 更新リンクの有効性チェック（削除済みの回答は無効扱い）
create or replace function emg.verify_update_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row emg.update_tokens%rowtype;
  v_household emg.households%rowtype;
begin
  select * into v_row from emg.update_tokens where token = p_token;

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'not_found');
  elsif v_row.used_at is not null then
    return jsonb_build_object('valid', false, 'reason', 'used');
  elsif v_row.locked_at is not null then
    return jsonb_build_object('valid', false, 'reason', 'locked');
  elsif v_row.expires_at < now() then
    return jsonb_build_object('valid', false, 'reason', 'expired');
  end if;

  select * into v_household from emg.households where id = v_row.household_id;
  if not found or v_household.deleted_at is not null then
    return jsonb_build_object('valid', false, 'reason', 'not_found');
  end if;

  return jsonb_build_object('valid', true, 'name', v_household.name);
end;
$$;

create or replace function emg.confirm_update_identity(p_token text, p_birthdate date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row emg.update_tokens%rowtype;
  v_household emg.households%rowtype;
  v_max_attempts constant int := 5;
  v_cohabitants jsonb;
  v_contacts jsonb;
begin
  select * into v_row from emg.update_tokens where token = p_token for update;

  if not found or v_row.used_at is not null or v_row.locked_at is not null or v_row.expires_at < now() then
    return jsonb_build_object('ok', false, 'reason', 'invalid_link');
  end if;

  select * into v_household from emg.households where id = v_row.household_id;
  if not found or v_household.deleted_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_link');
  end if;

  if v_household.birthdate = p_birthdate then
    update emg.update_tokens set verified_at = now(), attempt_count = 0
      where id = v_row.id;

    select coalesce(jsonb_agg(to_jsonb(c) order by c.sort_order), '[]'::jsonb) into v_cohabitants
      from emg.cohabitants c where c.household_id = v_household.id;
    select coalesce(jsonb_agg(to_jsonb(e) order by e.sort_order), '[]'::jsonb) into v_contacts
      from emg.emergency_contacts e where e.household_id = v_household.id;

    return jsonb_build_object(
      'ok', true,
      'household', jsonb_build_object(
        'id', v_household.id,
        'name', v_household.name,
        'nameKana', v_household.name_kana,
        'address', v_household.address,
        'phones', v_household.phones,
        'birthdate', v_household.birthdate,
        'shelterId', v_household.shelter_id
      ),
      'cohabitants', v_cohabitants,
      'emergencyContacts', v_contacts
    );
  else
    update emg.update_tokens
      set attempt_count = attempt_count + 1,
          locked_at = case when attempt_count + 1 >= v_max_attempts then now() else null end
      where id = v_row.id;
    return jsonb_build_object('ok', false, 'reason', 'mismatch');
  end if;
end;
$$;

create or replace function emg.submit_update(p_token text, payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row emg.update_tokens%rowtype;
begin
  select * into v_row from emg.update_tokens where token = p_token for update;

  if not found or v_row.used_at is not null or v_row.locked_at is not null or v_row.expires_at < now() then
    return jsonb_build_object('ok', false, 'reason', 'invalid_link');
  end if;
  if exists (
    select 1 from emg.households where id = v_row.household_id and deleted_at is not null
  ) then
    return jsonb_build_object('ok', false, 'reason', 'invalid_link');
  end if;
  if v_row.verified_at is null or v_row.verified_at < now() - interval '30 minutes' then
    return jsonb_build_object('ok', false, 'reason', 'not_verified');
  end if;
  if coalesce((payload->>'consent')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'reason', 'consent_required');
  end if;

  perform emg._replace_household(v_row.household_id, payload);

  update emg.update_tokens set used_at = now() where id = v_row.id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function emg.submit_registration(jsonb) from public;
revoke execute on function emg.verify_registration_token(text) from public;
revoke execute on function emg.submit_registration_with_token(text, jsonb) from public;
revoke execute on function emg.verify_update_token(text) from public;
revoke execute on function emg.confirm_update_identity(text, date) from public;
revoke execute on function emg.submit_update(text, jsonb) from public;

grant execute on function emg.submit_registration(jsonb) to anon, authenticated;
grant execute on function emg.verify_registration_token(text) to anon, authenticated;
grant execute on function emg.submit_registration_with_token(text, jsonb) to anon, authenticated;
grant execute on function emg.verify_update_token(text) to anon, authenticated;
grant execute on function emg.confirm_update_identity(text, date) to anon, authenticated;
grant execute on function emg.submit_update(text, jsonb) to anon, authenticated;

-- =========================================================
-- 6. 長老用 RPC（編集ロールのみ）
-- =========================================================

create or replace function emg.set_form_open(p_open boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not emg.is_editor() then
    raise exception 'forbidden';
  end if;

  update emg.settings set form_open = p_open, updated_at = now() where id = 1;
end;
$$;

create or replace function emg.issue_registration_token(p_days_valid int default 14)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
  v_expires_at timestamptz;
begin
  if not emg.is_editor() then
    raise exception 'forbidden';
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_expires_at := now() + make_interval(days => p_days_valid);

  insert into emg.registration_tokens (token, expires_at, created_by)
  values (v_token, v_expires_at, auth.uid());

  return jsonb_build_object('token', v_token, 'expiresAt', v_expires_at);
end;
$$;

create or replace function emg.admin_update_household(p_household_id uuid, payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not emg.is_editor() then
    raise exception 'forbidden';
  end if;

  perform emg._replace_household(p_household_id, payload);

  return jsonb_build_object('ok', true);
end;
$$;

-- ゴミ箱へ移動
create or replace function emg.delete_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not emg.is_editor() then
    raise exception 'forbidden';
  end if;

  update emg.households set deleted_at = now()
    where id = p_household_id and deleted_at is null;
end;
$$;

-- ゴミ箱から復元
create or replace function emg.restore_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not emg.is_editor() then
    raise exception 'forbidden';
  end if;

  update emg.households set deleted_at = null where id = p_household_id;
end;
$$;

-- 完全に削除（ゴミ箱にあるものだけ。同居人・緊急連絡先・更新リンクも連動して消える）
create or replace function emg.purge_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not emg.is_editor() then
    raise exception 'forbidden';
  end if;

  delete from emg.households where id = p_household_id and deleted_at is not null;
end;
$$;

revoke execute on function emg.set_form_open(boolean) from public;
revoke execute on function emg.issue_registration_token(int) from public;
revoke execute on function emg.admin_update_household(uuid, jsonb) from public;
revoke execute on function emg.delete_household(uuid) from public;
revoke execute on function emg.restore_household(uuid) from public;
revoke execute on function emg.purge_household(uuid) from public;

grant execute on function emg.set_form_open(boolean) to authenticated;
grant execute on function emg.issue_registration_token(int) to authenticated;
grant execute on function emg.admin_update_household(uuid, jsonb) to authenticated;
grant execute on function emg.delete_household(uuid) to authenticated;
grant execute on function emg.restore_household(uuid) to authenticated;
grant execute on function emg.purge_household(uuid) to authenticated;
