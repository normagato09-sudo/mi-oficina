import type { EstadoPublicacion } from "./tipos";

export type Tono = "verde" | "amarillo" | "rojo" | "azul" | "gris";

/** Luz de un agente: en su ventana de la fachada, en su puesto y en el punto de su burbuja. */
export type Luz = "apagada" | "amarillo" | "rojo" | "verde";

export type EstadoAgente = {
  luz: Luz;
  texto: string;
  trabajando: boolean;
};

/**
 * Estado visible del agente a partir del recuento de sus publicaciones.
 * Prioridad: rojo (te necesita) > amarillo (trabajando) > verde (terminado sin ver) > apagada.
 */
export function estadoAgente(estados: Record<EstadoPublicacion, number>, sinVer = 0): EstadoAgente {
  const trabajando = estados.preparando + estados.publicando > 0;
  if (estados.lista > 0) return { luz: "rojo", texto: "Te necesita", trabajando };
  if (estados.error > 0) return { luz: "rojo", texto: "Error", trabajando };
  if (estados.preparando > 0) return { luz: "amarillo", texto: "Preparando…", trabajando };
  if (estados.publicando > 0) return { luz: "amarillo", texto: "Publicando…", trabajando };
  if (sinVer > 0) return { luz: "verde", texto: "¡Terminado!", trabajando };
  return { luz: "apagada", texto: "Libre", trabajando };
}

export const COLOR_LUZ: Record<Luz, string> = {
  apagada: "#8A93AD",
  amarillo: "#F5B841",
  rojo: "#DA1415",
  verde: "#5FD08A",
};

export const COLOR_TONO: Record<Tono, string> = {
  verde: "#2FBF5B",
  amarillo: "#F5B841",
  rojo: "#E5484D",
  azul: "#4C9AFF",
  gris: "#8A93AD",
};

export const ESTADO_PUBLICACION: Record<EstadoPublicacion, { texto: string; tono: Tono }> = {
  preparando: { texto: "Preparando", tono: "amarillo" },
  lista: { texto: "Lista", tono: "azul" },
  publicando: { texto: "Publicando", tono: "amarillo" },
  publicada: { texto: "Publicada", tono: "verde" },
  error: { texto: "Error", tono: "rojo" },
};

export function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}
