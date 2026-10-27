-- Mi Oficina · 0012 · la CEO revisa y aprueba los trabajos, y los agentes aprenden
-- Ejecútalo entero en Supabase → SQL Editor. Se puede ejecutar más de una vez. No borra nada.

-- ─────────────────────────────────────────────
-- 1) Tareas: aprobar, editar y pedir cambios
-- ─────────────────────────────────────────────

-- Cuándo la aprobé (el agente se ve en verde hasta que vuelvo a abrir su ficha)
alter table public.tareas add column if not exists aprobada_en timestamptz;
-- La versión del agente antes de que yo la editara (para aprender de mis cambios)
alter table public.tareas add column if not exists resultado_agente jsonb;
alter table public.tareas add column if not exists resultado_agente_texto text;
-- Mi texto editado, cuando el resultado no tiene campos propios (código, informes…)
alter table public.tareas add column if not exists texto_editado text;
-- Mi comentario al pedir cambios (el agente lo tiene en cuenta al rehacerla)
alter table public.tareas add column if not exists comentario_ceo text;

alter table public.tareas drop constraint if exists tareas_estado_check;
alter table public.tareas
  add constraint tareas_estado_check check (estado in (
    'pendiente', 'en_curso', 'revision', 'revisando', 'revisada', 'lista', 'aprobada', 'error'
  ));

create index if not exists tareas_aprobadas_idx on public.tareas (agente_id, aprobada_en desc) where estado = 'aprobada';

-- ─────────────────────────────────────────────
-- 2) Aprendizajes de cada agente (por proyecto o para todos)
-- ─────────────────────────────────────────────

create table if not exists public.aprendizajes (
  id           uuid primary key default gen_random_uuid(),
  agente_id    uuid not null references public.agentes(id) on delete cascade,
  -- null = vale para todos los proyectos
  edificio_id  uuid references public.edificios(id) on delete cascade,
  texto        text not null,
  -- De dónde sale: "edicion" (edité su resultado) o "cambios" (le pedí cambios)
  origen       text not null default 'edicion',
  tarea_id     uuid references public.tareas(id) on delete set null,
  creado_en    timestamptz not null default now()
);

alter table public.aprendizajes drop constraint if exists aprendizajes_origen_check;
alter table public.aprendizajes
  add constraint aprendizajes_origen_check check (origen in ('edicion', 'cambios'));

create index if not exists aprendizajes_agente_idx on public.aprendizajes (agente_id, creado_en desc);

-- Igual que el resto: RLS activado y sin políticas; solo el servidor (service_role) accede.
alter table public.aprendizajes enable row level security;
grant all privileges on public.aprendizajes to service_role;
