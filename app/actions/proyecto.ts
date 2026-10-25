"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { guardarFicha, guardarPerfil } from "@/lib/datos";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/** ok + texto: lo que ha quedado guardado. */
export type EstadoGuardado = { ok?: string; error?: string; texto?: string };

const MAX_CARACTERES = 20_000;

async function comprobarSesion(): Promise<boolean> {
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Guarda la ficha de un proyecto o el perfil de uno de sus agentes (desde el panel de la estantería). */
export async function guardarTexto(_prev: EstadoGuardado, formData: FormData): Promise<EstadoGuardado> {
  if (!(await comprobarSesion())) return { error: "Tu sesión ha caducado. Vuelve a entrar." };

  const tipo = String(formData.get("tipo") ?? "");
  const id = String(formData.get("id") ?? "");
  const texto = String(formData.get("texto") ?? "").replace(/\r\n/g, "\n").trim();
  if (!id) return { error: "Falta el identificador." };
  if (texto.length > MAX_CARACTERES) return { error: `Máximo ${MAX_CARACTERES.toLocaleString("es-ES")} caracteres.` };

  try {
    if (tipo === "ficha") await guardarFicha(id, texto);
    else if (tipo === "perfil") await guardarPerfil(id, texto);
    else return { error: "No sé qué guardar." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  refresh();
  return { ok: "Guardado", texto };
}
