-- Mi Oficina · 0006 · encargos al Director (paso A, todavía sin IA)
-- Ejecútalo entero en Supabase → SQL Editor. Se puede ejecutar más de una vez. No borra nada.

create table if not exists public.encargos (
  id              uuid primary key default gen_random_uuid(),
  edificio_id     uuid not null references public.edificios(id) on delete cascade,
  -- El Director que recibe el encargo
  director_id     uuid not null references public.agentes(id) on delete cascade,
  texto           text not null default '',
  -- Dónde publicar (agentes de redes del edificio elegidos en las casillas); vacío si no aplica
  destinos        uuid[] not null default '{}',
  -- Adjuntos ya procesados:
  --   imagen: { "tipo": "imagen", "nombre", "ruta", "ancho", "alto" }   (JPEG en el bucket "encargos")
  --   pdf:    { "tipo": "pdf", "nombre", "paginas", "texto" }           (texto extraído en el servidor)
  adjuntos        jsonb not null default '[]'::jsonb,
  estado          text not null default 'recibido',
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

-- Estados posibles (se ampliarán en los pasos siguientes)
alter table public.encargos drop constraint if exists encargos_estado_check;
alter table public.encargos
  add constraint encargos_estado_check check (estado in ('recibido'));

create index if not exists encargos_edificio_idx on public.encargos (edificio_id, creado_en desc);
create index if not exists encargos_director_idx on public.encargos (director_id, creado_en desc);

drop trigger if exists encargos_actualizado_en on public.encargos;
create trigger encargos_actualizado_en
  before update on public.encargos
  for each row execute function public.tocar_actualizado_en();

-- Igual que el resto: RLS activado y sin políticas; solo el servidor (service_role) accede.
alter table public.encargos enable row level security;
grant all privileges on public.encargos to service_role;

-- Storage: bucket PRIVADO para los adjuntos (pueden ser currículums u otros documentos personales).
--   subidas/…   originales que sube el navegador con una URL firmada (se borran al procesarlos)
--   <edificio>/<encargo>/…   imágenes ya convertidas a JPEG
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'encargos',
  'encargos',
  false,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
