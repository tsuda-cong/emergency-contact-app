import { redirect } from "next/navigation";

// トップページは管理画面の入口のみ（未ログインなら proxy がログイン画面へ回す）。
// 回答者には /form や個別リンクを直接案内するため、ここには何も表示しない。
export default function Home() {
  redirect("/admin");
}
