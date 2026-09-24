-- 緊急連絡先管理アプリ 初期スキーマ
--
-- このアプリは「奉仕報告管理」など既存のアプリと同じ Supabase プロジェクトに
-- 同居させる想定のため、専用スキーマ `emg` の中にすべてのテーブル・関数を作成する。
-- 既存アプリの public スキーマには一切変更を加えない。
--
-- 新規にセットアップする場合は、このファイルだけを実行すれば最新の構成になる
-- （0002 以降は既存環境を更新するための差分）。
--
-- Supabase の SQL Editor でこのファイルの内容をそのまま実行してください。
-- 実行後、Supabase ダッシュボードの
--   Project Settings > Data API > Exposed schemas
-- に "emg" を追加して保存する必要がある（PostgREST 経由でアクセス可能にするため）。

create schema if not exists emg;

-- =========================================================
-- テーブル定義
-- =========================================================

create table if not exists emg.shelters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists emg.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_kana text not null,
  name_kana_romaji text not null,
  address text not null,
  -- 電話番号は最大2件まで。jsonb 配列（プレーンな文字列の配列）で保持する: ["090-...", "072-..."]
  phones jsonb not null default '[]'::jsonb,
  birthdate date not null,
  shelter_id uuid references emg.shelters(id) on delete set null,
  consent_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- ゴミ箱（論理削除）。null 以外なら削除済み
  deleted_at timestamptz,
  constraint households_phones_max2 check (jsonb_array_length(phones) <= 2)
);

create table if not exists emg.cohabitants (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references emg.households(id) on delete cascade,
  name text not null,
  name_kana text not null,
  relationship text not null,
  phone text,
  is_jw boolean not null default false,
  sort_order int not null default 0
);

create table if not exists emg.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references emg.households(id) on delete cascade,
  name text not null,
  name_kana text not null,
  relationship text not null,
  -- 電話番号は最大2件まで。jsonb 配列（プレーンな文字列の配列）で保持する
  phones jsonb not null default '[]'::jsonb,
  is_jw boolean not null default false,
  sort_order int not null default 0,
  constraint emergency_contacts_phones_max2 check (jsonb_array_length(phones) <= 2)
);

create table if not exists emg.update_tokens (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references emg.households(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  verified_at timestamptz,
  attempt_count int not null default 0,
  locked_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- 新規登録用の一度限りリンク
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

-- 受付設定（1行だけのテーブル）。form_open が false の間は一斉収集リンク（/form）を停止する
create table if not exists emg.settings (
  id int primary key default 1 check (id = 1),
  form_open boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into emg.settings (id) values (1) on conflict (id) do nothing;

-- このアプリ専用の担当者ロール。既存アプリの権限テーブルとは独立している。
create table if not exists emg.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'viewer' check (role in ('editor', 'viewer')),
  created_at timestamptz not null default now()
);

create index if not exists emg_households_name_kana_romaji_idx on emg.households (name_kana_romaji);
create index if not exists emg_households_created_at_idx on emg.households (created_at);
create index if not exists emg_households_updated_at_idx on emg.households (updated_at);
create index if not exists emg_households_deleted_at_idx on emg.households (deleted_at);
create index if not exists emg_cohabitants_household_id_idx on emg.cohabitants (household_id);
create index if not exists emg_emergency_contacts_household_id_idx on emg.emergency_contacts (household_id);
create index if not exists emg_update_tokens_household_id_idx on emg.update_tokens (household_id);

-- =========================================================
-- ロール判定ヘルパー関数
-- SECURITY DEFINER + search_path='' で固定し、テーブル参照は全てスキーマ修飾する
-- （search_path 汚染を避けるためのセキュリティ上の定石）。
-- =========================================================

create or replace function emg.is_staff()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from emg.profiles where id = auth.uid()
  );
$$;

create or replace function emg.is_editor()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from emg.profiles where id = auth.uid() and role = 'editor'
  );
$$;

revoke execute on function emg.is_staff() from public;
revoke execute on function emg.is_editor() from public;
grant execute on function emg.is_staff() to authenticated;
grant execute on function emg.is_editor() to authenticated;

