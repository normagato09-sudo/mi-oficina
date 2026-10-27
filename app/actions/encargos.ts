"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { after } from "next/server";
import { cargarProyectos, marcarAvisosLeidos } from "@/lib/datos";
import {
  cancelarEncargo,
  cargarDirector,
  crearEncargo,
  marcarUrgente,
  moverEncargo,
  prepararSubidas,
  reanudarEncargo,
  responderPregunta,
  type ArchivoPedido,
  type SubidaPreparada,
} from "@/lib/encargos";
import { avanzarCola } from "@/lib/cola";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

type Resultado = { ok?: true; error?: string };

async function comprobarSesion(): Promise<boolean> {
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

function mensaje(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

const SESION_CADUCADA = "Tu sesión ha caducado. Vuelve a entrar.";

/** Paso 1: URLs firmadas para que el navegador suba los originales directamente a Storage. */
export async function prepararSubidasEncargo(
  agenteId: string,
  archivos: ArchivoPedido[],
): Promise<{ subidas?: SubidaPreparada[]; error?: string }> {
  if (!(await comprobarSesion())) return { error: SESION_CADUCADA };
  if (!(await cargarDirector(agenteId))) return { error: "Solo el Director recibe encargos." };
  try {
    return { subidas: await prepararSubidas(archivos) };
  } catch (e) {
    return { error: mensaje(e) };
  }
}

/** Paso 2: guarda el encargo (convierte imágenes, lee PDF) al final de la cola del Director. */
export async function enviarEncargo(datos: {
  agenteId: string;
  proyectoId: string;
  texto: string;
  urgente: boolean;
  subidas: { ruta: string; nombre: string; tipo: string }[];
}): Promise<Resultado> {
  if (!(await comprobarSesion())) return { error: SESION_CADUCADA };
  const director = await cargarDirector(datos.agenteId);
  if (!director) return { error: "Solo el Director recibe encargos." };

  try {
    const proyectos = await cargarProyectos();
    if (!proyectos.some((p) => p.id === datos.proyectoId)) return { error: "Elige un proyecto activo." };
    await crearEncargo({
      director,
      proyectoId: datos.proyectoId,
      texto: String(datos.texto ?? ""),
      urgente: datos.urgente === true,
      subidas: datos.subidas ?? [],
    });
  } catch (e) {
    return { error: mensaje(e) };
  }
  // Si el Director está libre, empieza con la cola en segundo plano.
  after(avanzarCola);
  refresh();
  return { ok: true };
}

/** Mi respuesta a la pregunta del Director: vuelve a decidir con ella. */
export async function responderEncargo(id: string, respuesta: string): Promise<Resultado> {
  if (!(await comprobarSesion())) return { error: SESION_CADUCADA };
  try {
    await responderPregunta(id, String(respuesta ?? ""));
  } catch (e) {
    return { error: mensaje(e) };
  }
  after(avanzarCola);
  refresh();
  return { ok: true };
}

/** "Reintentar" (encargo en error) o "Reanudar" (atascado): el Director vuelve a ponerse con él. */
export async function reanudarEncargoAccion(id: string): Promise<Resultado> {
  if (!(await comprobarSesion())) return { error: SESION_CADUCADA };
  try {
    await reanudarEncargo(id);
  } catch (e) {
    return { error: mensaje(e) };
  }
  after(avanzarCola);
  refresh();
  return { ok: true };
}

/** Cambios en la cola: subir, bajar, marcar o desmarcar urgente y cancelar. */
export async function cambiarCola(
  id: string,
  cambio: { tipo: "mover"; arriba: boolean } | { tipo: "urgente"; valor: boolean } | { tipo: "cancelar" },
): Promise<Resultado> {
  if (!(await comprobarSesion())) return { error: SESION_CADUCADA };
  try {
    if (cambio.tipo === "mover") await moverEncargo(id, cambio.arriba === true);
    else if (cambio.tipo === "urgente") await marcarUrgente(id, cambio.valor === true);
    else if (cambio.tipo === "cancelar") await cancelarEncargo(id);
    else return { error: "Cambio no válido." };
  } catch (e) {
    return { error: mensaje(e) };
  }
  refresh();
  return { ok: true };
}

/** Campana: marca todos los avisos como leídos. */
export async function leerAvisos(): Promise<void> {
  if (!(await comprobarSesion())) return;
  await marcarAvisosLeidos();
  refresh();
}
