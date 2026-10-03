-- 変更内容:
--   PDF出力のタイトル行に表示する巡回区・巡回監督の連絡先を保存するテーブルを追加。
--   電話番号・メールアドレスを含むため、未ログイン（anon）でも読める emg.settings とは分け、
--   長老（is_staff）だけが参照できるようにする。変更は set_circuit_info() 経由（編集ロールのみ）。

create table if not exists emg.circuit_info (
  id int primary key default 1 check (id = 1),
  circuit_name text not null default '',
  overseer_name text not null default '',
  overseer_phone text not null default '',
  overseer_email text not null default '',
  updated_at timestamptz not null default now()
);

insert into emg.circuit_info (id) values (1) on conflict (id) do nothing;

alter table emg.circuit_info enable row level security;

drop policy if exists "emg_circuit_info_staff_select" on emg.circuit_info;
create policy "emg_circuit_info_staff_select" on emg.circuit_info
  for select using (emg.is_staff());

grant select on emg.circuit_info to authenticated;

create or replace function emg.set_circuit_info(
  p_circuit_name text,
  p_overseer_name text,
  p_overseer_phone text,
  p_overseer_email text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not emg.is_editor() then
    raise exception 'forbidden';
  end if;

  update emg.circuit_info set
    circuit_name = coalesce(trim(p_circuit_name), ''),
    overseer_name = coalesce(trim(p_overseer_name), ''),
    overseer_phone = coalesce(trim(p_overseer_phone), ''),
    overseer_email = coalesce(trim(p_overseer_email), ''),
    updated_at = now()
  where id = 1;
end;
$$;

revoke execute on function emg.set_circuit_info(text, text, text, text) from public;
grant execute on function emg.set_circuit_info(text, text, text, text) to authenticated;
