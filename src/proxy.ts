import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname.startsWith("/admin");
  const isLoginRoute = pathname === "/admin/login";

  if (isAdminRoute && !isLoginRoute && !user) {
    const loginUrl = new URL("/admin/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoginRoute && user) {
    const adminUrl = new URL("/admin", request.url);
    return NextResponse.redirect(adminUrl);
  }

  // 回答一覧の並び順・検索条件を覚えておき、詳細などから一覧に戻ったときに復元する。
  // 一覧へのリンクはどこも条件なしの /admin なので、ここでまとめて扱う。
  if (pathname === "/admin" && user) {
    const listQuery = pickListQuery(request.nextUrl.searchParams);
    if (listQuery !== null) {
      response.cookies.set(LIST_QUERY_COOKIE, listQuery, {
        path: "/admin",
        httpOnly: true,
        sameSite: "lax",
      });
    } else {
      const saved = request.cookies.get(LIST_QUERY_COOKIE)?.value;
      const restored = saved ? pickListQuery(new URLSearchParams(saved)) : null;
      if (restored) {
        const redirect = NextResponse.redirect(new URL(`/admin?${restored}`, request.url));
        // ログイン状態の更新で付いた Cookie を引き継ぐ
        response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
        return redirect;
      }
    }
  }

  return response;
}

const LIST_QUERY_COOKIE = "emg_admin_list_query";

// 一覧の条件（sort と q）だけを取り出す。どちらも指定がなければ null
function pickListQuery(params: URLSearchParams): string | null {
  if (!params.has("sort") && !params.has("q")) return null;
  const picked = new URLSearchParams();
  const q = params.get("q");
  const sort = params.get("sort");
  if (q) picked.set("q", q);
  if (sort === "romaji" || sort === "created" || sort === "updated") picked.set("sort", sort);
  return picked.toString();
}

export const config = {
  matcher: ["/admin/:path*"],
};
