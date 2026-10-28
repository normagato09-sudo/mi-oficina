"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { aprenderDeTarea, editarTarea, type Edicion } from "@/lib/aprobar";
import { avanzarCola } from "@/lib/cola";
import { aprobarFase, aprobarFinal, marcarTareaCeo, pedirCambiosFase, reintentarEnMarcha } from "@/lib/ejecucion";
import { cargarOrganizaciones } from "@/lib/datos";
import { prepararSubidas, type ArchivoPedido, type SubidaPreparada } from "@/lib/encargos";
import {
  aprobarPlan,
  cancelarProyecto,
  cargarDirectorOficina,
  crearProyecto,
  pedirCambiosPlan,
  leerEstadoProyecto,
  reintentarPlan,
  responderPreguntasProyecto,
} from "@/lib/proyectos";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

type Resultado = { ok?: true; error?: string };

const SESION_CADUCADA = "Tu sesión ha caducado. Vuelve a entrar.";

async function comprobarSesion(): Promise<boolean> {
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

function mensaje(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Paso 1 de "Nuevo proyecto": URLs firmadas para que el navegador suba los adjuntos directamente a Storage. */
export async function prepararSubidasProyecto(archivos: ArchivoPedido[]): Promise<{ subidas?: SubidaPreparada[]; error?: string }> {
  if (!(await comprobarSesion())) return { error: SESION_CADUCADA };
  try {
    return { subidas: await prepararSubidas(archivos) };
  } catch (e) {
    return { error: mensaje(e) };
  }
}

/** Paso 2: guarda el proyecto y el Director empieza el plan (en segundo plano). Abre el proyecto. */
export async function enviarProyecto(datos: {
  organizacionId: string;
  nombre: string;
  objetivo: string;
  fechaLimite: string;
  notas: string;
  subidas: { ruta: string; nombre: string; tipo: string }[];
}): Promise<Resultado> {
  if (!(await comprobarSesion())) return { error: SESION_CADUCADA };
  let id: string;
  try {
    const [director, organizaciones] = await Promise.all([cargarDirectorOficina(), cargarOrganizaciones()]);
    if (!director) return { error: "No hay ningún Director activo que pueda hacer el plan." };
    if (!organizaciones.some((o) => o.id === datos.organizacionId)) return { error: "Elige una organización activa." };
    id = await crearProyecto({
      director,
      organizacionId: datos.organizacionId,
      nombre: String(datos.nombre ?? ""),
      objetivo: String(datos.objetivo ?? ""),
      fechaLimite: String(datos.fechaLimite ?? "") || null,
      notas: String(datos.notas ?? ""),
      subidas: datos.subidas ?? [],
    });
  } catch (e) {
    return { error: mensaje(e) };
  }
  after(avanzarCola);
  redirect(`/?panel=proyectos&proyecto=${id}`);
}

/** Ejecuta un cambio del proyecto y, si el Director tiene que trabajar, pone la cola en marcha. */
async function hacer(cambio: () => Promise<unknown>, director = false): Promise<Resultado> {
  if (!(await comprobarSesion())) return { error: SESION_CADUCADA };
  try {
    await cambio();
  } catch (e) {
    return { error: mensaje(e) };
  }
  if (director) after(avanzarCola);
  refresh();
  return { ok: true };
}

export async function responderProyecto(id: string, respuesta: string): Promise<Resultado> {
  return hacer(() => responderPreguntasProyecto(String(id), String(respuesta ?? "")), true);
}

/** Aprobar el plan: si hay hueco, la cola lo pone en marcha enseguida. */
export async function aprobarPlanAccion(id: string): Promise<Resultado> {
  return hacer(() => aprobarPlan(String(id)), true);
}

export async function pedirCambiosAccion(id: string, comentario: string): Promise<Resultado> {
  return hacer(() => pedirCambiosPlan(String(id), String(comentario ?? "")), true);
}

export async function cancelarProyectoAccion(id: string): Promise<Resultado> {
  return hacer(() => cancelarProyecto(String(id)));
}

/** "Reintentar": el plan (borrador) o, en marcha, el paso del Director o las tareas que fallaron. */
export async function reintentarProyectoAccion(id: string): Promise<Resultado> {
  return hacer(async () => ((await leerEstadoProyecto(String(id))) === "en_marcha" ? reintentarEnMarcha(String(id)) : reintentarPlan(String(id))), true);
}

/** Marco como hecha una tarea mía de la fase actual. */
export async function marcarTareaCeoAccion(id: string, clave: string, nota: string): Promise<Resultado> {
  return hacer(() => marcarTareaCeo(String(id), String(clave), String(nota ?? "")), true);
}

/** "Aprobar fase": empieza la siguiente (o el Director escribe el final). */
export async function aprobarFaseAccion(id: string): Promise<Resultado> {
  return hacer(() => aprobarFase(String(id)), true);
}

/** "Pedir cambios" en la fase: el Director decide qué tareas rehacer. */
export async function pedirCambiosFaseAccion(id: string, comentario: string): Promise<Resultado> {
  return hacer(() => pedirCambiosFase(String(id), String(comentario ?? "")), true);
}

/** "Aprobar final": el proyecto termina y el siguiente en espera puede empezar. */
export async function aprobarFinalAccion(id: string): Promise<Resultado> {
  return hacer(() => aprobarFinal(String(id)), true);
}

/** Guardar mi versión de una entrega del proyecto. El Director aprende de la diferencia (en segundo plano). */
export async function editarEntregaAccion(tareaId: string, edicion: Edicion): Promise<Resultado> {
  const r = await hacer(() => editarTarea(String(tareaId), edicion));
  if (r.ok) after(() => aprenderDeTarea(String(tareaId), "edicion"));
  return r;
}
