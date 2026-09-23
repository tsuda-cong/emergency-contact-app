-- 更新リンクは担当者が対象者ごとに個別発行するため、宛先の氏名は既知。
-- 本人確認画面では氏名を表示のみ（編集不可）にし、入力は生年月日のみとする。
--
-- 実質的な確認の強さは「トークン（推測不可能な64桁のランダム文字列）＋生年月日」になる
-- （従来は「トークン＋氏名＋生年月日」）。トークンは担当者から本人にのみ直接渡される
-- 前提であり、そこが本来のセキュリティ境界のため、実用上のリスクは変わらないと判断。

-- verify_update_token: 有効な場合は確認画面表示用の氏名も返す
create or replace function emg.verify_update_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row emg.update_tokens%rowtype;
  v_name text;
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

  select name into v_name from emg.households where id = v_row.household_id;

  return jsonb_build_object('valid', true, 'name', v_name);
end;
$$;

-- confirm_update_identity: 氏名パラメータを廃止し、生年月日のみで確認する
drop function if exists emg.confirm_update_identity(text, text, date);

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

grant execute on function emg.confirm_update_identity(text, date) to anon, authenticated;

-- 氏名の表記揺れ吸収用に追加した正規化関数は、氏名比較自体を廃止したため不要になった
drop function if exists emg.normalize_name(text);
