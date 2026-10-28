"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { avanzarCola } from "@/lib/cola";
import { cargarOrganizaciones } from "@/lib/datos";
import { prepararSubidas, type ArchivoPedido, type SubidaPreparada } from "@/lib/encargos";
import {
  aprobarPlan,
  cancelarProyecto,
  cargarDirectorOficina,
  crearProyecto,
  pedirCambiosPlan,
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

export async function aprobarPlanAccion(id: string): Promise<Resultado> {
  return hacer(() => aprobarPlan(String(id)));
}

export async function pedirCambiosAccion(id: string, comentario: string): Promise<Resultado> {
  return hacer(() => pedirCambiosPlan(String(id), String(comentario ?? "")), true);
}

export async function cancelarProyectoAccion(id: string): Promise<Resultado> {
  return hacer(() => cancelarProyecto(String(id)));
}

export async function reintentarProyectoAccion(id: string): Promise<Resultado> {
  return hacer(() => reintentarPlan(String(id)), true);
}
