# 緊急連絡先管理アプリ

災害時などの緊急連絡先情報（本人・同居人・非同居の緊急連絡先）を収集・管理する Web アプリです。
回答者はログイン不要（常設リンク、または長老発行の期限付き個別更新リンク）で回答・更新でき、
長老（編集ロール／閲覧ロール）は Supabase Auth でログインして管理画面を利用します。

- フロントエンド: Next.js（App Router）+ TypeScript + Tailwind CSS
- バックエンド: Supabase（Postgres / Auth / Row Level Security）
- デプロイ想定: Vercel（GitHub 連携）

## Supabase プロジェクトについて（重要）

このアプリは新規に Supabase プロジェクトを作らず、**既存の「奉仕報告管理」プロジェクトに同居**させる構成になっています。

- 専用スキーマ `emg` の中に全テーブル・全関数を作成するため、既存アプリの `public` スキーマには一切影響しません
- Auth のユーザー（ログインアカウント）は Supabase プロジェクト単位で共有されるため、「奉仕報告管理」で既にアカウントを持つ長老は、そのメールアドレス・パスワードのままこのアプリにもログインできます（長老としての権限だけ `emg.profiles` に別途登録が必要）
- 書き込みはすべて RLS + SECURITY DEFINER 関数で制御しているため、`service_role` キーは使用しません

## セットアップ手順

### 1. マイグレーションの実行

「奉仕報告管理」の Supabase プロジェクトのダッシュボードで「SQL Editor」を開き、
[supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql) の内容をそのまま実行してください。

`emg` スキーマ、テーブル、RLS ポリシー、ロール判定関数、公開フォーム用の RPC 関数がまとめて作成されます。
既存の `public` スキーマのテーブル・関数・トリガーには一切変更を加えません。

### 2. スキーマの公開設定

Supabase ダッシュボードの **Project Settings → Data API → Exposed schemas** を開き、`emg` を追加して保存してください。
（デフォルトでは `public` と `graphql_public` のみが PostgREST 経由で公開されており、`emg` は明示的に追加しないとアプリからアクセスできません）

### 3. 指定避難場所一覧の登録

「Table Editor」で `emg` スキーマに切り替え、`shelters` テーブルに対象地域の指定避難場所を `name`（指定避難場所名）、`sort_order`（表示順）で登録してください。

### 4. 長老アカウントの準備

**「奉仕報告管理」で既にアカウントを持っているメンバーを長老にする場合**（今回のケース）:

新規サインアップ時の自動登録トリガーは今後の新規ユーザーにしか効かないため、既存メンバーは手動で `emg.profiles` に登録します。SQL Editor で以下を実行してください（`<長老のuser id>` は Authentication → Users の一覧から取得できます）。

```sql
insert into emg.profiles (id, display_name, role)
values ('<長老のuser id>', '<表示名>', 'editor')  -- 閲覧ロールにする場合は 'viewer'
on conflict (id) do update set role = excluded.role;
```

編集ロール1名、閲覧ロール数名分をそれぞれ実行してください。

**新しくアカウントを作る場合**は、Supabase ダッシュボードの「Authentication」→「Users」からユーザーを作成すると、`emg.profiles` に自動的に `viewer` ロールで登録されます。編集ロールにする場合は上記と同様に SQL で `role` を更新してください。

### 5. ローカル環境変数の設定

```bash
cp .env.local.example .env.local
```

`.env.local` を開き、「奉仕報告管理」プロジェクトの Project Settings → API から取得した値を設定してください。

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxxxxx
```

### 6. ローカルで起動

```bash
npm install
npm run dev
```

http://localhost:3000 で確認できます。

- `/form` … 常設の回答フォーム（誰でもアクセス可、常時受付）
- `/admin/login` … 長老ログイン（「奉仕報告管理」と同じメールアドレス・パスワード）
- `/admin` … 一覧・検索・並び替え・詳細・編集・更新リンク発行・PDF出力
- `/update/[token]` … 長老が発行した期限付き個別更新リンク

### 7. Vercel へのデプロイ

このアプリは「奉仕報告管理」とは別の Next.js プロジェクト・別デプロイです（データベースだけ共有）。

1. このプロジェクトを新しい GitHub リポジトリに push する
2. Vercel で「Add New Project」→ 上記リポジトリを選択
3. Environment Variables に `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定
4. デプロイ

## 権限設計（RLS）

- `anon`（未ログインの回答者）: `emg.shelters` の参照と、公開フォーム用 RPC（`emg.submit_registration` / `emg.verify_update_token` / `emg.confirm_update_identity` / `emg.submit_update`）の実行のみ許可。テーブルへの直接アクセスは不可。
- `authenticated`（長老・閲覧ロール）: `emg` スキーマ内の各テーブルの参照が可能。
- `authenticated`（長老・編集ロール）: 上記に加え、代理編集用 RPC（`emg.admin_update_household`）と更新リンク発行用 RPC（`emg.issue_update_token`）を実行可能。

ロールは `emg.profiles.role`（`editor` / `viewer`）で管理し、`emg.is_staff()` / `emg.is_editor()` という SECURITY DEFINER 関数を通じて RLS ポリシーから参照しています。このロールはこのアプリ専用で、「奉仕報告管理」側の権限とは独立しています。

## 個別更新リンクの仕組み

1. 長老が管理画面から対象者を検索し「更新リンクを発行」を押すと、一意なトークン付きの URL（`/update/<token>`）が発行される（有効期限: 発行から14日、使用済みで無効化）
2. 対象者がリンクを開くと、まず氏名・生年月日による本人確認画面が表示される
3. 一致すれば現在の登録内容が事前入力された編集フォームに進める（一致しない場合は5回まで再試行可、それ以降はリンクが無効になる）
4. 送信すると内容が上書きされ、トークンは使用済みとして無効化される

## PDF出力

管理画面の「PDF出力」から印刷用の一覧ページ（`/admin/print`）を開き、ブラウザの印刷機能（「PDFとして保存」）でPDF化する方式を採用しています。日本語フォントの埋め込みが不要で、ブラウザの印刷レイアウトをそのまま利用できます。
