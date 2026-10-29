// 할 일·태그 조회와 변경. 백엔드 API(app/api)에서만 사용한다.
import "server-only";
import { getDb, transaction } from "./db";

// 새 태그에 순서대로 배정하는 색 (아직 안 쓰인 색 우선)
const TAG_COLORS = ["#e05d5d", "#e8913a", "#c99a06", "#43a047", "#00897b", "#3b82f6", "#8b5cf6", "#d9468f"];

const MAX_TITLE = 200;
const MAX_TAG_NAME = 20;
const MAX_TAGS = 5;

export class ValidationError extends Error {}

export function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// 할 일 한 건에 붙은 태그를 JSON 배열 하나로 묶어 가져온다.
const TODO_COLUMNS = `
  t.*,
  (SELECT json_group_array(json_object('id', g.id, 'name', g.name, 'color', g.color) ORDER BY g.name)
     FROM todo_tags x JOIN tags g ON g.id = x.tag_id
    WHERE x.todo_id = t.id) AS tags`;

function toTodo(row) {
  return {
    id: row.id,
    title: row.title,
    completed: row.completed === 1,
    completedAt: row.completed_at,
    dueDate: row.due_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags: JSON.parse(row.tags),
  };
}

function getTodo(id) {
  const row = getDb().prepare(`SELECT ${TODO_COLUMNS} FROM todos t WHERE t.id = ?`).get(id);
  return row ? toTodo(row) : null;
}

// 필터(마감일, 태그, 검색어)는 모두 AND로 결합한다. 정렬: 미완료 먼저 → 마감일 빠른 순(없으면 뒤) → 최근 등록 순.
export function listTodos({ dueDate, tagId, query } = {}) {
  const where = [];
  const params = [];
  if (dueDate) {
    where.push("t.due_date = ?");
    params.push(dueDate);
  }
  if (tagId) {
    where.push("EXISTS (SELECT 1 FROM todo_tags x WHERE x.todo_id = t.id AND x.tag_id = ?)");
    params.push(tagId);
  }
  if (query) {
    where.push("t.title LIKE ? ESCAPE '\\'");
    params.push(`%${query.replace(/[\\%_]/g, "\\$&")}%`);
  }

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT ${TODO_COLUMNS} FROM todos t
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY t.completed, t.due_date IS NULL, t.due_date, t.created_at DESC, t.id DESC`,
    )
    .all(...params);
  const counts = db.prepare("SELECT COUNT(*) AS total, COUNT(*) - SUM(completed) AS remaining FROM todos").get();

  return { todos: rows.map(toTodo), total: counts.total, remaining: counts.remaining ?? 0 };
}

// 할 일이 1개 이상 붙은 태그만 (필터 칩용)
export function listTags() {
  return getDb()
    .prepare(
      `SELECT g.id, g.name, g.color, COUNT(*) AS count
         FROM tags g JOIN todo_tags x ON x.tag_id = g.id
        GROUP BY g.id
        ORDER BY g.name`,
    )
    .all();
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

function findOrCreateTag(db, name) {
  const existing = db.prepare("SELECT id FROM tags WHERE name = ?").get(name); // name 열은 대소문자 무시
  if (existing) return existing.id;

  const used = new Set(db.prepare("SELECT color FROM tags").all().map((r) => r.color));
  const total = db.prepare("SELECT COUNT(*) AS n FROM tags").get().n;
  const color = TAG_COLORS.find((c) => !used.has(c)) ?? TAG_COLORS[total % TAG_COLORS.length];
  return db.prepare("INSERT INTO tags (name, color) VALUES (?, ?) RETURNING id").get(name, color).id;
}

export function createTodo(input) {
  const { title, dueDate, tags } = parseNewTodo(input);
  const id = transaction((db) => {
    const { id } = db.prepare("INSERT INTO todos (title, due_date) VALUES (?, ?) RETURNING id").get(title, dueDate);
    const link = db.prepare("INSERT INTO todo_tags (todo_id, tag_id) VALUES (?, ?)");
    for (const name of tags) link.run(id, findOrCreateTag(db, name));
    return id;
  });
  return getTodo(id);
}

// 완료로 바꾸면 완료 일시를 기록(이미 완료면 유지)하고, 완료를 해제하면 지운다.
export function setCompleted(id, completed) {
  const flag = completed ? 1 : 0;
  const result = getDb()
    .prepare(
      `UPDATE todos
          SET completed = $flag,
              completed_at = CASE WHEN $flag = 1 THEN COALESCE(completed_at, datetime('now')) END,
              updated_at = datetime('now')
        WHERE id = $id`,
    )
    .run({ flag, id });
  return result.changes ? getTodo(id) : null;
}

// 할 일을 지우고, 그 결과 어느 할 일에도 붙지 않은 태그도 함께 지운다.
export function deleteTodo(id) {
  return transaction((db) => {
    const { changes } = db.prepare("DELETE FROM todos WHERE id = ?").run(id);
    if (changes) db.exec("DELETE FROM tags WHERE NOT EXISTS (SELECT 1 FROM todo_tags x WHERE x.tag_id = tags.id)");
    return changes > 0;
  });
}
