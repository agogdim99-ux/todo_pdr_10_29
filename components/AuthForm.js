"use client";

// 로그인·회원가입 화면. 백엔드 API(/api/auth/*)에만 요청한다.
import { useEffect, useState } from "react";
import { request } from "@/lib/api-client";

export default function AuthForm({ onSignedIn }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  // 가입 확인 링크 처리에 실패하면 /?auth_error=1 로 돌아온다.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("auth_error")) {
      setError("가입 확인 링크가 만료되었거나 올바르지 않습니다. 다시 로그인하거나 가입해 주세요.");
      window.history.replaceState(null, "", "/");
    }
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const body = JSON.stringify({ email, password });
      if (mode === "login") {
        const data = await request("/api/auth/login", { method: "POST", body });
        onSignedIn(data.user);
      } else {
        const data = await request("/api/auth/signup", { method: "POST", body });
        if (data.needsConfirmation) {
          setNotice(`${email}로 가입 확인 메일을 보냈습니다. 메일의 링크를 누르면 로그인됩니다.`);
          setMode("login");
          setPassword("");
        } else {
          onSignedIn(data.user);
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const isLogin = mode === "login";
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-1 text-2xl font-bold">내 할 일</h1>
      <p className="mb-6 text-sm text-slate-500">{isLogin ? "로그인하고 내 할 일을 확인하세요." : "이메일로 가입하세요."}</p>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block text-sm">
          <span className="text-slate-600">이메일</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">비밀번호 (6자 이상)</span>
          <input
            type="password"
            required
            minLength={6}
            autoComplete={isLogin ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          />
        </label>

        {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        {notice && <p className="rounded-lg bg-blue-50 p-2 text-sm text-blue-700">{notice}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-blue-600 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "처리 중…" : isLogin ? "로그인" : "회원가입"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-600">
        {isLogin ? "계정이 없나요?" : "이미 가입했나요?"}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(isLogin ? "signup" : "login");
            setError("");
          }}
          className="font-medium text-blue-600 hover:underline"
        >
          {isLogin ? "회원가입" : "로그인"}
        </button>
      </p>
    </main>
  );
}
