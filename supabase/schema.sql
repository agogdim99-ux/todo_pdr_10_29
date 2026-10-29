-- Todo 앱 Supabase 스키마
-- Supabase 대시보드 > SQL Editor에 전체를 붙여넣고 Run 한 번. (새 프로젝트 기준)
--
-- 보안 구조
--   * 모든 표에 user_id(소유자)를 두고 RLS를 켠다. 로그인한 사용자는 자기 행만 조회·추가·수정·삭제할 수 있다.
--   * 비로그인(anon) 역할에는 표와 함수 권한을 주지 않는다.
--   * 함수는 SECURITY INVOKER(기본값)라서 호출한 사용자 권한으로 실행되고, RLS가 그대로 적용된다.

-- ───────────────────────── 표 ─────────────────────────

create table public.todos (
  id            bigint generated always as identity primary key,
  user_id       uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  title         text        not null check (length(btrim(title)) between 1 and 200),
  completed     boolean     not null default false,
  completed_at  timestamptz,
  due_date      date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check ((completed and completed_at is not null) or (not completed and completed_at is null)),
  unique (id, user_id)  -- todo_tags가 "같은 사용자의 할 일"만 가리키도록 복합 FK에 사용
);

create table public.tags (
  id       bigint generated always as identity primary key,
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name     text not null check (length(btrim(name)) between 1 and 20),
  color    text not null check (color ~ '^#[0-9a-f]{6}$'),
  unique (id, user_id)
);

-- 태그 이름은 사용자별로 대소문자 무시 중복 불가 ("Work"와 "work"는 같은 태그)
create unique index tags_user_name_key on public.tags (user_id, lower(name));

create table public.todo_tags (
  todo_id  bigint not null,
  tag_id   bigint not null,
  user_id  uuid   not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (todo_id, tag_id),
  -- 할 일과 태그가 모두 같은 사용자 것이어야 연결 가능
  foreign key (todo_id, user_id) references public.todos (id, user_id) on delete cascade,
  foreign key (tag_id, user_id)  references public.tags (id, user_id)  on delete cascade
);

create index todos_user_due_idx       on public.todos (user_id, due_date);
create index todos_user_completed_idx on public.todos (user_id, completed);
create index todo_tags_tag_idx        on public.todo_tags (tag_id, user_id);
create index todo_tags_user_idx       on public.todo_tags (user_id);

-- 수정 시: updated_at 갱신, 완료 일시 자동 기록/삭제, 소유자 변경 금지
create function public.todos_before_update() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.user_id := old.user_id;
  if new.completed and not old.completed then
    new.completed_at := now();
  elsif not new.completed then
    new.completed_at := null;
  else
    new.completed_at := old.completed_at;
  end if;
  return new;
end;
$$;

create trigger todos_before_update
  before update on public.todos
  for each row execute function public.todos_before_update();

-- ───────────────────────── RLS ─────────────────────────

alter table public.todos     enable row level security;
alter table public.tags      enable row level security;
alter table public.todo_tags enable row level security;

create policy "todos: 본인 조회" on public.todos for select to authenticated using ((select auth.uid()) = user_id);
create policy "todos: 본인 추가" on public.todos for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "todos: 본인 수정" on public.todos for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "todos: 본인 삭제" on public.todos for delete to authenticated using ((select auth.uid()) = user_id);

create policy "tags: 본인 조회" on public.tags for select to authenticated using ((select auth.uid()) = user_id);
create policy "tags: 본인 추가" on public.tags for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "tags: 본인 수정" on public.tags for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "tags: 본인 삭제" on public.tags for delete to authenticated using ((select auth.uid()) = user_id);

create policy "todo_tags: 본인 조회" on public.todo_tags for select to authenticated using ((select auth.uid()) = user_id);
create policy "todo_tags: 본인 추가" on public.todo_tags for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "todo_tags: 본인 삭제" on public.todo_tags for delete to authenticated using ((select auth.uid()) = user_id);

-- 비로그인 역할은 아예 접근 불가 (RLS와 별도로 한 겹 더)
revoke all on public.todos, public.tags, public.todo_tags from anon;

-- ───────────────────────── 함수 (백엔드가 rpc로 호출) ─────────────────────────

