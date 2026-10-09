import type { NextConfig } from "next";

// すべてのページに付けるセキュリティ用の応答ヘッダー
const securityHeaders = [
  // 他のサイトの枠（iframe）に埋め込ませない（クリックジャッキング対策）。
  // X-Frame-Options は古いブラウザ向けに併記する
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  // 移動先や読み込み先の他サイトに、どのページから来たか（URL）を伝えない。
  // 更新リンク・新規登録リンクの URL には合言葉が含まれるため
  { key: "Referrer-Policy", value: "same-origin" },
  // ファイルの種類をブラウザに推測させない
  { key: "X-Content-Type-Options", value: "nosniff" },
  // カメラ・マイク・位置情報などは使わないので、使えないようにしておく
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  // HTTPS でだけ開くようにする（2年間）
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
