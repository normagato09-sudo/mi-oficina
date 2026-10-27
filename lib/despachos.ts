import type { Despacho } from "./tipos";

/** Nombre de cada despacho (lo comparten el navegador y el servidor). */
export const NOMBRE_DESPACHO: Record<Despacho, string> = {
  direccion: "Dirección",
  redes: "Redes sociales",
  traduccion: "Traducción",
  redaccion: "Redacción",
  programacion: "Programación",
  ciberseguridad: "Ciberseguridad",
  secretaria: "Secretaría",
  diseno: "Diseño",
  informes: "Informes",
  jefatura: "Jefatura",
};

/** Orden de los despachos (fila de arriba y fila de abajo): también el de la carpeta "Equipo". */
export const ORDEN_DESPACHOS = Object.keys(NOMBRE_DESPACHO) as Despacho[];
