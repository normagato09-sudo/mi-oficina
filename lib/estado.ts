import type { EstadoPublicacion } from "./tipos";

export type Tono = "verde" | "amarillo" | "rojo" | "azul" | "gris";

export type EstadoAgente = {
  tono: Tono;
  texto: string;
  trabajando: boolean;
};

/** Estado visible del agente a partir del recuento de sus publicaciones. */
export function estadoAgente(estados: Record<EstadoPublicacion, number>): EstadoAgente {
  if (estados.preparando > 0) return { tono: "amarillo", texto: "Preparando…", trabajando: true };
  if (estados.publicando > 0) return { tono: "amarillo", texto: "Publicando…", trabajando: true };
  if (estados.error > 0) return { tono: "rojo", texto: "Error", trabajando: false };
  if (estados.lista > 0) {
    return {
      tono: "amarillo",
      texto: estados.lista === 1 ? "1 lista" : `${estados.lista} listas`,
      trabajando: false,
    };
  }
  return { tono: "verde", texto: "Libre", trabajando: false };
}

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
