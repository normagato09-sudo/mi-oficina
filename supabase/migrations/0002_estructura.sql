-- Mi Oficina · 0002 · nueva estructura: Dirección + Redes sociales
-- Ejecútalo entero en Supabase → SQL Editor. Se puede ejecutar más de una vez.
-- No borra publicaciones ni avisos: el agente existente se renombra y se mueve,
-- y "Marketing" solo se elimina cuando ya no le queda ningún agente.

-- 1) Nuevo tipo de agente: 'direccion' (el Director reparte el contenido)
alter table public.agentes drop constraint if exists agentes_tipo_check;
alter table public.agentes
  add constraint agentes_tipo_check check (tipo in ('redes', 'direccion'));

-- 2) Departamentos (orden = de arriba abajo en el edificio)
insert into public.departamentos (id, edificio_id, nombre, orden)
values
  ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000001', 'Dirección', 1),
  ('00000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000001', 'Redes sociales', 2)
on conflict (id) do update
  set nombre = excluded.nombre,
      orden  = excluded.orden;

-- 3) El agente que ya existía pasa a llamarse "Instagram" y se muda a Redes sociales
update public.agentes
   set nombre = 'Instagram',
       departamento_id = '00000000-0000-4000-8000-000000000013'
 where id = '00000000-0000-4000-8000-000000000101';

-- 4) Agentes nuevos
insert into public.agentes (id, departamento_id, nombre, tipo, instrucciones, creado_en)
values
  (
    '00000000-0000-4000-8000-000000000100',
    '00000000-0000-4000-8000-000000000012',
    'Director',
    'direccion',
    $instr$Eres el Director de DEFENSEM L'EMPORDANET, una iniciativa ciudadana del Empordanet. Recibes el contenido (textos, notas e imágenes) y lo repartes a los agentes del departamento de Redes sociales (Instagram y Facebook) con indicaciones claras. Nunca inventes cifras, datos, estudios, fechas ni declaraciones; si falta un dato, pídelo o no lo uses. Respeta siempre el significado del texto original.$instr$,
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000013',
    'Facebook',
    'redes',
    $instr$Eres el agente de Facebook de DEFENSEM L'EMPORDANET, una iniciativa ciudadana del Empordanet. Publicas en Facebook lo que te pasa el Director, en catalán, con un tono cercano, claro y respetuoso. Reglas: nunca inventes cifras, datos, estudios, fechas ni declaraciones; si te falta un dato, no lo pongas. Respeta el significado del texto y solo mejora la forma. Puedes usar párrafos algo más largos que en Instagram. Termina con entre 1 y 4 hashtags relevantes, incluyendo siempre #DefensemLEmpordanet. Si procede, invita a firmar la petición. Sin emojis excesivos (máximo 3).$instr$,
    now()
  )
on conflict (id) do nothing;

-- 5) Quitar "Marketing" (solo si ya no tiene agentes, para no perder nada)
delete from public.departamentos d
 where d.id = '00000000-0000-4000-8000-000000000011'
   and not exists (select 1 from public.agentes a where a.departamento_id = d.id);
