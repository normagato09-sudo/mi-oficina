-- Mi Oficina · 0016 · el equipo hace los proyectos fase a fase hasta el 100 %
-- Ejecútalo entero en Supabase → SQL Editor. Se puede ejecutar más de una vez y no borra nada.

-- ─────────────────────────────────────────────
-- 1) Tareas: también de proyectos (no solo de encargos)
-- ─────────────────────────────────────────────

alter table public.tareas alter column encargo_id drop not null;
-- Proyecto, fase (0 = la primera), id de la tarea en el plan ("T1"…), su título y de qué tareas depende
alter table public.tareas add column if not exists proyecto_id uuid references public.proyectos(id) on delete cascade;
alter table public.tareas add column if not exists fase smallint;
alter table public.tareas add column if not exists clave text;
alter table public.tareas add column if not exists titulo text;
alter table public.tareas add column if not exists depende_de text[] not null default '{}';

alter table public.tareas drop constraint if exists tareas_origen_check;
alter table public.tareas add constraint tareas_origen_check check (encargo_id is not null or proyecto_id is not null);

create index if not exists tareas_proyecto_idx on public.tareas (proyecto_id, fase);
-- Una sola tarea por proyecto y clave (por si dos ejecuciones empiezan la misma fase a la vez)
create unique index if not exists tareas_proyecto_clave on public.tareas (proyecto_id, clave) where proyecto_id is not null;

-- ─────────────────────────────────────────────
-- 2) Proyectos en marcha: fase actual, tareas de la CEO, resúmenes y final
-- ─────────────────────────────────────────────

-- Fase en la que está (0 = la primera) y cómo va:
--   trabajando · resumiendo (el Director escribe el resumen) · para_revisar
--   · cambios (el Director decide qué rehacer) · final (el Director escribe el resumen final)
alter table public.proyectos add column if not exists fase_actual smallint not null default 0;
alter table public.proyectos add column if not exists fase_estado text;
alter table public.proyectos drop constraint if exists proyectos_fase_estado_check;
alter table public.proyectos
  add constraint proyectos_fase_estado_check check (fase_estado is null or fase_estado in ('trabajando', 'resumiendo', 'para_revisar', 'cambios', 'final'));
-- Por fase: [{ "resumen": "…", "cambios": ["…"], "aprobada_en": "…" }]
alter table public.proyectos add column if not exists fases jsonb not null default '[]'::jsonb;
-- Tareas para la CEO hechas: { "T4": { "hecha_en": "…", "nota": "…" } }
alter table public.proyectos add column if not exists tareas_ceo jsonb not null default '{}'::jsonb;
-- Resumen final del Director: { "hecho": "…", "entregas": ["…"], "pendiente_ceo": ["…"] }
alter table public.proyectos add column if not exists resumen_final jsonb;
alter table public.proyectos add column if not exists terminado_en timestamptz;

alter table public.proyectos drop constraint if exists proyectos_estado_check;
alter table public.proyectos
  add constraint proyectos_estado_check check (estado in (
    'borrador', 'esperando_respuesta', 'plan_revision', 'aprobado', 'en_espera', 'en_marcha', 'final_revision', 'terminado', 'cancelado'
  ));

-- Avisos de la campana también para los proyectos
alter table public.avisos add column if not exists proyecto_id uuid references public.proyectos(id) on delete cascade;

-- ─────────────────────────────────────────────
-- 3) Máximo 3 a la vez: plan aprobado, en marcha o con el final para revisar
-- ─────────────────────────────────────────────

create or replace function public.rellenar_huecos_proyectos()
returns integer
language plpgsql
set search_path = public
as $$
declare
  ocupados integer;
  siguiente uuid;
  movidos integer := 0;
begin
  perform pg_advisory_xact_lock(hashtext('mi_oficina_proyectos'));
  loop
    select count(*) into ocupados from public.proyectos where estado in ('aprobado', 'en_marcha', 'final_revision');
    exit when ocupados >= 3;
    select id into siguiente
      from public.proyectos
     where estado = 'en_espera'
     order by aprobado_en, creado_en, id
     limit 1
     for update;
    exit when siguiente is null;
    update public.proyectos set estado = 'aprobado' where id = siguiente;
    movidos := movidos + 1;
  end loop;
  return movidos;
end $$;

create or replace function public.aprobar_plan_proyecto(p_id uuid)
returns text
language plpgsql
set search_path = public
as $$
declare
  ocupados integer;
  nuevo text;
begin
  perform pg_advisory_xact_lock(hashtext('mi_oficina_proyectos'));
  perform 1 from public.proyectos where id = p_id and estado = 'plan_revision' for update;
  if not found then
    return null;
  end if;
  select count(*) into ocupados from public.proyectos where estado in ('aprobado', 'en_marcha', 'final_revision');
  nuevo := case when ocupados >= 3 then 'en_espera' else 'aprobado' end;
  update public.proyectos
     set estado = nuevo, aprobado_en = now(), aviso = null, reintentar_en = null, paso_hasta = null
   where id = p_id;
  return nuevo;
end $$;

revoke all on function public.rellenar_huecos_proyectos() from public, anon, authenticated;
grant execute on function public.rellenar_huecos_proyectos() to service_role;
revoke all on function public.aprobar_plan_proyecto(uuid) from public, anon, authenticated;
grant execute on function public.aprobar_plan_proyecto(uuid) to service_role;

-- ─────────────────────────────────────────────
-- 4) Un solo trabajo de IA a la vez (encargos y proyectos), para no pasar el límite de Groq
-- ─────────────────────────────────────────────

create table if not exists public.turno_ia (
  id      smallint primary key default 1 check (id = 1),
  dueno   uuid,
  hasta   timestamptz
);
insert into public.turno_ia (id) values (1) on conflict (id) do nothing;
alter table public.turno_ia enable row level security;
grant all privileges on public.turno_ia to service_role;

-- Toma el turno durante p_segundos si está libre (o caducado). Devuelve true si es tuyo.
create or replace function public.tomar_turno_ia(p_dueno uuid, p_segundos integer)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  update public.turno_ia
     set dueno = p_dueno, hasta = now() + make_interval(secs => p_segundos)
   where id = 1 and (hasta is null or hasta < now() or dueno = p_dueno);
  return found;
end $$;

create or replace function public.soltar_turno_ia(p_dueno uuid)
returns void
language sql
set search_path = public
as $$
  update public.turno_ia set dueno = null, hasta = null where id = 1 and dueno = p_dueno;
$$;

revoke all on function public.tomar_turno_ia(uuid, integer) from public, anon, authenticated;
grant execute on function public.tomar_turno_ia(uuid, integer) to service_role;
revoke all on function public.soltar_turno_ia(uuid) from public, anon, authenticated;
grant execute on function public.soltar_turno_ia(uuid) to service_role;
