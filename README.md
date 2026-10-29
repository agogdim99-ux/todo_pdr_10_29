# 내 할 일 (Todo) — Next.js + Supabase

로그인한 사용자별로 할 일을 Supabase(클라우드 Postgres)에 저장하는 Todo 앱.

- 과제 제출 기록: [제출기록.md](제출기록.md) · PRD: [PRD.md](PRD.md)
- 길 A(로컬 SQLite) 버전은 커밋 `2253816`에 있다.

## 구조

```
브라우저 (components/)  ──fetch──▶  백엔드 API (app/api, app/auth)  ──토큰 포함──▶  Supabase (Auth + Postgres, RLS)
  Supabase 직접 호출 없음            접속 키는 여기서만 사용(.env)                   본인 행만 허용
```

- **화면** `components/App.js`, `AuthForm.js`, `TodoApp.js`: `/api/...`에만 요청한다.
- **백엔드** `app/api/**/route.js`, `app/auth/callback/route.js`, `lib/supabase.js`, `lib/todos.js`, `lib/auth.js`: `lib/*`는 `server-only`라 화면에서 불러오면 빌드가 실패한다.
- **DB** `supabase/schema.sql`: 표 3개(todos, tags, todo_tags), 각 행의 소유자 `user_id`, RLS 정책, DB 함수.
- 로그인 세션은 httpOnly 쿠키에 저장되어 브라우저 스크립트가 읽을 수 없다.

| API | 설명 |
|---|---|
| `POST /api/auth/signup`, `/login`, `/logout` · `GET /api/auth/me` | 회원가입·로그인·로그아웃·현재 사용자 |
| `GET /api/todos?due=&tag=&q=` · `POST /api/todos` | 목록(조건 AND)·추가 |
| `PATCH /api/todos/:id` · `DELETE /api/todos/:id` | 완료 표시·삭제 |
| `GET /api/tags` | 사용 중인 태그 |

로그인하지 않으면 할 일 API는 모두 401, 남의 할 일 id는 404.

## 1. Supabase 준비 (처음 한 번)

1. https://supabase.com 에 가입하고 **New project** (Free 플랜, Region: Northeast Asia (Seoul)).
2. 왼쪽 **SQL Editor** → `supabase/schema.sql` 내용 전체를 붙여넣고 **Run**.
3. **Project Settings → API Keys**에서 **Publishable key**(`sb_publishable_...`), **Data API**(또는 Connect 버튼)에서 **Project URL**을 복사.
   - `secret` / `service_role` 키는 RLS를 무시하므로 이 앱에 쓰지 않는다.
4. **Authentication → URL Configuration**
   - Site URL: `http://localhost:3000`
   - Redirect URLs에 추가: `http://localhost:3000/auth/callback`
5. (선택) 연습 중에는 **Authentication → Sign In / Providers → Email**에서 *Confirm email*을 끄면 가입 즉시 로그인된다. 켜 두면 확인 메일 링크를 눌러야 하며, 기본 메일 발송은 시간당 몇 통으로 제한된다.

## 2. 로컬 실행

```
cp .env.example .env     # 이미 있으면 생략. SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY 채우기
npm install
npm run dev              # http://localhost:3000
```

## 3. 배포 준비물 (Render 기준)

| 항목 | 값 |
|---|---|
| 코드 보관 위치 | GitHub 저장소 (비공개 가능). Render가 이 저장소를 연결해 빌드 |
| 서비스 종류 | Web Service, Runtime: Node |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm start` (Render가 주는 `PORT`를 Next.js가 자동으로 사용) |
| Node 버전 | `package.json`의 `engines` (20.9 이상) |
| 환경변수 | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SITE_URL=https://<서비스이름>.onrender.com` |
| Supabase 설정 추가 | Authentication → URL Configuration: Site URL을 Render 주소로, Redirect URLs에 `https://<서비스이름>.onrender.com/auth/callback` 추가 |

- `.env`는 Git에 올라가지 않으므로 환경변수는 Render 대시보드에 직접 입력한다.
- Render 무료 인스턴스는 한동안 요청이 없으면 잠들고, 다음 접속 때 깨어나는 데 시간이 걸린다.
