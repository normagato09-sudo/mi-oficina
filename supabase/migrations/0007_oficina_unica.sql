-- Mi Oficina · 0007 · una sola oficina (mi equipo) que trabaja para varios proyectos
-- Ejecútalo entero en Supabase → SQL Editor. Se puede ejecutar más de una vez.
-- No borra nada: los proyectos y agentes que ya no se usan solo se ocultan (activo = false),
-- y lo que edites después (fichas, perfiles, activo) no se vuelve a pisar.

-- ─────────────────────────────────────────────
-- 1) Proyectos (la tabla edificios): nombre, color, idioma, ficha y su cuenta de Instagram
-- ─────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'edificios' and column_name = 'activo'
  ) then
    alter table public.edificios add column activo boolean not null default true;
    -- Solo la primera vez: de momento solo trabajamos para CIFA; Defensem queda oculto.
    update public.edificios set activo = false where id = '00000000-0000-4000-8000-000000000001';
  end if;
end $$;

-- Cuenta de Instagram del proyecto (se rellenará más adelante)
alter table public.edificios add column if not exists instagram text;

-- ─────────────────────────────────────────────
-- 2) Equipo: los agentes pasan a ser de la oficina (despacho), no de un proyecto
-- ─────────────────────────────────────────────

alter table public.agentes alter column departamento_id drop not null;

alter table public.agentes drop constraint if exists agentes_tipo_check;
alter table public.agentes
  add constraint agentes_tipo_check
  check (tipo in ('redes', 'direccion', 'comunicacion', 'administracion', 'rrhh', 'traduccion'));

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'agentes' and column_name = 'despacho'
  ) then
    alter table public.agentes add column despacho text;
    -- Solo la primera vez: se ocultan todos menos el Director (el de CIFA) e Instagram…
    update public.agentes
       set activo = false
     where id not in ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000101');
    -- …que se mudan a su despacho de la oficina.
    update public.agentes
       set despacho = 'direccion', departamento_id = null, activo = true
     where id = '00000000-0000-4000-8000-000000000201';
    update public.agentes
       set despacho = 'redes', departamento_id = null, activo = true
     where id = '00000000-0000-4000-8000-000000000101';
  end if;
end $$;

alter table public.agentes drop constraint if exists agentes_despacho_check;
alter table public.agentes
  add constraint agentes_despacho_check
  check (despacho is null or despacho in ('direccion', 'redes', 'traduccion'));

-- Director e Instagram (por si se hubieran borrado) y el Traductor, nuevo
insert into public.agentes (id, departamento_id, despacho, nombre, tipo, activo, instrucciones)
values
  (
    '00000000-0000-4000-8000-000000000201',
    null,
    'direccion',
    'Director',
    'direccion',
    true,
    ''
  ),
  (
    '00000000-0000-4000-8000-000000000101',
    null,
    'redes',
    'Instagram',
    'redes',
    true,
    ''
  ),
  (
    '00000000-0000-4000-8000-000000000301',
    null,
    'traduccion',
    'Traductor',
    'traduccion',
    true,
    $instr$Eres el traductor y corrector de la oficina. Traduces textos entre español, catalán e inglés y corriges las faltas de ortografía y de gramática. Devuelves el texto corregido o traducido y, debajo, una lista corta de lo que has cambiado. Respetas el significado y el tono del original y no añades nada que no estuviera.$instr$
  )
on conflict (id) do nothing;

-- Perfiles: solo se sustituyen los textos de las migraciones anteriores (o vacíos), nunca los editados después.
update public.agentes
   set instrucciones = $instr$Eres el Director de la oficina. Trabajas para varios proyectos, como si fueran clientes. Recibes los encargos, los ordenas en tu cola y los atiendes de uno en uno: primero los urgentes y después por orden de llegada. De cada encargo lees la ficha de su proyecto, decides qué agente del equipo debe encargarse (Instagram, Traductor…) y le pasas el trabajo con instrucciones claras y concretas. Revisas todo antes de entregarlo: que los datos sean exactos y que el idioma y el tono sean los del proyecto. Nunca inventas cifras, fechas, nombres ni datos; si falta algo, lo pides. Escribes informes breves y claros.$instr$
 where id = '00000000-0000-4000-8000-000000000201'
   and (instrucciones = '' or instrucciones like 'Eres el director de CIFA. Eres experto en gestión de organizaciones educativas%');

update public.agentes
   set instrucciones = $instr$Eres community manager especialista en Instagram y publicas en la cuenta de Instagram del proyecto de cada encargo. Sigues siempre la ficha de ese proyecto: idioma, tono, hashtags y llamada a la acción. Escribes textos cortos y con gancho: la primera frase tiene que llamar la atención. Dominas los hashtags y los formatos (publicación, carrusel, reels, historias). Nunca inventas cifras, fechas, nombres ni datos.$instr$
 where id = '00000000-0000-4000-8000-000000000101'
   and (instrucciones = '' or instrucciones like 'Eres community manager especialista en Instagram. Escribes textos cortos y con gancho%');

-- ─────────────────────────────────────────────
-- 3) Cola del Director: proyecto, urgente y orden
-- ─────────────────────────────────────────────

alter table public.encargos add column if not exists urgente boolean not null default false;

-- Orden dentro de la cola (menor = antes). Los encargos que ya había, por fecha de llegada.
alter table public.encargos add column if not exists orden bigint;
update public.encargos
   set orden = (extract(epoch from creado_en) * 1000)::bigint
 where orden is null;
alter table public.encargos
  alter column orden set default (extract(epoch from clock_timestamp()) * 1000)::bigint;
alter table public.encargos alter column orden set not null;

-- Estados: los del paso A ("recibido") pasan a "en_cola"
alter table public.encargos drop constraint if exists encargos_estado_check;
update public.encargos set estado = 'en_cola' where estado = 'recibido';
alter table public.encargos alter column estado set default 'en_cola';
alter table public.encargos
  add constraint encargos_estado_check check (estado in ('en_cola', 'en_curso', 'terminado', 'cancelado'));

create index if not exists encargos_cola_idx on public.encargos (estado, urgente desc, orden, id);

-- Sube o baja un encargo en la cola (cambia el orden con el de al lado con la misma urgencia).
create or replace function public.mover_encargo(p_id uuid, p_arriba boolean)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  yo   public.encargos;
  otro public.encargos;
begin
  select * into yo from public.encargos where id = p_id and estado = 'en_cola' for update;
  if not found then
    return false;
  end if;

  if p_arriba then
    select * into otro from public.encargos
     where estado = 'en_cola' and urgente = yo.urgente and (orden, id) < (yo.orden, yo.id)
     order by orden desc, id desc
     limit 1
     for update;
  else
    select * into otro from public.encargos
     where estado = 'en_cola' and urgente = yo.urgente and (orden, id) > (yo.orden, yo.id)
     order by orden, id
     limit 1
     for update;
  end if;
  if not found then
    return false;
  end if;

  -- Si por casualidad tienen el mismo orden, se separan en 1.
  update public.encargos
     set orden = case when otro.orden = yo.orden then otro.orden + (case when p_arriba then -1 else 1 end) else otro.orden end
   where id = yo.id;
  update public.encargos set orden = yo.orden where id = otro.id;
  return true;
end;
$$;

-- Solo el servidor (service_role) puede llamarla.
revoke all on function public.mover_encargo(uuid, boolean) from public, anon, authenticated;
grant execute on function public.mover_encargo(uuid, boolean) to service_role;
