import { NextResponse } from "next/server";
import { listTags } from "@/lib/todos";

// 요청마다 DB를 새로 읽는다 (빌드 때 결과를 고정하지 않음).
export const dynamic = "force-dynamic";

// GET /api/tags  → 할 일이 1개 이상 붙은 태그 [{ id, name, color, count }]
export function GET() {
  return NextResponse.json(listTags());
}
