-- 本人確認時の氏名比較で、全角/半角スペースの有無の表記揺れを吸収する。
-- 異体字・旧字体の違いは意図的に吸収しない（別人と誤認識するリスクを避けるため）。

create or replace function emg.normalize_name(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace(replace(trim(p_name), ' ', ''), '　', '');
$$;

create or replace function emg.confirm_update_identity(p_token text, p_name text, p_birthdate date)
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

  if emg.normalize_name(v_household.name) = emg.normalize_name(p_name)
     and v_household.birthdate = p_birthdate then
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
        'phone', v_household.phone,
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
