-- ===========================================================================
-- Nutveo · Esquema de base de datos para Supabase
-- Pega TODO esto en: Supabase → SQL Editor → New query → Run.
-- Crea las tablas, la seguridad por usuario (RLS) y el sistema de ligas.
-- ===========================================================================

-- ---------- PERFIL (privado: solo lo ve su dueño) ----------
create table if not exists profiles (
  user_id uuid primary key references auth.users on delete cascade,
  sex text, age int, height numeric, weight numeric,
  activity text, goal text, training_days int default 3,
  goals jsonb, onboarded boolean default false,
  routine jsonb, -- personalizacion de la rutina (ejercicios propios/ocultos)
  is_premium boolean default false,
  premium_since timestamptz,
  checkout_id text,
  updated_at timestamptz default now()
);
-- Si ya creaste la tabla antes, ejecuta estas lineas para anadir las columnas:
alter table profiles add column if not exists routine jsonb;
alter table profiles add column if not exists is_premium boolean default false;
alter table profiles add column if not exists premium_since timestamptz;
alter table profiles add column if not exists checkout_id text;

-- ---------- COMIDAS ----------
create table if not exists meals (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  date date not null, name text, slot text,
  calories numeric, protein numeric, carbs numeric, fat numeric, source text
);
create index if not exists meals_user_date on meals(user_id, date);

-- ---------- PESO CORPORAL (un valor por día) ----------
create table if not exists weights (
  user_id uuid not null references auth.users on delete cascade,
  date date not null, kg numeric not null,
  primary key (user_id, date)
);

-- ---------- REGISTROS DE FUERZA ----------
create table if not exists lifts (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  date date not null, exercise text not null, kg numeric, reps int
);
create index if not exists lifts_user_ex on lifts(user_id, exercise);

-- ---------- SESIONES DE ENTRENO ----------
create table if not exists sessions (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  date date not null, focus text
);

-- ---------- STATS PÚBLICAS (para el leaderboard) ----------
create table if not exists public_stats (
  user_id uuid primary key references auth.users on delete cascade,
  username text, rank_index int default 0, rank_label text,
  score numeric default 0, bodyweight numeric, sessions_total int default 0,
  updated_at timestamptz default now()
);

-- ---------- LIGAS ----------
create table if not exists leagues (
  id uuid primary key default gen_random_uuid(),
  code text unique not null, name text not null,
  owner_id uuid references auth.users on delete set null,
  created_at timestamptz default now()
);
create table if not exists league_members (
  league_id uuid references leagues on delete cascade,
  user_id uuid references auth.users on delete cascade,
  primary key (league_id, user_id)
);

-- ---------- FUNCIÓN SEGURA para unirse a una liga por código ----------
-- Valida el código antes de insertar. Sin esta función, cualquier usuario
-- autenticado podría insertarse directamente en league_members con cualquier
-- league_id, saltándose la validación del código.
create or replace function join_league_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_league_id uuid;
begin
  select id into v_league_id from leagues where upper(code) = upper(p_code);
  if v_league_id is null then
    raise exception 'Código de liga no válido';
  end if;
  insert into league_members (league_id, user_id)
  values (v_league_id, auth.uid())
  on conflict (league_id, user_id) do nothing;
  return v_league_id;
end;
$$;

-- ===========================================================================
-- ROW LEVEL SECURITY
-- ===========================================================================
alter table profiles      enable row level security;
alter table meals         enable row level security;
alter table weights       enable row level security;
alter table lifts         enable row level security;
alter table sessions      enable row level security;
alter table public_stats  enable row level security;
alter table leagues       enable row level security;
alter table league_members enable row level security;

-- Datos privados: cada usuario solo accede a lo suyo.
drop policy if exists "own profiles"  on profiles;
create policy "own profiles"  on profiles  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own meals"     on meals;
create policy "own meals"     on meals     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own weights"   on weights;
create policy "own weights"   on weights   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own lifts"     on lifts;
create policy "own lifts"     on lifts     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own sessions"  on sessions;
create policy "own sessions"  on sessions  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Stats públicas: cualquiera autenticado las LEE (leaderboard); solo el dueño escribe.
drop policy if exists "read stats"    on public_stats;
create policy "read stats"    on public_stats for select using (auth.role() = 'authenticated');
drop policy if exists "write stats"   on public_stats;
create policy "write stats"   on public_stats for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Ligas: cualquiera autenticado lee y crea; membresías propias.
drop policy if exists "read leagues"  on leagues;
create policy "read leagues"  on leagues for select using (auth.role() = 'authenticated');
drop policy if exists "create leagues" on leagues;
create policy "create leagues" on leagues for insert with check (auth.uid() = owner_id);
drop policy if exists "read members"  on league_members;
create policy "read members"  on league_members for select using (auth.role() = 'authenticated');
-- Las inserciones directas en league_members están deshabilitadas.
-- Solo se puede unir a una liga mediante la función join_league_by_code(code),
-- que valida que el código de la liga existe antes de insertar.
drop policy if exists "leave leagues" on league_members;
create policy "leave leagues" on league_members for delete using (auth.uid() = user_id);
