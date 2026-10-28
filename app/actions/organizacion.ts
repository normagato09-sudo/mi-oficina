"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { activarOrganizacion, guardarFicha, guardarPerfil, guardarOrganizacion } from "@/lib/datos";
import { IDIOMAS_PROYECTO, type IdiomaProyecto } from "@/lib/idiomas";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/** ok + texto: lo que ha quedado guardado. */
export type EstadoGuardado = { ok?: string; error?: string; texto?: string };

const MAX_CARACTERES = 20_000;

async function comprobarSesion(): Promise<boolean> {
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Guarda la ficha de una organización o el perfil de uno de sus agentes (desde el panel de la estantería). */
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

export type EstadoOrganizacion = { ok?: string; error?: string };

const COLOR = /^#[0-9a-f]{6}$/i;
const USUARIO_INSTAGRAM = /^[A-Za-z0-9._]{1,30}$/;

/** Crea una organización o guarda los cambios de una (desde el panel "Organizaciones" de la cabecera). */
export async function guardarDatosOrganizacion(_prev: EstadoOrganizacion, formData: FormData): Promise<EstadoOrganizacion> {
  if (!(await comprobarSesion())) return { error: "Tu sesión ha caducado. Vuelve a entrar." };

  const id = String(formData.get("id") ?? "").trim() || null;
  const nombre = String(formData.get("nombre") ?? "").trim();
  const color = String(formData.get("color") ?? "").trim();
  const idioma = String(formData.get("idioma") ?? "");
  const ficha = String(formData.get("ficha") ?? "").replace(/\r\n/g, "\n").trim();
  const instagram = String(formData.get("instagram") ?? "").trim().replace(/^@/, "");

  if (!nombre) return { error: "Escribe el nombre de la organización." };
  if (nombre.length > 80) return { error: "El nombre es demasiado largo (máximo 80 caracteres)." };
  if (!COLOR.test(color)) return { error: "Elige un color válido." };
  if (!(idioma in IDIOMAS_PROYECTO)) return { error: "Elige el idioma: español, catalán o inglés." };
  if (ficha.length > MAX_CARACTERES) return { error: `La ficha admite como máximo ${MAX_CARACTERES.toLocaleString("es-ES")} caracteres.` };
  if (instagram && !USUARIO_INSTAGRAM.test(instagram)) {
    return { error: "El usuario de Instagram solo puede tener letras, números, puntos y guiones bajos (máx. 30)." };
  }

  let nuevoId: string;
  try {
    nuevoId = await guardarOrganizacion(id, { nombre, color, idioma: idioma as IdiomaProyecto, ficha, instagram: instagram || null });
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  // Una organización recién creada se queda abierta para seguir editándolo.
  if (!id) redirect(`/?panel=organizaciones&organizacion=${nuevoId}`);
  refresh();
  return { ok: "Guardado" };
}

/** Archiva o vuelve a activar una organización (nunca se borra). */
export async function cambiarActivoOrganizacion(formData: FormData): Promise<void> {
  if (!(await comprobarSesion())) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await activarOrganizacion(id, formData.get("activo") === "true");
  refresh();
}
