import { NextResponse } from "next/server";
import { dbError, withUser } from "@/lib/supabase";
import { ValidationError, createTodo, isValidDate, listTodos } from "@/lib/todos";

// GET /api/todos?due=YYYY-MM-DD&tag=태그id&q=검색어  → { todos, total, remaining }
export function GET(request) {
  const params = request.nextUrl.searchParams;
  const dueDate = params.get("due");
  const tag = params.get("tag");
  const query = params.get("q")?.trim();

  if (dueDate && !isValidDate(dueDate)) {
    return NextResponse.json({ error: "due는 YYYY-MM-DD 형식이어야 합니다." }, { status: 400 });
  }
  const tagId = tag ? Number(tag) : null;
  if (tag && !Number.isInteger(tagId)) {
    return NextResponse.json({ error: "tag는 숫자 id여야 합니다." }, { status: 400 });
  }

  return withUser(async (supabase) => {
    try {
      return NextResponse.json(await listTodos(supabase, { dueDate, tagId, query }));
    } catch (error) {
      return dbError(error);
    }
  });
}

// POST /api/todos  { title, dueDate?, tags?: string[] }  → { id }
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  return withUser(async (supabase) => {
    try {
      return NextResponse.json({ id: await createTodo(supabase, body) }, { status: 201 });
    } catch (error) {
      if (error instanceof ValidationError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return dbError(error);
    }
  });
}
