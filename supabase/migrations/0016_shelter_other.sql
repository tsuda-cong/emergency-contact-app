-- 変更内容:
--   指定避難場所がリストにない場合に、自由記述できるようにする（households.shelter_other）。
--   リストから選んだ場合は shelter_id、「その他」を選んだ場合は shelter_other に入れ、
--   両方が同時に入らないようにする。自由記述は50文字まで。

alter table emg.households add column if not exists shelter_other text;

alter table emg.households
  add constraint households_shelter_other_len check (char_length(shelter_other) <= 50);

create or replace function emg._insert_household(payload jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_household_id uuid;
begin
  insert into emg.households (
    name, name_kana, name_kana_romaji, address, phones, birthdate, shelter_id, shelter_other, consent_at
  ) values (
    payload->>'name',
    payload->>'nameKana',
    payload->>'nameKanaRomaji',
    payload->>'address',
    coalesce(payload->'phones', '[]'::jsonb),
    (payload->>'birthdate')::date,
    nullif(payload->>'shelterId', '')::uuid,
    emg._shelter_other(payload),
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
    shelter_other = emg._shelter_other(payload),
    updated_at = now()
  where id = p_household_id;

  delete from emg.cohabitants where household_id = p_household_id;
  delete from emg.emergency_contacts where household_id = p_household_id;

  perform emg._insert_members(p_household_id, payload);
end;
$$;

-- 自由記述の指定避難場所。リストから選んでいる場合は入れない
create or replace function emg._shelter_other(payload jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when nullif(payload->>'shelterId', '') is null then nullif(trim(payload->>'shelterOther'), '')
  end;
$$;

revoke execute on function emg._shelter_other(jsonb) from public, anon, authenticated;
revoke execute on function emg._insert_household(jsonb) from public, anon, authenticated;
revoke execute on function emg._replace_household(uuid, jsonb) from public, anon, authenticated;

-- 更新リンクの本人確認後に返す登録内容にも、自由記述を含める
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
        'shelterId', v_household.shelter_id,
        'shelterOther', v_household.shelter_other
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

revoke execute on function emg.confirm_update_identity(text, date) from public;
grant execute on function emg.confirm_update_identity(text, date) to anon, authenticated;
