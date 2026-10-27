"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { activarProyecto, guardarFicha, guardarPerfil, guardarProyecto } from "@/lib/datos";
import { IDIOMAS_PROYECTO, type IdiomaProyecto } from "@/lib/idiomas";
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

export type EstadoProyecto = { ok?: string; error?: string };

const COLOR = /^#[0-9a-f]{6}$/i;
const USUARIO_INSTAGRAM = /^[A-Za-z0-9._]{1,30}$/;

/** Crea un proyecto o guarda los cambios de uno (desde el panel "Proyectos" de la cabecera). */
export async function guardarDatosProyecto(_prev: EstadoProyecto, formData: FormData): Promise<EstadoProyecto> {
  if (!(await comprobarSesion())) return { error: "Tu sesión ha caducado. Vuelve a entrar." };

  const id = String(formData.get("id") ?? "").trim() || null;
  const nombre = String(formData.get("nombre") ?? "").trim();
  const color = String(formData.get("color") ?? "").trim();
  const idioma = String(formData.get("idioma") ?? "");
  const ficha = String(formData.get("ficha") ?? "").replace(/\r\n/g, "\n").trim();
  const instagram = String(formData.get("instagram") ?? "").trim().replace(/^@/, "");

  if (!nombre) return { error: "Escribe el nombre del proyecto." };
  if (nombre.length > 80) return { error: "El nombre es demasiado largo (máximo 80 caracteres)." };
  if (!COLOR.test(color)) return { error: "Elige un color válido." };
  if (!(idioma in IDIOMAS_PROYECTO)) return { error: "Elige el idioma: español, catalán o inglés." };
  if (ficha.length > MAX_CARACTERES) return { error: `La ficha admite como máximo ${MAX_CARACTERES.toLocaleString("es-ES")} caracteres.` };
  if (instagram && !USUARIO_INSTAGRAM.test(instagram)) {
    return { error: "El usuario de Instagram solo puede tener letras, números, puntos y guiones bajos (máx. 30)." };
  }

  let nuevoId: string;
  try {
    nuevoId = await guardarProyecto(id, { nombre, color, idioma: idioma as IdiomaProyecto, ficha, instagram: instagram || null });
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  // Un proyecto recién creado se queda abierto para seguir editándolo.
  if (!id) redirect(`/?panel=proyectos&proyecto=${nuevoId}`);
  refresh();
  return { ok: "Guardado" };
}

/** Archiva o vuelve a activar un proyecto (nunca se borra). */
export async function cambiarActivoProyecto(formData: FormData): Promise<void> {
  if (!(await comprobarSesion())) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await activarProyecto(id, formData.get("activo") === "true");
  refresh();
}
