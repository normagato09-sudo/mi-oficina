-- Mi Oficina · 0010 · el Director reparte los encargos con la IA (tareas por agente)
-- Ejecútalo entero en Supabase → SQL Editor. Se puede ejecutar más de una vez. No borra nada.

-- ─────────────────────────────────────────────
-- 1) Encargos: nuevos estados y datos del reparto
-- ─────────────────────────────────────────────

-- Preguntas del Director y mis respuestas: [{ "pregunta": "…", "respuesta": "…" | null }]
alter table public.encargos add column if not exists preguntas jsonb not null default '[]'::jsonb;
-- Resumen del Director al repartir
alter table public.encargos add column if not exists nota_director text;
-- Aviso cuando algo falla (p. ej. límite de la IA): el encargo se ve en rojo con "Reintentar"
alter table public.encargos add column if not exists aviso text;
-- Cola automática: cuándo puede continuar (null = nadie debe tocarlo), hasta cuándo lo está
-- procesando una ejecución, y reintentos por límite de la IA
alter table public.encargos add column if not exists reintentar_en timestamptz;
alter table public.encargos add column if not exists paso_hasta timestamptz;
alter table public.encargos add column if not exists reintentos smallint not null default 0;

alter table public.encargos drop constraint if exists encargos_estado_check;
alter table public.encargos
  add constraint encargos_estado_check check (estado in (
    'en_cola', 'en_curso', 'esperando_respuesta', 'repartido', 'error', 'terminado', 'cancelado'
  ));

-- ─────────────────────────────────────────────
-- 2) Tareas: una por agente y encargo
-- ─────────────────────────────────────────────

create table if not exists public.tareas (
  id              uuid primary key default gen_random_uuid(),
  encargo_id      uuid not null references public.encargos(id) on delete cascade,
  agente_id       uuid not null references public.agentes(id) on delete cascade,
  instrucciones   text not null default '',
  estado          text not null default 'pendiente',
  resultado       text not null default '',
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

alter table public.tareas drop constraint if exists tareas_estado_check;
alter table public.tareas
  add constraint tareas_estado_check check (estado in ('pendiente', 'en_curso', 'terminada', 'error'));

create index if not exists tareas_agente_idx on public.tareas (agente_id, estado, creado_en);
create index if not exists tareas_encargo_idx on public.tareas (encargo_id);

drop trigger if exists tareas_actualizado_en on public.tareas;
create trigger tareas_actualizado_en
  before update on public.tareas
  for each row execute function public.tocar_actualizado_en();

-- Igual que el resto: RLS activado y sin políticas; solo el servidor (service_role) accede.
alter table public.tareas enable row level security;
grant all privileges on public.tareas to service_role;

-- ─────────────────────────────────────────────
-- 3) La cola, de uno en uno
-- ─────────────────────────────────────────────

-- Si no hay ningún encargo en curso (ni en error), pasa el primero de la cola a "en curso"
-- (urgentes primero) y devuelve su id; si no, null. El cerrojo evita que dos ejecuciones
-- a la vez empiecen dos encargos.
create or replace function public.empezar_siguiente_encargo()
returns uuid
language plpgsql
set search_path = public
as $$
declare
  siguiente uuid;
begin
  perform pg_advisory_xact_lock(hashtext('mi_oficina_cola'));
  if exists (select 1 from public.encargos where estado in ('en_curso', 'error')) then
    return null;
  end if;
  select id into siguiente
    from public.encargos
   where estado = 'en_cola'
   order by urgente desc, orden, id
   limit 1
   for update;
  if siguiente is null then
    return null;
  end if;
  update public.encargos
     set estado = 'en_curso', reintentar_en = now(), paso_hasta = null, reintentos = 0, aviso = null
   where id = siguiente;
  return siguiente;
end $$;

revoke all on function public.empezar_siguiente_encargo() from public, anon, authenticated;
grant execute on function public.empezar_siguiente_encargo() to service_role;
