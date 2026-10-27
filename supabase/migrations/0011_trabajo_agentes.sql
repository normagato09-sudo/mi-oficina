-- Mi Oficina · 0011 · los agentes hacen sus tareas y el Director las revisa
-- Ejecútalo entero en Supabase → SQL Editor. Se puede ejecutar más de una vez. No borra nada.

-- ─────────────────────────────────────────────
-- 1) Tareas: resultado, notas, revisión y cola
-- ─────────────────────────────────────────────

-- Resultado estructurado del agente: { "tipo": "<despacho>", "datos": { … } }
alter table public.tareas add column if not exists resultado_json jsonb;
-- Nota corta del agente (qué ha hecho y por qué) y nota del Director para la CEO
alter table public.tareas add column if not exists nota_agente text;
alter table public.tareas add column if not exists nota_director text;
-- Comentarios del Director cuando le devuelve el trabajo al agente para que lo rehaga
alter table public.tareas add column if not exists comentarios text;
-- Cuántas veces se ha devuelto (máximo 2; a la tercera se queda como está)
alter table public.tareas add column if not exists vueltas smallint not null default 0;
-- Igual que en los encargos: aviso si falla, cuándo puede continuar, quién la procesa y reintentos
alter table public.tareas add column if not exists aviso text;
alter table public.tareas add column if not exists reintentar_en timestamptz;
alter table public.tareas add column if not exists paso_hasta timestamptz;
alter table public.tareas add column if not exists reintentos smallint not null default 0;

-- pendiente → en_curso (el agente trabaja) → revision → revisando (el Director revisa)
--   → revisada (bien, o a la tercera vuelta) → lista (todo el encargo revisado: te necesita)
alter table public.tareas drop constraint if exists tareas_estado_check;
alter table public.tareas
  add constraint tareas_estado_check check (estado in (
    'pendiente', 'en_curso', 'revision', 'revisando', 'revisada', 'lista', 'error'
  ));

-- De una en una (para no pasarnos del límite de Groq): la base de datos no deja que haya dos tareas
-- trabajándose o revisándose a la vez, aunque dos ejecuciones lo intenten al mismo tiempo.
-- Antes, las que se quedaron a medias (su ejecución ya terminó) vuelven a su paso anterior.
update public.tareas
   set estado = case estado when 'en_curso' then 'pendiente' else 'revision' end, paso_hasta = null
 where estado in ('en_curso', 'revisando')
   and (paso_hasta is null or paso_hasta < now());
create unique index if not exists tareas_una_a_la_vez
  on public.tareas ((true))
  where estado in ('en_curso', 'revisando');

-- ─────────────────────────────────────────────
-- 2) Encargos: "listo para revisar" cuando todas sus tareas están revisadas
-- ─────────────────────────────────────────────

alter table public.encargos drop constraint if exists encargos_estado_check;
alter table public.encargos
  add constraint encargos_estado_check check (estado in (
    'en_cola', 'en_curso', 'esperando_respuesta', 'repartido', 'listo_revision', 'error', 'terminado', 'cancelado'
  ));

-- ─────────────────────────────────────────────
-- 3) Avisos de los encargos (la campana)
-- ─────────────────────────────────────────────

alter table public.avisos add column if not exists encargo_id uuid references public.encargos(id) on delete cascade;

-- ─────────────────────────────────────────────
-- 4) La cola: mientras los agentes trabajan en un encargo (repartido), no se empieza otro
-- ─────────────────────────────────────────────

create or replace function public.empezar_siguiente_encargo()
returns uuid
language plpgsql
set search_path = public
as $$
declare
  siguiente uuid;
begin
  perform pg_advisory_xact_lock(hashtext('mi_oficina_cola'));
  if exists (select 1 from public.encargos where estado in ('en_curso', 'repartido', 'error')) then
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
