import { NextResponse } from "next/server";
import { authError, readCredentials } from "@/lib/auth";
import { createClient } from "@/lib/supabase";

// POST /api/auth/login  { email, password }  → { user }  (세션은 httpOnly 쿠키로 저장)
export async function POST(request) {
  const { email, password, response } = await readCredentials(request);
  if (response) return response;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return authError(error);

  return NextResponse.json({ user: { id: data.user.id, email: data.user.email } });
}
