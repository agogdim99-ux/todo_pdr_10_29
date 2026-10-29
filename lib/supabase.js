// Supabase 연결. 서버 쪽 코드에서만 불러올 수 있다 (화면 코드에서 import하면 빌드 오류).
// 접속 키는 .env에서만 읽고, NEXT_PUBLIC_ 접두어를 붙이지 않아 브라우저로 나가지 않는다.
import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// 요청마다 새로 만든다. 로그인 세션은 httpOnly 쿠키로 오가며, 이 클라이언트가 보내는
// 모든 DB 요청에는 로그인한 사용자의 토큰이 실려 RLS가 그 사용자 기준으로 적용된다.
export async function createClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL과 SUPABASE_PUBLISHABLE_KEY를 .env에 설정하세요.");
  }

  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, { ...options, httpOnly: true });
        }
      },
    },
  });
}

// 로그인한 사용자만 handler를 실행한다. 아니면 401.
export async function withUser(handler) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser(); // Supabase Auth 서버에 토큰을 확인 (만료 시 갱신)
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  return handler(supabase, user);
}

// DB 오류 내용은 서버 로그에만 남기고, 화면에는 일반 문구만 보낸다.
export function dbError(error) {
  console.error("[supabase]", error);
  return NextResponse.json({ error: "데이터베이스 요청에 실패했습니다." }, { status: 500 });
}
