"use client";

// 화면 코드. DB에 직접 접근하지 않고 백엔드 API(/api/todos, /api/tags)에만 요청한다.
import { useCallback, useEffect, useState } from "react";

// 사용자 컴퓨터의 현지 날짜 (YYYY-MM-DD)
function localToday() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDueDate(value) {
  const [, month, day] = value.split("-").map(Number);
  return `${month}월 ${day}일`;
}

// DB의 UTC 일시("YYYY-MM-DD HH:MM:SS")를 현지 날짜로 표시
function formatCompletedAt(value) {
  return new Date(`${value.replace(" ", "T")}Z`).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

async function request(url, options) {
  const response = await fetch(url, {
    ...options,
    headers: options?.body ? { "Content-Type": "application/json" } : undefined,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `요청 실패 (${response.status})`);
  }
  return response.status === 204 ? null : response.json();
}

function TagChip({ tag }) {
  return (
    <span
      className="rounded-full border px-2 py-0.5 text-xs font-medium"
      style={{ color: tag.color, borderColor: tag.color, backgroundColor: `${tag.color}14` }}
    >
      {tag.name}
    </span>
  );
}

export default function TodoApp() {
  const [today, setToday] = useState(null);
  const [data, setData] = useState({ todos: [], total: 0, remaining: 0 });
  const [tags, setTags] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  const [onlyToday, setOnlyToday] = useState(false);
  const [tagId, setTagId] = useState(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [tagText, setTagText] = useState("");
  const [formError, setFormError] = useState("");

  // 현지 날짜는 브라우저에서 계산한다 (서버 렌더링 시각과 어긋나지 않게).
  useEffect(() => setToday(localToday()), []);

  // 검색어는 입력이 멈춘 뒤 0.25초 후에 반영
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    if (!today) return;
    const params = new URLSearchParams();
    if (onlyToday) params.set("due", today);
    if (tagId) params.set("tag", String(tagId));
    if (query) params.set("q", query);
    try {
      const [list, tagList] = await Promise.all([request(`/api/todos?${params}`), request("/api/tags")]);
      setData(list);
      setTags(tagList);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoaded(true);
    }
  }, [today, onlyToday, tagId, query]);

  useEffect(() => {
    load();
  }, [load]);

  // 선택한 태그가 사라지면(마지막 할 일 삭제) 태그 필터를 해제
  useEffect(() => {
    if (tagId && loaded && !tags.some((t) => t.id === tagId)) setTagId(null);
  }, [tags, tagId, loaded]);

  async function run(action) {
    try {
      await action();
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleAdd(event) {
    event.preventDefault();
    if (!title.trim()) {
      setFormError("할 일 제목을 입력하세요.");
      return;
    }
    setFormError("");
    const tagNames = tagText.split(",").map((t) => t.trim()).filter(Boolean);
    try {
      await request("/api/todos", {
        method: "POST",
        body: JSON.stringify({ title, dueDate: dueDate || null, tags: tagNames }),
      });
      setTitle("");
      setDueDate("");
      setTagText("");
      await load();
    } catch (e) {
      setFormError(e.message);
    }
  }

  const toggle = (todo) =>
    run(() => request(`/api/todos/${todo.id}`, { method: "PATCH", body: JSON.stringify({ completed: !todo.completed }) }));

  const remove = (todo) => {
    if (window.confirm(`'${todo.title}'을(를) 삭제할까요?`)) run(() => request(`/api/todos/${todo.id}`, { method: "DELETE" }));
  };

  const filtered = onlyToday || tagId || query;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      {/* 1. 헤더 */}
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">내 할 일</h1>
          <p className="text-sm text-slate-500">
            {today &&
              new Date(`${today}T00:00:00`).toLocaleDateString("ko-KR", {
                year: "numeric",
                month: "long",
                day: "numeric",
                weekday: "long",
              })}
          </p>
        </div>
        <p className="text-sm text-slate-600">
          남은 할 일 <strong className="text-lg text-blue-600">{data.remaining}</strong>개
        </p>
      </header>

      {/* 2. 빠른 추가 */}
      <form onSubmit={handleAdd} className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="할 일을 입력하고 Enter"
            maxLength={200}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          />
          <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">
            추가
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          <label className="flex items-center gap-1 text-slate-600">
            마감일
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1"
            />
          </label>
          <input
            value={tagText}
            onChange={(e) => setTagText(e.target.value)}
            placeholder="태그 (쉼표로 구분, 예: 업무, 급함)"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1"
          />
        </div>
        {formError && <p className="mt-2 text-sm text-red-600">{formError}</p>}
      </form>

      {/* 3. 필터 바 */}
      <section className="mb-4 space-y-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOnlyToday((v) => !v)}
            className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-medium ${
              onlyToday ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            {onlyToday ? "오늘 할 일만 보는 중" : "오늘 할 일만 보기"}
          </button>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="제목 검색"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTagId(null)}
              className={`rounded-full border px-3 py-1 text-xs ${
                tagId === null ? "border-slate-700 bg-slate-700 text-white" : "border-slate-300 bg-white"
              }`}
            >
              전체
            </button>
            {tags.map((tag) => {
              const active = tagId === tag.id;
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => setTagId(active ? null : tag.id)}
                  className="rounded-full border px-3 py-1 text-xs font-medium"
                  style={{
                    borderColor: tag.color,
                    backgroundColor: active ? tag.color : "white",
                    color: active ? "white" : tag.color,
                  }}
                >
                  {tag.name} {tag.count}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {/* 4. 할 일 목록 / 5. 빈 상태 */}
      {loaded && data.todos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
          {data.total === 0 || !filtered ? "아직 할 일이 없습니다. 위에서 첫 할 일을 추가해 보세요." : "조건에 맞는 할 일이 없습니다."}
        </p>
      ) : (
        <ul className="space-y-2">
          {data.todos.map((todo) => {
            const isToday = !todo.completed && todo.dueDate === today;
            const overdue = !todo.completed && todo.dueDate && today && todo.dueDate < today;
            return (
              <li
                key={todo.id}
                className={`flex items-start gap-3 rounded-xl border bg-white p-3 shadow-sm ${
                  isToday ? "border-blue-400" : overdue ? "border-red-300" : "border-slate-200"
                }`}
              >
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => toggle(todo)}
                  aria-label="완료 표시"
                  className="mt-1 h-5 w-5 cursor-pointer accent-blue-600"
                />
                <div className="min-w-0 flex-1">
                  <p className={`break-words ${todo.completed ? "text-slate-400 line-through" : ""}`}>{todo.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                    {todo.dueDate && (
                      <span
                        className={`rounded px-1.5 py-0.5 ${
                          isToday
                            ? "bg-blue-100 font-semibold text-blue-700"
                            : overdue
                              ? "bg-red-100 font-semibold text-red-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {isToday ? "오늘 마감" : overdue ? `기한 지남 · ${formatDueDate(todo.dueDate)}` : `마감 ${formatDueDate(todo.dueDate)}`}
                      </span>
                    )}
                    {todo.tags.map((tag) => (
                      <TagChip key={tag.id} tag={tag} />
                    ))}
                    {todo.completed && todo.completedAt && (
                      <span className="text-slate-400">완료 {formatCompletedAt(todo.completedAt)}</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(todo)}
                  aria-label="삭제"
                  className="rounded px-2 text-lg leading-none text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
