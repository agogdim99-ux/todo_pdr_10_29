import { NextResponse } from "next/server";
import { authError, readCredentials, siteUrl } from "@/lib/auth";
import { createClient } from "@/lib/supabase";

// POST /api/auth/signup  { email, password }
//   → { user, needsConfirmation }  (Supabase 설정에서 이메일 확인이 켜져 있으면 확인 메일 발송)
export async function POST(request) {
  const { email, password, response } = await readCredentials(request);
  if (response) return response;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${siteUrl(request)}/auth/callback` },
  });
  if (error) return authError(error);

  return NextResponse.json(
    { user: data.session ? { id: data.user.id, email: data.user.email } : null, needsConfirmation: !data.session },
    { status: 201 },
  );
}