-- 목록 + 개수. 조건은 모두 AND. 정렬: 미완료 먼저 → 마감일 빠른 순(없으면 뒤) → 최근 등록 순
create function public.list_todos(p_due date default null, p_tag bigint default null, p_q text default null)
returns json
language sql
stable
set search_path = ''
as $$
  select json_build_object(
    'todos', coalesce((
      select json_agg(r order by r.completed, r.due_date nulls last, r.created_at desc, r.id desc)
      from (
        select t.id, t.title, t.completed, t.completed_at, t.due_date, t.created_at, t.updated_at,
               coalesce((select json_agg(json_build_object('id', g.id, 'name', g.name, 'color', g.color) order by g.name)
                           from public.todo_tags x join public.tags g on g.id = x.tag_id
                          where x.todo_id = t.id), '[]'::json) as tags
          from public.todos t
         where t.user_id = (select auth.uid())
           and (p_due is null or t.due_date = p_due)
           and (p_tag is null or exists (select 1 from public.todo_tags x where x.todo_id = t.id and x.tag_id = p_tag))
           and (p_q is null or t.title ilike '%' || replace(replace(replace(p_q, '\', '\\'), '%', '\%'), '_', '\_') || '%')
      ) r
    ), '[]'::json),
    'total',     (select count(*) from public.todos where user_id = (select auth.uid())),
    'remaining', (select count(*) from public.todos where user_id = (select auth.uid()) and not completed)
  );
$$;

-- 할 일이 1개 이상 붙은 태그 (필터 칩용)
create function public.list_tags()
returns json
language sql
stable
set search_path = ''
as $$
  select coalesce(json_agg(r order by r.name), '[]'::json)
  from (
    select g.id, g.name, g.color, count(*) as count
      from public.tags g join public.todo_tags x on x.tag_id = g.id
     where g.user_id = (select auth.uid())
     group by g.id
  ) r;
$$;

-- 할 일 추가 + 태그 연결을 한 트랜잭션으로. 새 태그에는 안 쓰인 색을 우선 배정. 만든 할 일 id 반환
create function public.create_todo(p_title text, p_due_date date default null, p_tags text[] default '{}')
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_palette text[] := array['#e05d5d', '#e8913a', '#c99a06', '#43a047', '#00897b', '#3b82f6', '#8b5cf6', '#d9468f'];
  v_todo_id bigint;
  v_tag_id  bigint;
  v_name    text;
  v_color   text;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  insert into public.todos (title, due_date) values (btrim(p_title), p_due_date) returning id into v_todo_id;

  foreach v_name in array coalesce(p_tags, '{}') loop
    v_name := btrim(v_name);
    continue when v_name = '';

    select id into v_tag_id from public.tags where user_id = v_uid and lower(name) = lower(v_name);
    if v_tag_id is null then
      select c into v_color
        from unnest(v_palette) with ordinality as p(c, i)
       where c not in (select color from public.tags where user_id = v_uid)
       order by i limit 1;
      v_color := coalesce(v_color, v_palette[1 + (select count(*) from public.tags where user_id = v_uid)::int % 8]);
      insert into public.tags (name, color) values (v_name, v_color) returning id into v_tag_id;
    end if;

    insert into public.todo_tags (todo_id, tag_id) values (v_todo_id, v_tag_id) on conflict do nothing;
  end loop;

  return v_todo_id;
end;
$$;

-- 할 일 삭제 + 쓰이지 않게 된 본인 태그 정리. 지웠으면 true
create function public.delete_todo(p_id bigint)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_count int;
begin
  delete from public.todos where id = p_id;
  get diagnostics v_count = row_count;
  if v_count > 0 then
    delete from public.tags g
     where g.user_id = (select auth.uid())
       and not exists (select 1 from public.todo_tags x where x.tag_id = g.id);
  end if;
  return v_count > 0;
end;
$$;

revoke execute on function public.list_todos(date, bigint, text), public.list_tags(),
  public.create_todo(text, date, text[]), public.delete_todo(bigint) from public, anon;
grant execute on function public.list_todos(date, bigint, text), public.list_tags(),
  public.create_todo(text, date, text[]), public.delete_todo(bigint) to authenticated;
