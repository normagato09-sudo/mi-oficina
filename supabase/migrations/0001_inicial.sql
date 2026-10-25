-- Mi Oficina · migración inicial
-- Ejecútalo entero en Supabase → SQL Editor. Se puede ejecutar más de una vez sin duplicar datos.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────
-- Tablas
-- ─────────────────────────────────────────────

create table if not exists public.edificios (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  color      text not null default '#298D3B',
  creado_en  timestamptz not null default now()
);

create table if not exists public.departamentos (
  id           uuid primary key default gen_random_uuid(),
  edificio_id  uuid not null references public.edificios(id) on delete cascade,
  nombre       text not null,
  orden        integer not null default 0
);
create index if not exists departamentos_edificio_idx on public.departamentos (edificio_id, orden);

create table if not exists public.agentes (
  id               uuid primary key default gen_random_uuid(),
  departamento_id  uuid not null references public.departamentos(id) on delete cascade,
  nombre           text not null,
  tipo             text not null default 'redes' check (tipo in ('redes')),
  instrucciones    text not null default '',
  creado_en        timestamptz not null default now()
);
create index if not exists agentes_departamento_idx on public.agentes (departamento_id);

create table if not exists public.publicaciones (
  id                  uuid primary key default gen_random_uuid(),
  agente_id           uuid not null references public.agentes(id) on delete cascade,
  estado              text not null default 'preparando'
                        check (estado in ('preparando', 'lista', 'publicando', 'publicada', 'error')),
  texto_original      text not null default '',
  notas               text not null default '',
  caption             text,
  imagenes            jsonb not null default '[]'::jsonb,
  instagram_media_id  text,
  permalink           text,
  error               text,
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now()
);
create index if not exists publicaciones_agente_idx on public.publicaciones (agente_id, creado_en desc);
create index if not exists publicaciones_estado_idx on public.publicaciones (estado);

create table if not exists public.avisos (
  id              uuid primary key default gen_random_uuid(),
  publicacion_id  uuid references public.publicaciones(id) on delete cascade,
  mensaje         text not null,
  leido           boolean not null default false,
  creado_en       timestamptz not null default now()
);
create index if not exists avisos_leido_idx on public.avisos (leido, creado_en desc);

-- actualizado_en automático
create or replace function public.tocar_actualizado_en()
returns trigger language plpgsql as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists publicaciones_actualizado_en on public.publicaciones;
create trigger publicaciones_actualizado_en
  before update on public.publicaciones
  for each row execute function public.tocar_actualizado_en();

-- ─────────────────────────────────────────────
-- Seguridad: RLS activado y sin políticas.
-- Solo el servidor (clave secreta → rol service_role) accede a los datos.
-- ─────────────────────────────────────────────

alter table public.edificios     enable row level security;
alter table public.departamentos enable row level security;
alter table public.agentes       enable row level security;
alter table public.publicaciones enable row level security;
alter table public.avisos        enable row level security;

grant usage on schema public to service_role;
grant all privileges on all tables    in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all functions in schema public to service_role;

alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;

-- ─────────────────────────────────────────────
-- Semilla
-- ─────────────────────────────────────────────

insert into public.edificios (id, nombre, color)
values ('00000000-0000-4000-8000-000000000001', 'DEFENSEM L''EMPORDANET', '#298D3B')
on conflict (id) do nothing;

insert into public.departamentos (id, edificio_id, nombre, orden)
values ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000001', 'Marketing', 1)
on conflict (id) do nothing;

insert into public.agentes (id, departamento_id, nombre, tipo, instrucciones)
values (
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000011',
  'Redes sociales',
  'redes',
  $instr$Eres el agente de Redes sociales de DEFENSEM L'EMPORDANET, una iniciativa ciudadana del Empordanet. Preparas publicaciones de Instagram en catalán, con un tono cercano, claro y respetuoso. Reglas: nunca inventes cifras, datos, estudios, fechas ni declaraciones; si te falta un dato, no lo pongas. Si te pasan un texto, respeta su significado y solo mejora la forma. Máximo 2.200 caracteres. Termina con entre 3 y 8 hashtags relevantes, incluyendo siempre #DefensemLEmpordanet. Si procede, invita a firmar la petición con "Enllaç a la bio". Sin emojis excesivos (máximo 3).$instr$
)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────
-- Storage: bucket público (Meta descarga las imágenes desde su URL pública)
-- ─────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('publicaciones', 'publicaciones', true, 10485760, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
