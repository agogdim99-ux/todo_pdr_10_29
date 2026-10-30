# AIFFEL Campus Agent Code Review Templete
- 개발자 : 강승만(에이전트3기) / GitHub @victorymankang-dot
- 리뷰어 : 이주연 (에이전트 3기) / GitHub @agogdim99-ux

# ART(Agent Review Template)
[O]  **1. 원하는 기능이 의도한 대로 동작하나요?**
- 요청(프롬프트)한 기능이 정상적으로 구현되었는지?
  - PRD 4.1에서 요청한 기능(추가·목록·완료 토글·삭제, 마감일, 카테고리(태그) 필터, 오늘 할 일만 보기, 검색)이 길 A(로컬 SQLite)와 길 B(Supabase)에서 모두 구현되었습니다.
  - API가 PRD 그대로 나뉘어 있어요: `GET/POST /api/todos`, `PATCH/DELETE /api/todos/:id`, `GET /api/tags`, 로그인 `/api/auth/*` ([app/api](app/api))
  - 서버를 완전히 껐다 켠 뒤에도 할 일과 완료 상태가 남는 것까지 확인되어 있습니다 ([제출기록.md](제출기록.md) "유지 확인").
- 실제 실행 화면/결과물을 캡처하여 근거로 첨부

| 길 A: 추가 | 길 A: 완료 | 길 A: 서버 재시작 후 유지 |
|---|---|---|
| ![](docs/screenshots/A2-추가.png) | ![](docs/screenshots/A3-완료.png) | ![](docs/screenshots/A5-재시작후유지.png) |

| 길 B: 추가 | 길 B: 삭제 | 길 B: 서버 재시작 후 유지 |
|---|---|---|
| ![](docs/screenshots/B3-추가.png) | ![](docs/screenshots/B5-삭제.png) | ![](docs/screenshots/B6-재시작후유지.png) |

[O]  **2. 보안 검토를 수행했나요?**
- API 키, 비밀번호 등 민감 정보가 코드에 하드코딩되지 않았는지
  - 접속 키는 `process.env.SUPABASE_URL`, `process.env.SUPABASE_PUBLISHABLE_KEY`로만 읽습니다 ([lib/supabase.js](lib/supabase.js)).
  - `.env`는 [.gitignore](.gitignore)에 들어 있고, 저장소에는 값이 빈 [.env.example](.env.example)만 있습니다. `.env.example`에 "`NEXT_PUBLIC_`을 붙이지 말 것(브라우저 노출)", "secret/service_role 키는 RLS를 무시하므로 넣지 말 것"까지 적혀 있어 인상적이었어요.
  - `lib/*` 파일 맨 위의 `import "server-only"` 덕분에 화면 코드에서 DB 코드를 불러오면 빌드가 실패합니다. 로그인 세션은 `httpOnly` 쿠키라 브라우저 스크립트가 읽을 수 없습니다.
- 사용자 입력값 검증 등 기본 보안 사항 확인
  - 서버에서 한 번 더 검사합니다 ([lib/todos.js](lib/todos.js) `parseNewTodo`): 빈 제목 거부, 제목 200자·태그 20자·태그 5개 제한, 날짜 형식(`isValidDate`) 확인, 태그 중복 제거.
  - id는 양의 정수만 받고([app/api/todos/[id]/route.js](app/api/todos/%5Bid%5D/route.js) `parseId`), `completed`는 true/false만 허용합니다.
  - DB 오류의 자세한 내용은 서버 로그에만 남기고 화면에는 일반 문구만 보냅니다 (`dbError`).
  - RLS: 세 표 모두 `auth.uid() = user_id` 정책 → 다른 사용자의 할 일 완료·삭제 시도가 404로 거부되고, A의 데이터는 그대로였습니다.

| RLS: 사용자 B가 A의 할 일 완료·삭제 시도 → 404 | 시도 후 사용자 A 화면 (변화 없음) |
|---|---|
| ![](docs/screenshots/B7-RLS-다른사용자.png) | ![](docs/screenshots/B8-RLS-A데이터그대로.png) |

- 외부 데이터/의존성 사용 시 출처와 위험 검토했는지
  - [package.json](package.json)에 의존성 버전이 고정되어 있고(`@supabase/ssr 0.12.7`, `next 16.4.3` 등) `package-lock.json`도 함께 올라가 있어 같은 버전으로 설치됩니다. PRD 2절에 각 기술의 선택 근거(무료·오픈소스)가 적혀 있습니다.

[X]  **3. 에러가 난 부분을 디버깅하여 "문제를 해결한 기록"을 남겼나요?**
- 에이전트가 만든 코드의 오류를 어떻게 발견하고 수정했는지
  - superbase에 복사에서 붙이는 항목들이 있는데 복사해서 붙이는 항목들을 누락했었고 여러번 시도 끝에 해결하였다 RLS 시험 30개 통과”)와, 인증 방식을 Auth.js → Supabase Auth로 바꾼 이유(PRD 6절)는 잘 기록되어 있습니다.
  - 👉 화면공유 설명에서 디버깅했던 경험(에러 메시지, 에이전트에게 어떻게 다시 요청했는지)을 들으면 이 항목을 O로 바꾸고 그 내용을 여기에 적겠습니다.

# 참고 링크 및 코드 개선

## 1.리뷰 시 참고한 링크가 있다면 링크와 간략한 설명을 첨부합니다.
- [Supabase - Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) : `auth.uid() = user_id` 정책이 어떻게 "내 행만" 허용하는지 확인할 때 참고했어요.
- [Supabase - Server-Side Auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs) : `@supabase/ssr`로 쿠키 기반 로그인을 서버에서 다루는 방식(이 저장소의 `lib/supabase.js`)과 비교해 봤어요.
- [OWASP - SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html) : 쿼리를 DB 함수(`rpc`)로 호출하고 값을 매개변수로 넘기는 방식이 안전한지 확인할 때 참고했어요.

## 2.리뷰를 통해 개선을 제안할 부분이 있다면 내용과 간략한 설명을 첨부합니다.
1. **디버깅 기록 남기기** : `docs/디버깅기록.md`처럼 "증상 → 원인 → 에이전트에게 다시 한 요청(프롬프트) → 결과"를 한 줄씩 남기면 3번 항목도 채워지고, 나중에 같은 에러를 만났을 때 큰 도움이 될 것 같아요.
2. **PRD 4.2 "무료 도구 제한" 문장** : "외부 클라우드 서비스에 의존하지 않아야 한다"는 문장이 길 B(Supabase) 전환과 살짝 부딪혀요. "(길 A 기준)"이라고 덧붙이면 더 깔끔할 것 같아요.
3. **길 A 코드 찾기 쉽게** : 로컬 SQLite 버전이 커밋 `2253816`에만 있어서, `path-a-sqlite` 같은 브랜치나 태그를 만들어 두면 클릭 한 번으로 볼 수 있어요.
4. **package.json 이름** : `"name": "local-todo"`인데 지금은 클라우드 버전이라, 이름을 맞춰 두면 헷갈리지 않을 것 같아요. (아주 사소한 부분이에요!)

# 총평
PRD → 길 A(로컬) → 길 B(클라우드+로그인+RLS) → 검증까지 단계마다 근거(캡처·시험 숫자)를 남긴 꼼꼼한 결과물이었어요. 특히 `server-only`, httpOnly 쿠키, `.env.example` 안내 문구처럼 "에이전트에게 보안을 어떻게 요구해야 하는지"를 많이 배웠습니다. 디버깅 과정만 기록으로 남기면 완벽할 것 같아요. 수고 많으셨어요! 🙌
