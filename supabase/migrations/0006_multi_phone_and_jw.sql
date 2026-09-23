-- 変更内容:
--   1. 電話番号を複数登録できるように、単一の phone(text) 列を
--      phones(jsonb 配列: [{ "label": "携帯", "number": "090-..." }, ...]) に置き換える
--      （households / cohabitants / emergency_contacts）
--   2. cohabitants / emergency_contacts に is_jw(boolean) 列を追加（JW チェックボックス用）
--
-- 既存データは phones 配列の1件目として移行する。

-- =========================================================
-- 1. households
-- =========================================================
alter table emg.households add column if not exists phones jsonb not null default '[]'::jsonb;

update emg.households
  set phones = jsonb_build_array(jsonb_build_object('label', '', 'number', phone))
  where phone is not null and phone <> '' and phones = '[]'::jsonb;

alter table emg.households drop column if exists phone;

-- =========================================================
-- 2. cohabitants
-- =========================================================
alter table emg.cohabitants add column if not exists phones jsonb not null default '[]'::jsonb;
alter table emg.cohabitants add column if not exists is_jw boolean not null default false;

update emg.cohabitants
  set phones = jsonb_build_array(jsonb_build_object('label', '', 'number', phone))
  where phone is not null and phone <> '' and phones = '[]'::jsonb;

alter table emg.cohabitants drop column if exists phone;

-- =========================================================
-- 3. emergency_contacts
-- =========================================================
alter table emg.emergency_contacts add column if not exists phones jsonb not null default '[]'::jsonb;
alter table emg.emergency_contacts add column if not exists is_jw boolean not null default false;

update emg.emergency_contacts
  set phones = jsonb_build_array(jsonb_build_object('label', '', 'number', phone))
  where phone is not null and phone <> '' and phones = '[]'::jsonb;

alter table emg.emergency_contacts drop column if exists phone;

-- =========================================================
-- 4. RPC 関数の再定義（phones jsonb 配列 / is_jw に対応）
-- =========================================================

create or replace function emg.submit_registration(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
  v_item jsonb;
begin
  if coalesce((payload->>'consent')::boolean, false) is not true then
    raise exception 'consent_required';
  end if;

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

  for v_item in select * from jsonb_array_elements(coalesce(payload->'cohabitants', '[]'::jsonb))
  loop
    insert into emg.cohabitants (household_id, name, name_kana, relationship, phones, is_jw, sort_order)
    values (
      v_household_id,
      v_item->>'name',
      v_item->>'nameKana',
      v_item->>'relationship',
      coalesce(v_item->'phones', '[]'::jsonb),
      coalesce((v_item->>'isJw')::boolean, false),
      coalesce((v_item->>'sortOrder')::int, 0)
    );
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(payload->'emergencyContacts', '[]'::jsonb))
  loop
    insert into emg.emergency_contacts (household_id, name, name_kana, relationship, address, phones, is_jw, sort_order)
    values (
      v_household_id,
      v_item->>'name',
      v_item->>'nameKana',
      v_item->>'relationship',
      v_item->>'address',
      coalesce(v_item->'phones', '[]'::jsonb),
      coalesce((v_item->>'isJw')::boolean, false),
      coalesce((v_item->>'sortOrder')::int, 0)
    );
  end loop;

  return v_household_id;
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
  v_item jsonb;
begin
  select * into v_row from emg.update_tokens where token = p_token for update;

  if not found or v_row.used_at is not null or v_row.locked_at is not null or v_row.expires_at < now() then
    return jsonb_build_object('ok', false, 'reason', 'invalid_link');
  end if;
  if v_row.verified_at is null or v_row.verified_at < now() - interval '30 minutes' then
    return jsonb_build_object('ok', false, 'reason', 'not_verified');
  end if;
  if coalesce((payload->>'consent')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'reason', 'consent_required');
  end if;

  update emg.households set
    name = payload->>'name',
    name_kana = payload->>'nameKana',
    name_kana_romaji = payload->>'nameKanaRomaji',
    address = payload->>'address',
    phones = coalesce(payload->'phones', '[]'::jsonb),
    birthdate = (payload->>'birthdate')::date,
    shelter_id = nullif(payload->>'shelterId', '')::uuid,
    updated_at = now()
  where id = v_row.household_id;

  delete from emg.cohabitants where household_id = v_row.household_id;
  delete from emg.emergency_contacts where household_id = v_row.household_id;

  for v_item in select * from jsonb_array_elements(coalesce(payload->'cohabitants', '[]'::jsonb))
  loop
    insert into emg.cohabitants (household_id, name, name_kana, relationship, phones, is_jw, sort_order)
    values (
      v_row.household_id,
      v_item->>'name',
      v_item->>'nameKana',
      v_item->>'relationship',
      coalesce(v_item->'phones', '[]'::jsonb),
      coalesce((v_item->>'isJw')::boolean, false),
      coalesce((v_item->>'sortOrder')::int, 0)
    );
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(payload->'emergencyContacts', '[]'::jsonb))
  loop
    insert into emg.emergency_contacts (household_id, name, name_kana, relationship, address, phones, is_jw, sort_order)
    values (
      v_row.household_id,
      v_item->>'name',
      v_item->>'nameKana',
      v_item->>'relationship',
      v_item->>'address',
      coalesce(v_item->'phones', '[]'::jsonb),
      coalesce((v_item->>'isJw')::boolean, false),
      coalesce((v_item->>'sortOrder')::int, 0)
    );
  end loop;

  update emg.update_tokens set used_at = now() where id = v_row.id;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function emg.admin_update_household(p_household_id uuid, payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
begin
  if not emg.is_editor() then
    raise exception 'forbidden';
  end if;

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

  for v_item in select * from jsonb_array_elements(coalesce(payload->'cohabitants', '[]'::jsonb))
  loop
    insert into emg.cohabitants (household_id, name, name_kana, relationship, phones, is_jw, sort_order)
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

  for v_item in select * from jsonb_array_elements(coalesce(payload->'emergencyContacts', '[]'::jsonb))
  loop
    insert into emg.emergency_contacts (household_id, name, name_kana, relationship, address, phones, is_jw, sort_order)
    values (
      p_household_id,
      v_item->>'name',
      v_item->>'nameKana',
      v_item->>'relationship',
      v_item->>'address',
      coalesce(v_item->'phones', '[]'::jsonb),
      coalesce((v_item->>'isJw')::boolean, false),
      coalesce((v_item->>'sortOrder')::int, 0)
    );
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;
