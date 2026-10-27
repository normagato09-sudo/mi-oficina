-- Mi Oficina · 0008 · Defensem otra vez activo y panel "Proyectos" (crear, editar, archivar)
-- Ejecútalo entero en Supabase → SQL Editor. Se puede ejecutar más de una vez.
-- No borra nada y no pisa lo que edites después (si luego archivas Defensem, no se reactiva).

-- 1) Registro de pasos que solo deben hacerse una vez
create table if not exists public.pasos_aplicados (
  clave      text primary key,
  hecho_en   timestamptz not null default now()
);
alter table public.pasos_aplicados enable row level security;

-- 2) Defensem vuelve a estar activo (solo la primera vez)
do $$
begin
  if not exists (select 1 from public.pasos_aplicados where clave = '0008_defensem_activo') then
    update public.edificios set activo = true where id = '00000000-0000-4000-8000-000000000001';
    insert into public.pasos_aplicados (clave) values ('0008_defensem_activo');
  end if;
end $$;

-- 3) Idioma de cada proyecto: español, catalán o inglés
update public.edificios set idioma = 'es' where idioma is null or idioma not in ('es', 'ca', 'en');
alter table public.edificios drop constraint if exists edificios_idioma_check;
alter table public.edificios
  add constraint edificios_idioma_check check (idioma in ('es', 'ca', 'en'));

-- 4) Los proyectos nuevos se crean activos (por si la columna no tuviera valor por defecto)
alter table public.edificios alter column activo set default true;
