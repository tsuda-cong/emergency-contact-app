-- 緊急連絡先の「住所」は不要と判断し、列と関連ロジックを削除する。

alter table emg.emergency_contacts drop column if exists address;

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
    insert into emg.emergency_contacts (household_id, name, name_kana, relationship, phones, is_jw, sort_order)
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

  return v_household_id;
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
    insert into emg.emergency_contacts (household_id, name, name_kana, relationship, phones, is_jw, sort_order)
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

  return jsonb_build_object('ok', true);
end;
$$;
