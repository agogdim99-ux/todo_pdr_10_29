// SQLite 연결. 서버 쪽 코드에서만 불러올 수 있다 (화면 코드에서 import하면 빌드 오류).
import "server-only";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

// db-design.md 7절과 같은 구조. 앱이 처음 실행될 때 표를 만든다.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS todos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT    NOT NULL CHECK (length(trim(title)) > 0),
  completed     INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  completed_at  TEXT,
  due_date      TEXT    CHECK (due_date IS NULL OR due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  CHECK ((completed = 0 AND completed_at IS NULL) OR (completed = 1 AND completed_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS tags (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  name   TEXT    NOT NULL UNIQUE COLLATE NOCASE CHECK (length(trim(name)) > 0),
  color  TEXT    NOT NULL CHECK (color GLOB '#[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]')
);

CREATE TABLE IF NOT EXISTS todo_tags (
  todo_id  INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  tag_id   INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (todo_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_todos_due_date  ON todos(due_date);
CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed);
CREATE INDEX IF NOT EXISTS idx_todo_tags_tag   ON todo_tags(tag_id);
`;

function open() {
  const file = path.resolve(process.cwd(), process.env.TODO_DB_PATH || "todo.db");
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON;"); // SQLite는 연결마다 켜야 FK·CASCADE가 동작함
  db.exec(SCHEMA);
  return db;
}

// 첫 요청 때 연결을 열고, 개발 서버가 코드를 다시 불러와도 연결 하나를 계속 쓴다.
export function getDb() {
  globalThis.__todoDb ??= open();
  return globalThis.__todoDb;
}

// fn 안의 쓰기 작업을 한꺼번에 반영하고, 중간에 오류가 나면 모두 되돌린다.
export function transaction(fn) {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const result = fn(db);
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
