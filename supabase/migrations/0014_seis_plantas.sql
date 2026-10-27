-- Mi Oficina · 0014 · el edificio en 6 plantas y los agentes nuevos
-- Ejecútalo entero en Supabase → SQL Editor. Se puede ejecutar más de una vez y no borra nada.
--   5 Dirección · 4 Comunicación y contenido · 3 Tecnología · 2 Personas · 1 Gestión y estrategia · 0 Recepción

-- 1) Por si la 0013 no se ejecutó: la columna de la planta
alter table public.agentes add column if not exists planta smallint;

-- 2) Despachos y tipos nuevos
alter table public.agentes drop constraint if exists agentes_despacho_check;
alter table public.agentes
  add constraint agentes_despacho_check
  check (despacho is null or despacho in (
    'direccion', 'redes', 'traduccion', 'redaccion', 'diseno', 'planificacion', 'comunidad',
    'programacion', 'ciberseguridad', 'revision', 'web',
    'secretaria', 'rrhh', 'agenda',
    'informes', 'estrategia', 'finanzas',
    'jefatura'
  ));

alter table public.agentes drop constraint if exists agentes_tipo_check;
alter table public.agentes
  add constraint agentes_tipo_check
  check (tipo in (
    'redes', 'direccion', 'comunicacion', 'administracion', 'rrhh', 'traduccion',
    'programacion', 'ciberseguridad', 'secretaria', 'redaccion', 'diseno', 'informes', 'jefatura',
    'planificacion', 'comunidad', 'revision', 'web', 'agenda', 'estrategia', 'finanzas'
  ));

-- 3) Los jefes de planta se ocultan (sin borrarlos): volverán cuando tengan trabajo
update public.agentes
   set activo = false
 where id in ('00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000502', '00000000-0000-4000-8000-000000000503');

-- 4) Cada agente a su planta nueva. Solo se mueve quien sigue en la planta de antes (0013) o no tiene planta,
--    así que si lo cambias de planta después, volver a ejecutar esto no lo devuelve.
update public.agentes set planta = 5 where despacho = 'direccion' and (planta is null or planta = 4);
update public.agentes set planta = 4 where despacho in ('redes', 'traduccion', 'redaccion', 'diseno') and (planta is null or planta = 3);
update public.agentes set planta = 3 where despacho in ('programacion', 'ciberseguridad') and (planta is null or planta = 2);
update public.agentes set planta = 2 where despacho = 'secretaria' and (planta is null or planta = 1);
update public.agentes set planta = 1 where despacho = 'informes' and planta is null;

-- 5) RRHH y Agenda vuelven (estaban ocultos y sin despacho): a Personas. Solo la primera vez.
update public.agentes
   set despacho = 'rrhh', tipo = 'rrhh', departamento_id = null, activo = true, planta = 2
 where id = '00000000-0000-4000-8000-000000000205' and despacho is null;

update public.agentes
   set despacho = 'agenda', tipo = 'agenda', departamento_id = null, activo = true, planta = 2,
       instrucciones = case when coalesce(trim(instrucciones), '') = '' then
         $instr$Eres el responsable de la agenda de la CEO. Organizas reuniones: propones horarios teniendo en cuenta la zona horaria de cada persona, preparas el orden del día y el mensaje de convocatoria. Si falta un dato (fecha, duración, participantes), lo preguntas. Más adelante podrás crear las reuniones directamente en la app de CIFA; de momento entregas la propuesta lista para copiar.$instr$
         else instrucciones end
 where id = '00000000-0000-4000-8000-000000000203' and despacho is null;

-- 6) Los agentes nuevos
insert into public.agentes (id, departamento_id, despacho, nombre, tipo, activo, planta, instrucciones)
values
  (
    '00000000-0000-4000-8000-000000000601', null, 'planificacion', 'Planificador de contenido', 'planificacion', true, 4,
    $instr$Eres el planificador de contenido. Preparas calendarios de publicaciones para cada proyecto y red social: qué publicar cada día, en qué formato, con qué objetivo y quién del equipo debe hacerlo. Tienes en cuenta fechas importantes y repartes bien los temas. No inventas eventos: solo usas los que te dan.$instr$
  ),
  (
    '00000000-0000-4000-8000-000000000602', null, 'comunidad', 'Atención a la comunidad', 'comunidad', true, 4,
    $instr$Eres responsable de atención a la comunidad. Te pasan mensajes, comentarios o dudas que llegan por redes, Discord o correo, y preparas respuestas amables, claras y con el tono de cada proyecto. Si una respuesta necesita un dato que no tienes, lo indicas en vez de inventarlo. Nunca envías nada: la CEO revisa y envía.$instr$
  ),
  (
    '00000000-0000-4000-8000-000000000603', null, 'revision', 'Revisor de código', 'revision', true, 3,
    $instr$Eres revisor de código. Revisas el código que te pasan (o el del Programador) y señalas errores, fallos de seguridad, partes difíciles de mantener y mejoras, con prioridad alta, media o baja y cómo arreglarlo. Eres concreto y explicas en palabras sencillas.$instr$
  ),
  (
    '00000000-0000-4000-8000-000000000604', null, 'web', 'Web', 'web', true, 3,
    $instr$Eres el responsable de las webs de los proyectos. Propones contenido, textos y mejoras para cada sección (estructura, claridad, llamadas a la acción, SEO básico y accesibilidad), adaptados al tono de cada proyecto. Entregas los textos listos para copiar y una lista de cambios recomendados.$instr$
  ),
  (
    '00000000-0000-4000-8000-000000000605', null, 'estrategia', 'Estratega', 'estrategia', true, 1,
    $instr$Eres el estratega de la CEO. La ayudas a pensar: ideas para crecer, planes por fases, pros y contras de una decisión, prioridades y riesgos. Das opiniones razonadas y honestas, también si algo no te parece buena idea. Terminas siempre con los próximos pasos concretos.$instr$
  ),
  (
    '00000000-0000-4000-8000-000000000606', null, 'finanzas', 'Finanzas', 'finanzas', true, 1,
    $instr$Eres el responsable de finanzas. Con los datos que te pasan (gastos, ingresos, presupuestos), haces cuentas, resúmenes y previsiones claras, en tablas. Nunca inventas cifras: si falta un dato, lo pides. Avisas si algo no cuadra.$instr$
  )
on conflict (id) do nothing;
