"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { cargarDirector, crearEncargo, prepararSubidas, type ArchivoPedido, type SubidaPreparada } from "@/lib/encargos";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

async function comprobarSesion(): Promise<boolean> {
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

function mensaje(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Paso 1: URLs firmadas para que el navegador suba los originales directamente a Storage. */
export async function prepararSubidasEncargo(
  agenteId: string,
  archivos: ArchivoPedido[],
): Promise<{ subidas?: SubidaPreparada[]; error?: string }> {
  if (!(await comprobarSesion())) return { error: "Tu sesión ha caducado. Vuelve a entrar." };
  if (!(await cargarDirector(agenteId))) return { error: "Solo el Director recibe encargos." };
  try {
    return { subidas: await prepararSubidas(archivos) };
  } catch (e) {
    return { error: mensaje(e) };
  }
}

/** Paso 2: guarda el encargo (convierte imágenes, lee PDF) en estado "recibido". */
export async function enviarEncargo(datos: {
  agenteId: string;
  texto: string;
  destinos: string[];
  subidas: { ruta: string; nombre: string; tipo: string }[];
}): Promise<{ ok?: true; error?: string }> {
  if (!(await comprobarSesion())) return { error: "Tu sesión ha caducado. Vuelve a entrar." };
  const encontrado = await cargarDirector(datos.agenteId);
  if (!encontrado) return { error: "Solo el Director recibe encargos." };

  // Solo se puede publicar a través de agentes de redes activos de este mismo edificio.
  const validos = new Set(encontrado.redes.map((r) => r.id));
  const destinos = [...new Set(datos.destinos)];
  if (destinos.some((d) => !validos.has(d))) return { error: "Has elegido una red que no es de este edificio." };
  if (encontrado.redes.length && !destinos.length) return { error: "Elige al menos una red donde publicar." };

  try {
    await crearEncargo({ director: encontrado.director, texto: String(datos.texto ?? ""), destinos, subidas: datos.subidas ?? [] });
  } catch (e) {
    return { error: mensaje(e) };
  }
  refresh();
  return { ok: true };
}
