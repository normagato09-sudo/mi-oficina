-- Mi Oficina · 0015 · proyectos (trabajos grandes) y el plan del Director
-- Ejecútalo entero en Supabase → SQL Editor. Se puede ejecutar más de una vez y no borra nada.
-- Las "organizaciones" (CIFA, Defensem…) siguen en la tabla "edificios": solo cambia el nombre que se ve.

-- ─────────────────────────────────────────────
-- 1) Proyectos
-- ─────────────────────────────────────────────

create table if not exists public.proyectos (
  id              uuid primary key default gen_random_uuid(),
  -- Organización del proyecto (tabla edificios)
  edificio_id     uuid not null references public.edificios(id),
  -- El Director que hace el plan
  director_id     uuid references public.agentes(id) on delete set null,
  nombre          text not null,
  -- Qué quiero conseguir
  objetivo        text not null default '',
  fecha_limite    date,
  notas           text not null default '',
  -- Los mismos adjuntos que los encargos: [{ "tipo": "imagen" | "pdf", … }]
  adjuntos        jsonb not null default '[]'::jsonb,
  estado          text not null default 'borrador',
  -- El plan actual del Director (fases, tareas, resumen…) y las versiones anteriores
  -- con los cambios que pedí: [{ "plan": {…}, "cambios": "…", "guardado_en": "…" }]
  plan            jsonb,
  versiones       jsonb not null default '[]'::jsonb,
  -- Cambios que he pedido y el Director aún no ha aplicado
  cambios_pedidos text,
  -- Preguntas del Director y mis respuestas: [{ "pregunta": "…", "respuesta": "…" | null }]
  preguntas       jsonb not null default '[]'::jsonb,
  -- 0 a 100 (se usará en la fase siguiente)
  progreso        smallint not null default 0,
  -- Cuándo aprobé el plan: da el turno de los que esperan y enciende la luz verde del Director
  aprobado_en     timestamptz,
  -- Cola automática, igual que los encargos: aviso si algo falla, cuándo puede continuar
  -- (null = nadie debe tocarlo), hasta cuándo lo procesa una ejecución y reintentos por límite de la IA
  aviso           text,
  reintentar_en   timestamptz,
  paso_hasta      timestamptz,
  reintentos      smallint not null default 0,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

--   borrador (el Director hace el plan) · esperando_respuesta (me ha preguntado algo)
--   · plan_revision (plan para revisar) · aprobado · en_espera (ya hay 3 en marcha)
--   · en_marcha · terminado · cancelado
alter table public.proyectos drop constraint if exists proyectos_estado_check;
alter table public.proyectos
  add constraint proyectos_estado_check check (estado in (
    'borrador', 'esperando_respuesta', 'plan_revision', 'aprobado', 'en_espera', 'en_marcha', 'terminado', 'cancelado'
  ));

alter table public.proyectos drop constraint if exists proyectos_progreso_check;
alter table public.proyectos add constraint proyectos_progreso_check check (progreso between 0 and 100);

create index if not exists proyectos_estado_idx on public.proyectos (estado, aprobado_en);
create index if not exists proyectos_edificio_idx on public.proyectos (edificio_id);

drop trigger if exists proyectos_actualizado_en on public.proyectos;
create trigger proyectos_actualizado_en
  before update on public.proyectos
  for each row execute function public.tocar_actualizado_en();

-- Igual que el resto: RLS activado y sin políticas; solo el servidor (service_role) accede.
alter table public.proyectos enable row level security;
grant all privileges on public.proyectos to service_role;

-- ─────────────────────────────────────────────
-- 2) Máximo 3 proyectos a la vez (plan aprobado o en marcha)
-- ─────────────────────────────────────────────

-- Si hay hueco, los que esperan pasan a "plan aprobado", por turno (el primero que aprobé).
-- Devuelve cuántos han avanzado. El cerrojo evita que dos ejecuciones a la vez se pasen de 3.
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
    select count(*) into ocupados from public.proyectos where estado in ('aprobado', 'en_marcha');
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

-- Aprueba el plan de un proyecto que está "para revisar": pasa a "plan aprobado" o, si ya hay 3,
-- a "en espera". Devuelve el estado nuevo, o null si el proyecto ya no estaba para revisar.
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
  select count(*) into ocupados from public.proyectos where estado in ('aprobado', 'en_marcha');
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
