import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const BUCKET = "publicaciones";

let client: SupabaseClient | null = null;

/** Cliente de Supabase solo para el servidor, con la clave secreta (rol service_role). */
export function supabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY");
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}

/** URL pública de un archivo del bucket `publicaciones`. */
export function urlPublica(ruta: string): string {
  return supabase().storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl;
}
