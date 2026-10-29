// 할 일·태그 조회와 변경. 백엔드 API(app/api)에서만 사용한다.
// 모든 함수는 로그인한 사용자의 Supabase 클라이언트를 받으므로, RLS가 본인 데이터로 제한한다.
// 실제 쿼리는 supabase/schema.sql의 DB 함수에 있다.
import "server-only";

const MAX_TITLE = 200;
const MAX_TAG_NAME = 20;
const MAX_TAGS = 5;

export class ValidationError extends Error {}

export function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function toTodo(row) {
  return {
    id: row.id,
    title: row.title,
    completed: row.completed,
    completedAt: row.completed_at,
    dueDate: row.due_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags: row.tags,
  };
}

// 필터(마감일, 태그, 검색어)는 모두 AND로 결합한다.
export async function listTodos(supabase, { dueDate, tagId, query } = {}) {
  const { data, error } = await supabase.rpc("list_todos", {
    p_due: dueDate || null,
    p_tag: tagId || null,
    p_q: query || null,
  });
  if (error) throw error;
  return { todos: data.todos.map(toTodo), total: data.total, remaining: data.remaining };
}

// 할 일이 1개 이상 붙은 태그만 (필터 칩용)
export async function listTags(supabase) {
  const { data, error } = await supabase.rpc("list_tags");
  if (error) throw error;
  return data;
}

function parseNewTodo(input) {
  const title = typeof input?.title === "string" ? input.title.trim() : "";
  if (!title) throw new ValidationError("할 일 제목을 입력하세요.");
  if (title.length > MAX_TITLE) throw new ValidationError(`제목은 ${MAX_TITLE}자 이하로 입력하세요.`);

  const dueDate = input.dueDate || null;
  if (dueDate !== null && !isValidDate(dueDate)) throw new ValidationError("마감일 형식이 올바르지 않습니다.");

  if (input.tags !== undefined && !Array.isArray(input.tags)) throw new ValidationError("태그 형식이 올바르지 않습니다.");
  const tags = [];
  for (const raw of input.tags ?? []) {
    const name = typeof raw === "string" ? raw.trim() : "";
    if (!name) continue;
    if (name.length > MAX_TAG_NAME) throw new ValidationError(`태그는 ${MAX_TAG_NAME}자 이하로 입력하세요.`);
    if (!tags.some((t) => t.toLowerCase() === name.toLowerCase())) tags.push(name);
  }
  if (tags.length > MAX_TAGS) throw new ValidationError(`태그는 ${MAX_TAGS}개까지 붙일 수 있습니다.`);

  return { title, dueDate, tags };
}

// 할 일과 태그 연결을 DB 함수 하나(한 트랜잭션)로 만든다. 소유자는 DB가 로그인 사용자로 기록한다.
export async function createTodo(supabase, input) {
  const { title, dueDate, tags } = parseNewTodo(input);
  const { data: id, error } = await supabase.rpc("create_todo", { p_title: title, p_due_date: dueDate, p_tags: tags });
  if (error) throw error;
  return id;
}

// 완료 일시는 DB 트리거가 기록/삭제한다. 본인 할 일이 아니면 RLS 때문에 0행 → null.
export async function setCompleted(supabase, id, completed) {
  const { data, error } = await supabase
    .from("todos")
    .update({ completed })
    .eq("id", id)
    .select("id, completed, completed_at")
    .maybeSingle();
  if (error) throw error;
  return data && { id: data.id, completed: data.completed, completedAt: data.completed_at };
}

// 할 일을 지우고, 쓰이지 않게 된 본인 태그도 함께 지운다. 지웠으면 true.
export async function deleteTodo(supabase, id) {
  const { data, error } = await supabase.rpc("delete_todo", { p_id: id });
  if (error) throw error;
  return data;
}
