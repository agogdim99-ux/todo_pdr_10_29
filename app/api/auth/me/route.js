import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET /api/auth/me  → { user: { id, email } | null }
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return NextResponse.json({ user: user ? { id: user.id, email: user.email } : null });
}
