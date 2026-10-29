import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

// POST /api/auth/logout  → 204  (세션 쿠키 삭제)
export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return new NextResponse(null, { status: 204 });
}
