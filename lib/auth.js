// 로그인 API 공통 처리. 서버 전용.
import "server-only";
import { NextResponse } from "next/server";

const AUTH_MESSAGES = {
  invalid_credentials: "이메일 또는 비밀번호가 올바르지 않습니다.",
  email_not_confirmed: "가입 확인 메일의 링크를 먼저 눌러 주세요.",
  user_already_exists: "이미 가입된 이메일입니다.",
  weak_password: "비밀번호가 너무 약합니다. 6자 이상으로 정하세요.",
  over_email_send_rate_limit: "메일 발송 한도를 넘었습니다. 잠시 후 다시 시도하세요.",
  over_request_rate_limit: "요청이 너무 많습니다. 잠시 후 다시 시도하세요.",
};

export function authError(error) {
  const message = AUTH_MESSAGES[error.code];
  if (!message) console.error("[supabase auth]", error);
  return NextResponse.json({ error: message ?? "로그인 처리에 실패했습니다." }, { status: error.status ?? 400 });
}

// { email, password } 본문을 읽고 검사한다. 문제가 있으면 { response }로 400을 돌려준다.
export async function readCredentials(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return { response: NextResponse.json({ error: "JSON 본문이 필요합니다." }, { status: 400 }) };
  }
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { response: NextResponse.json({ error: "이메일 형식이 올바르지 않습니다." }, { status: 400 }) };
  }
  if (password.length < 6) {
    return { response: NextResponse.json({ error: "비밀번호는 6자 이상이어야 합니다." }, { status: 400 }) };
  }
  return { email, password };
}

// 배포 환경에서는 SITE_URL(예: https://my-todo.onrender.com)을 기준으로 링크를 만든다.
export function siteUrl(request) {
  return (process.env.SITE_URL || request.nextUrl.origin).replace(/\/$/, "");
}
