-- Mi Oficina · 0004 · varios proyectos (edificios) y el segundo: CIFA
-- Ejecútalo entero en Supabase → SQL Editor. Se puede ejecutar más de una vez.
-- No borra nada y no pisa lo que hayas editado tú (fichas, instrucciones, nombres).

-- 1) Datos de cada proyecto
alter table public.edificios add column if not exists letrero            text;
alter table public.edificios add column if not exists letrero_secundario text;
alter table public.edificios add column if not exists color_secundario   text;
alter table public.edificios add column if not exists idioma             text not null default 'es';
alter table public.edificios add column if not exists estilo             text not null default 'campo';
alter table public.edificios add column if not exists orden              integer not null default 0;
-- Ficha del proyecto: qué es, idioma, tono y reglas. Cada agente solo lee la de su edificio.
alter table public.edificios add column if not exists ficha              text not null default '';

-- 2) Agentes que aún no trabajan (se ven en gris, "Próximamente")
alter table public.agentes add column if not exists activo boolean not null default true;

-- 3) Nuevos tipos de agente
alter table public.agentes drop constraint if exists agentes_tipo_check;
alter table public.agentes
  add constraint agentes_tipo_check check (tipo in ('redes', 'direccion', 'comunicacion', 'administracion'));

-- 4) Defensem: rellena solo lo que esté vacío
update public.edificios
   set letrero            = coalesce(letrero, 'DEFENSEM'),
       letrero_secundario = coalesce(letrero_secundario, 'L''EMPORDANET'),
       color_secundario   = coalesce(color_secundario, '#DA1415'),
       orden              = case when orden = 0 then 1 else orden end
 where id = '00000000-0000-4000-8000-000000000001';
update public.edificios
   set idioma = 'ca'
 where id = '00000000-0000-4000-8000-000000000001'
   and idioma = 'es';

-- 5) CIFA
insert into public.edificios (id, nombre, color, letrero, letrero_secundario, color_secundario, idioma, estilo, orden, ficha)
values (
  '00000000-0000-4000-8000-000000000002',
  'CIFA',
  '#3F60DE',
  'CIFA',
  null,
  '#F5B841',
  'es',
  'escuela',
  2,
  $ficha$Qué es: CIFA (antes CESI), organización que ofrece cursos y clases gratuitas a una comunidad que está sobre todo en Discord.
Idioma: español.
Tono: cercano, claro y motivador.
Reglas: no inventar fechas, horarios, nombres ni datos; si falta algo, preguntar.$ficha$
)
on conflict (id) do nothing;

insert into public.departamentos (id, edificio_id, nombre, orden)
values
  ('00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000002', 'Directivo', 1),
  ('00000000-0000-4000-8000-000000000022', '00000000-0000-4000-8000-000000000002', 'Administración', 2),
  ('00000000-0000-4000-8000-000000000023', '00000000-0000-4000-8000-000000000002', 'Comunicación', 3)
on conflict (id) do nothing;

insert into public.agentes (id, departamento_id, nombre, tipo, activo, instrucciones)
values
  (
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000021',
    'Director',
    'direccion',
    true,
    $instr$Eres el director de CIFA. Eres experto en gestión de organizaciones educativas y comunidades online. Recibes los encargos del CEO, decides qué departamento debe encargarse y repartes el trabajo con instrucciones claras. Revisas todo antes de que llegue al CEO. Aprendes de sus correcciones. Escribes informes breves y claros.$instr$
  ),
  (
    '00000000-0000-4000-8000-000000000202',
    '00000000-0000-4000-8000-000000000022',
    'Secretaría',
    'administracion',
    false,
    ''
  ),
  (
    '00000000-0000-4000-8000-000000000203',
    '00000000-0000-4000-8000-000000000022',
    'Agenda',
    'administracion',
    false,
    ''
  ),
  (
    '00000000-0000-4000-8000-000000000204',
    '00000000-0000-4000-8000-000000000023',
    'Comunicación',
    'comunicacion',
    true,
    $instr$Eres el responsable de comunicación de CIFA. Escribes anuncios claros y cercanos para la comunidad, adaptados a cada canal: en Discord, mensajes directos con formato de Discord (negritas, listas, menciones como @everyone solo si te lo piden); en Instagram, textos cortos con gancho y hashtags.$instr$
  )
on conflict (id) do nothing;
