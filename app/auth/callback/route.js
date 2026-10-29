import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/auth";
import { createClient } from "@/lib/supabase";

// 가입 확인 메일의 링크가 돌아오는 곳. 받은 code를 로그인 세션으로 바꾸고 첫 화면으로 보낸다.
export async function GET(request) {
  const code = request.nextUrl.searchParams.get("code");
  const home = siteUrl(request);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${home}/`);
    console.error("[supabase auth callback]", error);
  }
  return NextResponse.redirect(`${home}/?auth_error=1`);
}
