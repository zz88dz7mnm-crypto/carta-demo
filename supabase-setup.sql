-- Levels Bar — tablas necesarias en Supabase.
-- Pegar este archivo entero en el SQL Editor de Supabase y darle "Run".
-- Se puede correr una sola vez (usa "if not exists", no rompe nada si ya existe).

create table if not exists menu_state (
  id integer primary key check (id = 1),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists admin_users (
  id bigint generated always as identity primary key,
  username text not null unique,
  password_hash text not null,
  salt text not null,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  token text primary key,
  user_id bigint not null references admin_users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists sessions_user_id_idx on sessions (user_id);
create index if not exists sessions_expires_at_idx on sessions (expires_at);
