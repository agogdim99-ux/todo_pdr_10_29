"use client";

// 로그인 여부에 따라 로그인 화면 또는 할 일 화면을 보여 준다.
import { useEffect, useState } from "react";
import { request } from "@/lib/api-client";
import AuthForm from "./AuthForm";
import TodoApp from "./TodoApp";

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = 확인 중, null = 로그아웃 상태

  useEffect(() => {
    request("/api/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => setUser(null));
  }, []);

  if (user === undefined) {
    return <p className="p-10 text-center text-slate-500">불러오는 중…</p>;
  }
  if (!user) {
    return <AuthForm onSignedIn={setUser} />;
  }
  return <TodoApp user={user} onSignedOut={() => setUser(null)} />;
}
