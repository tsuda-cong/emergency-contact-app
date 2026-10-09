-- 変更内容（セキュリティ点検での指摘への対応）:
--   入力の文字数と人数に上限を設ける。一斉収集リンクは誰でも送信できるため、
--   極端に長い文字や大量の同居人などを送り込まれるのを DB 側で防ぐ（フォーム側の制限は
--   回避できるため、DB の制約を本当の守りとする）。上限は実データより十分大きくしている。
--     氏名 30 / ふりがな 60 / ローマ字（並べ替え用） 200 / 住所 100 / 続柄 20 / 電話1件 20 文字
--     同居人・緊急連絡先は、それぞれ1世帯10人まで

-- 電話番号の配列（jsonb）が、文字列だけで各20文字以内か
create or replace function emg._phones_within_limit(p_phones jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p_phones) = 'array'
    and not exists (
      select 1 from jsonb_array_elements(p_phones) as e(value)
      where jsonb_typeof(e.value) <> 'string' or char_length(e.value #>> '{}') > 20
    );
$$;

revoke execute on function emg._phones_within_limit(jsonb) from public, anon, authenticated;

alter table emg.households
  add constraint households_name_len check (char_length(name) <= 30),
  add constraint households_name_kana_len check (char_length(name_kana) <= 60),
  add constraint households_name_kana_romaji_len check (char_length(name_kana_romaji) <= 200),
  add constraint households_address_len check (char_length(address) <= 100),
  add constraint households_phones_len check (emg._phones_within_limit(phones));

alter table emg.cohabitants
  add constraint cohabitants_name_len check (char_length(name) <= 30),
  add constraint cohabitants_name_kana_len check (char_length(name_kana) <= 60),
  add constraint cohabitants_relationship_len check (char_length(relationship) <= 20),
  add constraint cohabitants_phone_len check (phone is null or char_length(phone) <= 20);

alter table emg.emergency_contacts
  add constraint emergency_contacts_name_len check (char_length(name) <= 30),
  add constraint emergency_contacts_name_kana_len check (char_length(name_kana) <= 60),
  add constraint emergency_contacts_relationship_len check (char_length(relationship) <= 20),
  add constraint emergency_contacts_phones_len check (emg._phones_within_limit(phones));

-- 同居人・緊急連絡先の人数の上限（登録・更新・代理編集のすべてがこの関数を通る）
create or replace function emg._insert_members(p_household_id uuid, payload jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_item jsonb;
begin
  if jsonb_array_length(coalesce(payload->'cohabitants', '[]'::jsonb)) > 10
     or jsonb_array_length(coalesce(payload->'emergencyContacts', '[]'::jsonb)) > 10 then
    raise exception 'too_many_members';
  end if;

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

revoke execute on function emg._insert_members(uuid, jsonb) from public, anon, authenticated;