-- =========================================================
-- 新規 Auth ユーザー作成時に emg.profiles を自動生成（既定ロール: viewer）
--
-- 注意: auth.users は Supabase プロジェクト全体で共有されるテーブルのため、
-- トリガー名・関数名は既存アプリ（例: 奉仕報告管理）のものと衝突しないよう
-- emg_ プレフィックスを付けている。既存アプリのトリガーには触れない。
--
-- 既にこのプロジェクトに登録済みの既存ユーザーにはこのトリガーは発火しない。
-- 既存メンバーを担当者にする場合は、本ファイル末尾のコメントを参照して
-- 手動で emg.profiles に行を追加すること。
-- =========================================================

create or replace function emg.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into emg.profiles (id, display_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email), 'viewer')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists emg_on_auth_user_created on auth.users;
create trigger emg_on_auth_user_created
  after insert on auth.users
  for each row execute procedure emg.handle_new_user();

-- =========================================================
-- Row Level Security
-- =========================================================

alter table emg.shelters enable row level security;
alter table emg.households enable row level security;
alter table emg.cohabitants enable row level security;
alter table emg.emergency_contacts enable row level security;
alter table emg.update_tokens enable row level security;
alter table emg.registration_tokens enable row level security;
alter table emg.settings enable row level security;
alter table emg.profiles enable row level security;

-- shelters: 誰でも参照可（フォームのプルダウン用）
drop policy if exists "emg_shelters_select_all" on emg.shelters;
create policy "emg_shelters_select_all" on emg.shelters
  for select using (true);

-- settings: 受付状態は /form（未ログイン）でも参照するため誰でも参照可。変更は set_form_open() 経由のみ
drop policy if exists "emg_settings_select_all" on emg.settings;
create policy "emg_settings_select_all" on emg.settings
  for select using (true);

-- households / cohabitants / emergency_contacts / update_tokens / registration_tokens:
--   通常の insert/update/delete は許可しない。書き込みは全て SECURITY DEFINER 関数経由。
--   参照は担当者（editor/viewer 共通）のみ。
drop policy if exists "emg_households_staff_select" on emg.households;
create policy "emg_households_staff_select" on emg.households
  for select using (emg.is_staff());

drop policy if exists "emg_cohabitants_staff_select" on emg.cohabitants;
create policy "emg_cohabitants_staff_select" on emg.cohabitants
  for select using (emg.is_staff());

drop policy if exists "emg_emergency_contacts_staff_select" on emg.emergency_contacts;
create policy "emg_emergency_contacts_staff_select" on emg.emergency_contacts
  for select using (emg.is_staff());

drop policy if exists "emg_update_tokens_staff_select" on emg.update_tokens;
create policy "emg_update_tokens_staff_select" on emg.update_tokens
  for select using (emg.is_staff());

drop policy if exists "emg_registration_tokens_staff_select" on emg.registration_tokens;
create policy "emg_registration_tokens_staff_select" on emg.registration_tokens
  for select using (emg.is_staff());

-- profiles: 担当者は全員分を参照可（少人数運用のため）
drop policy if exists "emg_profiles_staff_select_all" on emg.profiles;
create policy "emg_profiles_staff_select_all" on emg.profiles
  for select using (emg.is_staff());

-- =========================================================
-- 内部ヘルパー関数
--   SECURITY INVOKER（既定）のため、直接呼ばれてもテーブルへの書き込み権限がなく失敗する。
--   さらに EXECUTE 権限も剥奪し、SECURITY DEFINER の RPC からのみ使う。
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

-- 氏名と生年月日が一致する回答（削除済みを除く）が既にあるか
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
revoke execute on function emg._insert_members(uuid, jsonb) from public, anon, authenticated;
revoke execute on function emg._insert_household(jsonb) from public, anon, authenticated;
revoke execute on function emg._replace_household(uuid, jsonb) from public, anon, authenticated;

-- =========================================================
-- 公開フォーム用 RPC（anon から実行可能、SECURITY DEFINER）
-- =========================================================

-- 一斉収集リンク（/form）からの新規登録（受付停止中は拒否）
-- 氏名と生年月日が既存の回答と一致する場合は登録しない。公開フォームからの上書きは
-- 許可せず、内容の変更は長老が発行する更新リンクで行う。
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

-- 更新リンクの有効性チェック（有効な場合、確認画面に表示する氏名も返す。削除済みの回答は無効扱い）
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

