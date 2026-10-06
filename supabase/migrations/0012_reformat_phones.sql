-- 変更内容:
--   登録済みの電話番号の書式（ハイフンの有無・位置、スペース）をまとめてそろえる RPC を追加。
--   整形後の値は管理画面（アプリ側）で計算して渡す。DB側では、数字の並びが変わらない
--   （区切りだけが変わる）場合にだけ更新し、番号そのものが書き換わることを防ぐ。
--   書式の統一は内容の変更ではないため、updated_at（最終更新日時）は変えない。

-- 電話番号の配列（jsonb）から数字だけを順に取り出して連結する（比較用）
create or replace function emg._phone_digits(p_phones jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(string_agg(regexp_replace(e.value, '\D', '', 'g'), ',' order by e.ord), '')
  from jsonb_array_elements_text(coalesce(p_phones, '[]'::jsonb)) with ordinality as e(value, ord);
$$;

revoke execute on function emg._phone_digits(jsonb) from public, anon, authenticated;

-- p_updates: {
--   "households":         [{ "id": "...", "phones": ["090-...", ...] }],
--   "cohabitants":        [{ "id": "...", "phone": "090-..." }],
--   "emergency_contacts": [{ "id": "...", "phones": ["090-...", ...] }]
-- }
-- 戻り値: 更新した行数
create or replace function emg.reformat_phones(p_updates jsonb)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_count int := 0;
  v_rows int;
begin
  if not emg.is_editor() then
    raise exception 'forbidden';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_updates->'households', '[]'::jsonb))
  loop
    update emg.households set phones = v_item->'phones'
      where id = (v_item->>'id')::uuid
        and emg._phone_digits(phones) = emg._phone_digits(v_item->'phones');
    get diagnostics v_rows = row_count;
    v_count := v_count + v_rows;
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_updates->'cohabitants', '[]'::jsonb))
  loop
    update emg.cohabitants set phone = nullif(v_item->>'phone', '')
      where id = (v_item->>'id')::uuid
        and regexp_replace(coalesce(phone, ''), '\D', '', 'g')
          = regexp_replace(coalesce(v_item->>'phone', ''), '\D', '', 'g');
    get diagnostics v_rows = row_count;
    v_count := v_count + v_rows;
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_updates->'emergency_contacts', '[]'::jsonb))
  loop
    update emg.emergency_contacts set phones = v_item->'phones'
      where id = (v_item->>'id')::uuid
        and emg._phone_digits(phones) = emg._phone_digits(v_item->'phones');
    get diagnostics v_rows = row_count;
    v_count := v_count + v_rows;
  end loop;

  return v_count;
end;
$$;

revoke execute on function emg.reformat_phones(jsonb) from public;
grant execute on function emg.reformat_phones(jsonb) to authenticated;
