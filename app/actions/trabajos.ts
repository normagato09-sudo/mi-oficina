"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { after } from "next/server";
import { aprenderDeTarea, aprobarTarea, editarTarea, pedirCambios, type Edicion } from "@/lib/aprobar";
import { borrarAprendizaje } from "@/lib/aprendizajes";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

type Resultado = { ok?: true; error?: string };

const SESION_CADUCADA = "Tu sesión ha caducado. Vuelve a entrar.";

async function comprobarSesion(): Promise<boolean> {
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

async function intentar(accion: () => Promise<unknown>): Promise<Resultado> {
  if (!(await comprobarSesion())) return { error: SESION_CADUCADA };
  try {
    await accion();
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  refresh();
  return { ok: true };
}

/** Aprobar un trabajo listo (Publicar en Instagram, descargar el cartel o copiar). */
export async function aprobarTrabajo(tareaId: string): Promise<Resultado> {
  return intentar(() => aprobarTarea(tareaId));
}

/** Guardar mi versión de un trabajo. El Director aprende de la diferencia (en segundo plano). */
export async function editarTrabajo(tareaId: string, edicion: Edicion): Promise<Resultado> {
  const r = await intentar(() => editarTarea(tareaId, edicion));
  if (r.ok) after(() => aprenderDeTarea(tareaId, "edicion"));
  return r;
}

/** Pedir cambios: la tarea vuelve a la cola y el Director aprende de mi comentario (en segundo plano). */
export async function pedirCambiosTrabajo(tareaId: string, comentario: string): Promise<Resultado> {
  let antes = "";
  const r = await intentar(async () => {
    antes = await pedirCambios(tareaId, comentario);
  });
  // La cola retoma la tarea con el refresco automático de la página (así el aprendizaje y el trabajo
  // no comparten los 60 s de esta ejecución).
  if (r.ok) after(() => aprenderDeTarea(tareaId, "cambios", antes));
  return r;
}

/** Borrar un aprendizaje (carpeta "Equipo"). */
export async function borrarAprendizajeAccion(id: string): Promise<Resultado> {
  return intentar(() => borrarAprendizaje(id));
}
