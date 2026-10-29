import { NextResponse } from "next/server";
import { deleteTodo, setCompleted } from "@/lib/todos";

async function parseId(params) {
  const id = Number((await params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

const notFound = () => NextResponse.json({ error: "할 일을 찾을 수 없습니다." }, { status: 404 });

// PATCH /api/todos/:id  { completed: true|false }  → 바뀐 할 일
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

  const todo = setCompleted(id, body.completed);
  return todo ? NextResponse.json(todo) : notFound();
}

// DELETE /api/todos/:id  → 204
export async function DELETE(request, { params }) {
  const id = await parseId(params);
  if (!id || !deleteTodo(id)) return notFound();
  return new NextResponse(null, { status: 204 });
}
