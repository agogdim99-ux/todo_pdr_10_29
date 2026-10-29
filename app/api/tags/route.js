import { NextResponse } from "next/server";
import { dbError, withUser } from "@/lib/supabase";
import { listTags } from "@/lib/todos";

// 요청마다 새로 읽는다 (빌드 때 결과를 고정하지 않음).
export const dynamic = "force-dynamic";

// GET /api/tags  → 할 일이 1개 이상 붙은 본인 태그 [{ id, name, color, count }]
export function GET() {
  return withUser(async (supabase) => {
    try {
      return NextResponse.json(await listTags(supabase));
    } catch (error) {
      return dbError(error);
    }
  });
}
