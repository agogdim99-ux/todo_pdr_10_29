-- schema.sql이 중간에 멈췄을 때 처음 상태로 되돌리는 스크립트.
-- 주의: 이 앱의 표 3개와 그 안의 할 일 데이터가 모두 삭제된다. (로그인 계정 auth.users는 그대로)
-- 실행 후 schema.sql을 다시 실행한다.

drop function if exists public.list_todos(date, bigint, text);
drop function if exists public.list_tags();
drop function if exists public.create_todo(text, date, text[]);
drop function if exists public.delete_todo(bigint);
drop table if exists public.todo_tags;
drop table if exists public.tags;
drop table if exists public.todos;
drop function if exists public.todos_before_update();
