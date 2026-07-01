-- ===========================================================================
-- Nutveo · Tablas OPCIONALES de los módulos Productos / Recetas / Entreno
-- ---------------------------------------------------------------------------
-- IMPORTANTE: la app YA FUNCIONA sin esto:
--   · Productos -> Open Food Facts (en vivo) + se añaden a tu diario (tabla meals)
--   · Recetas   -> vienen incluidas en la app y se calculan en el cliente
--   · Entreno   -> base de ejercicios pública + tus series ya se guardan (tabla lifts)
--
-- Ejecuta este script SOLO si en el futuro quieres guardar/compartir en la nube:
-- catálogo propio de productos, recetas personalizadas o rutinas guardadas.
-- Pégalo entero en Supabase -> SQL Editor -> Run.
-- ===========================================================================

-- ---------- OBJETIVO 1: catálogo de productos ----------
create table if not exists productos_mercado (
  id uuid primary key default gen_random_uuid(),
  codigo_barras       text unique,
  nombre              text not null,
  marca               text,
  imagen_url          text,
  kcal_100g           numeric,
  proteinas_100g      numeric,
  carbohidratos_100g  numeric,
  grasas_100g         numeric,
  fuente              text default 'openfoodfacts',
  created_at          timestamptz default now()
);
create index if not exists idx_productos_nombre
  on productos_mercado using gin (to_tsvector('spanish', nombre));

-- ---------- OBJETIVO 2: recetas ----------
create table if not exists recetas (
  id uuid primary key default gen_random_uuid(),
  titulo       text not null,
  descripcion  text,
  pasos        text[],
  imagen_path  text,
  comida       text,
  owner_id     uuid references auth.users on delete cascade,  -- null = pública
  created_at   timestamptz default now()
);

create table if not exists receta_ingredientes (
  id            uuid primary key default gen_random_uuid(),
  receta_id     uuid not null references recetas(id)           on delete cascade,
  producto_id   uuid          references productos_mercado(id) on delete set null,
  nombre        text,
  rol           text not null default 'free',  -- protein | carb | fat | free
  peso_relativo numeric default 1,
  gramos_fijos  numeric,
  unique (receta_id, producto_id)
);

-- ---------- OBJETIVO 3: ejercicios y rutinas ----------
create table if not exists ejercicios (
  id uuid primary key default gen_random_uuid(),
  nombre         text not null,
  grupo_muscular text,
  equipamiento   text,
  instrucciones  text[],
  url_media      text,
  externo_id     text,
  created_at     timestamptz default now()
);

create table if not exists rutinas (
  id uuid primary key default gen_random_uuid(),
  nombre     text not null,
  objetivo   text,
  dificultad text,
  owner_id   uuid references auth.users on delete cascade,  -- null = plantilla pública
  created_at timestamptz default now()
);

create table if not exists rutina_ejercicios (
  id uuid primary key default gen_random_uuid(),
  rutina_id    uuid not null references rutinas(id)    on delete cascade,
  ejercicio_id uuid not null references ejercicios(id) on delete cascade,
  orden        int default 0,
  series       int,
  repeticiones text,
  descanso_seg int,
  unique (rutina_id, ejercicio_id, orden)
);

-- ===========================================================================
-- SEGURIDAD (RLS)
-- ===========================================================================
alter table productos_mercado    enable row level security;
alter table recetas              enable row level security;
alter table receta_ingredientes  enable row level security;
alter table ejercicios           enable row level security;
alter table rutinas              enable row level security;
alter table rutina_ejercicios    enable row level security;

-- Catálogos compartidos: lectura para autenticados; escritura para autenticados.
create policy "read productos"  on productos_mercado for select using (auth.role() = 'authenticated');
create policy "write productos" on productos_mercado for insert with check (auth.role() = 'authenticated');
create policy "read ejercicios"  on ejercicios for select using (auth.role() = 'authenticated');
create policy "write ejercicios" on ejercicios for insert with check (auth.role() = 'authenticated');

-- Recetas: públicas (owner null) o propias.
create policy "read recetas"  on recetas for select using (owner_id is null or owner_id = auth.uid());
create policy "crud recetas"  on recetas for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "read ri"       on receta_ingredientes for select using (auth.role() = 'authenticated');
create policy "crud ri"       on receta_ingredientes for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Rutinas: plantillas públicas o propias.
create policy "read rutinas" on rutinas for select using (owner_id is null or owner_id = auth.uid());
create policy "crud rutinas" on rutinas for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "read re"  on rutina_ejercicios for select using (auth.role() = 'authenticated');
create policy "crud re"  on rutina_ejercicios for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ===========================================================================
-- HISTORIAL DE EJERCICIOS y RUTINAS PERSONALIZADAS (sistema propio del usuario)
-- ===========================================================================
create table if not exists historial_ejercicios (
  id uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users on delete cascade,
  fecha     date not null,
  ejercicio text not null,
  peso_kg   numeric,
  series    int,
  reps      int,
  created_at timestamptz default now()
);
create index if not exists idx_hist_user_ej on historial_ejercicios(user_id, ejercicio, fecha);

create table if not exists rutinas_personalizadas (
  id uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  nombre     text not null,
  ejercicios jsonb default '[]',   -- [{nombre, muscle}]
  created_at timestamptz default now()
);

alter table historial_ejercicios    enable row level security;
alter table rutinas_personalizadas   enable row level security;
create policy "own hist"     on historial_ejercicios  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rutinas"  on rutinas_personalizadas for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
