-- Mi Oficina · 0013 · el edificio por plantas y los jefes de planta
-- Ejecútalo entero en Supabase → SQL Editor. Se puede ejecutar más de una vez.
-- No borra nada y no pisa lo que cambies después (si mueves a un agente de planta, se queda donde lo pongas).

-- 1) La planta de cada agente (0 Recepción, 1 Administración, 2 Tecnología, 3 Comunicación, 4 Dirección)
alter table public.agentes add column if not exists planta smallint;
alter table public.agentes drop constraint if exists agentes_planta_check;
alter table public.agentes
  add constraint agentes_planta_check check (planta is null or planta between 0 and 20);

update public.agentes
   set planta = case despacho
     when 'direccion' then 4
     when 'redaccion' then 3
     when 'traduccion' then 3
     when 'diseno' then 3
     when 'redes' then 3
     when 'programacion' then 2
     when 'ciberseguridad' then 2
     when 'secretaria' then 1
     when 'informes' then 1
   end
 where planta is null and despacho is not null and despacho <> 'jefatura';

-- 2) Nuevo despacho y tipo: la jefatura de cada planta
alter table public.agentes drop constraint if exists agentes_despacho_check;
alter table public.agentes
  add constraint agentes_despacho_check
  check (despacho is null or despacho in (
    'direccion', 'redes', 'traduccion', 'redaccion',
    'programacion', 'ciberseguridad', 'secretaria', 'diseno', 'informes', 'jefatura'
  ));

alter table public.agentes drop constraint if exists agentes_tipo_check;
alter table public.agentes
  add constraint agentes_tipo_check
  check (tipo in (
    'redes', 'direccion', 'comunicacion', 'administracion', 'rrhh', 'traduccion',
    'programacion', 'ciberseguridad', 'secretaria', 'redaccion', 'diseno', 'informes', 'jefatura'
  ));

-- 3) Los tres jefes de planta (de momento no trabajan: solo están en su despacho)
insert into public.agentes (id, departamento_id, despacho, nombre, tipo, activo, planta, instrucciones)
values
  (
    '00000000-0000-4000-8000-000000000501', null, 'jefatura', 'Jefa de Comunicación', 'jefatura', true, 3,
    $instr$Eres la jefa del departamento de Comunicación (planta 3): Redactor, Traductor, Diseñador e Instagram. Organizas a tu equipo, repartes el trabajo de comunicación según lo que sabe hacer cada uno y revisas que textos, traducciones, carteles y publicaciones sean coherentes entre sí, tengan los datos correctos y sigan el tono de cada proyecto antes de que lleguen a la CEO.$instr$
  ),
  (
    '00000000-0000-4000-8000-000000000502', null, 'jefatura', 'Jefe de Tecnología', 'jefatura', true, 2,
    $instr$Eres el jefe del departamento de Tecnología (planta 2): Programador y Ciberseguridad. Organizas a tu equipo, repartes el trabajo técnico y revisas que el código sea claro y seguro y que los informes de seguridad expliquen bien los riesgos y cómo arreglarlos, antes de que lleguen a la CEO.$instr$
  ),
  (
    '00000000-0000-4000-8000-000000000503', null, 'jefatura', 'Jefa de Administración', 'jefatura', true, 1,
    $instr$Eres la jefa del departamento de Administración (planta 1): Secretario e Informes. Organizas a tu equipo, repartes el trabajo administrativo y revisas que las fichas de alumnos estén completas y que los informes usen solo datos reales y sean claros, antes de que lleguen a la CEO.$instr$
  )
on conflict (id) do nothing;
