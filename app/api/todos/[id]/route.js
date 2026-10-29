import { NextResponse } from "next/server";
import { dbError, withUser } from "@/lib/supabase";
import { deleteTodo, setCompleted } from "@/lib/todos";

async function parseId(params) {
  const id = Number((await params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// 남의 할 일은 RLS 때문에 "없는 것"과 똑같이 404가 된다.
const notFound = () => NextResponse.json({ error: "할 일을 찾을 수 없습니다." }, { status: 404 });

// PATCH /api/todos/:id  { completed: true|false }  → { id, completed, completedAt }
export async function PATCH(request, { params }) {
  const id = await parseId(params);
  if (!id) return notFound();

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }
  if (typeof body?.completed !== "boolean") {
    return NextResponse.json({ error: "completed는 true 또는 false여야 합니다." }, { status: 400 });
  }

  return withUser(async (supabase) => {
    try {
      const todo = await setCompleted(supabase, id, body.completed);
      return todo ? NextResponse.json(todo) : notFound();
    } catch (error) {
      return dbError(error);
    }
  });
}

// DELETE /api/todos/:id  → 204
export async function DELETE(request, { params }) {
  const id = await parseId(params);
  if (!id) return notFound();

  return withUser(async (supabase) => {
    try {
      return (await deleteTodo(supabase, id)) ? new NextResponse(null, { status: 204 }) : notFound();
    } catch (error) {
      return dbError(error);
    }
  });
}
