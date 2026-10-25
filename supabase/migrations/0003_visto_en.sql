-- Mi Oficina · 0003 · cuándo viste por última vez la ficha de cada agente
-- Ejecútalo entero en Supabase → SQL Editor. Se puede ejecutar más de una vez.
-- Un agente se ve en verde si tiene publicaciones "publicada" posteriores a visto_en.
-- Los agentes que ya existen toman la hora actual, para que lo antiguo no se encienda de golpe.

alter table public.agentes
  add column if not exists visto_en timestamptz not null default now();