-- 本人確認（生年月日の一致判定、試行回数制限あり）
-- 更新リンクは担当者が対象者ごとに個別発行するため宛先は既知。
-- 確認画面には氏名を表示するのみ（編集不可）とし、入力は生年月日のみを求める。
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

-- 個別更新の反映（本人確認済みトークンのみ、30分以内）
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

-- authenticated にも許可する理由: これらの関数はトークン/本人確認自体が
-- セキュリティ境界であり、ロールで制御していない。担当者が管理画面に
-- ログインしたまま同じブラウザで更新リンクを開くと、Supabase クライアントは
-- ログインセッションの認証情報（authenticated）を優先して使うため、anon にしか
-- 許可していないと権限エラーになってしまう。
grant execute on function emg.submit_registration(jsonb) to anon, authenticated;
grant execute on function emg.verify_registration_token(text) to anon, authenticated;
grant execute on function emg.submit_registration_with_token(text, jsonb) to anon, authenticated;
grant execute on function emg.verify_update_token(text) to anon, authenticated;
grant execute on function emg.confirm_update_identity(text, date) to anon, authenticated;
grant execute on function emg.submit_update(text, jsonb) to anon, authenticated;

-- =========================================================
-- 担当者用 RPC（authenticated のみ実行可能、内部で is_editor() を検証）
-- =========================================================

-- 一斉収集リンク（/form）の受付・停止の切り替え
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

-- 更新リンクの発行
-- トークンは pgcrypto 等の拡張機能に依存せず、コア関数の gen_random_uuid() のみで生成する
-- （既存プロジェクトの拡張機能の状態に影響を与えない・依存しないため）。
create or replace function emg.issue_update_token(p_household_id uuid, p_days_valid int default 14)
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

  insert into emg.update_tokens (household_id, token, expires_at, created_by)
  values (p_household_id, v_token, v_expires_at, auth.uid());

  return jsonb_build_object('token', v_token, 'expiresAt', v_expires_at);
end;
$$;

-- 新規登録リンクの発行
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

-- 担当者による代理編集
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
revoke execute on function emg.issue_update_token(uuid, int) from public;
revoke execute on function emg.issue_registration_token(int) from public;
revoke execute on function emg.admin_update_household(uuid, jsonb) from public;
revoke execute on function emg.delete_household(uuid) from public;
revoke execute on function emg.restore_household(uuid) from public;
revoke execute on function emg.purge_household(uuid) from public;

grant execute on function emg.set_form_open(boolean) to authenticated;
grant execute on function emg.issue_update_token(uuid, int) to authenticated;
grant execute on function emg.issue_registration_token(int) to authenticated;
grant execute on function emg.admin_update_household(uuid, jsonb) to authenticated;
grant execute on function emg.delete_household(uuid) to authenticated;
grant execute on function emg.restore_household(uuid) to authenticated;
grant execute on function emg.purge_household(uuid) to authenticated;

-- =========================================================
-- スキーマ全体への使用権限
-- （テーブル/関数の個別 GRANT があっても、スキーマ自体への USAGE がないとアクセス不可）
-- =========================================================

grant usage on schema emg to anon, authenticated;

-- テーブルへの直接 SELECT 権限
-- （RLS ポリシーとは別に、Postgres の基本的な GRANT が必要）
grant select on emg.shelters to anon, authenticated;
grant select on emg.settings to anon, authenticated;
grant select on emg.households to authenticated;
grant select on emg.cohabitants to authenticated;
grant select on emg.emergency_contacts to authenticated;
grant select on emg.update_tokens to authenticated;
grant select on emg.registration_tokens to authenticated;
grant select on emg.profiles to authenticated;

-- =========================================================
-- セットアップ後の手動作業（README参照）
--   1. Supabase ダッシュボード > Project Settings > Data API > Exposed schemas に
--      "emg" を追加して保存する
--   2. emg.shelters テーブルに対象地域の指定避難所を登録
--   3. 担当者にする既存メンバーについて、以下のように emg.profiles に登録する
--      （新規サインアップ時のトリガーは今後の新規ユーザーにしか効かないため、
--        既存ユーザーは手動登録が必要）:
--
--      insert into emg.profiles (id, display_name, role)
--      values ('<担当者のuser id>', '<表示名>', 'editor')
--      on conflict (id) do update set role = excluded.role;
--
--      user id は Authentication > Users の一覧から確認できる。
-- =========================================================
