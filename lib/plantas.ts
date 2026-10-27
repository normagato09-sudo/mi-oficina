import type { Despacho } from "./tipos";

/** Plantas del edificio, de abajo arriba (lo comparten el navegador y el servidor). */
export const PLANTAS = [
  { n: 0, nombre: "Recepción" },
  { n: 1, nombre: "Gestión y estrategia" },
  { n: 2, nombre: "Personas" },
  { n: 3, nombre: "Tecnología" },
  { n: 4, nombre: "Comunicación y contenido" },
  { n: 5, nombre: "Dirección" },
] as const;

export const PLANTA_DIRECCION = 5;

/** Planta de cada despacho si el agente aún no tiene una guardada (migraciones 0013 y 0014 sin ejecutar). */
const PLANTA_DESPACHO: Record<Despacho, number> = {
  direccion: 5,
  redes: 4,
  traduccion: 4,
  redaccion: 4,
  diseno: 4,
  planificacion: 4,
  comunidad: 4,
  programacion: 3,
  ciberseguridad: 3,
  revision: 3,
  web: 3,
  secretaria: 2,
  rrhh: 2,
  agenda: 2,
  informes: 1,
  estrategia: 1,
  finanzas: 1,
  jefatura: 1,
};

/** La planta de un agente: la guardada (si existe en el edificio) o, si no, la de su despacho. */
export function plantaDe(agente: { planta?: number | null; despacho: Despacho }): number {
  if (typeof agente.planta === "number" && PLANTAS.some((p) => p.n === agente.planta)) return agente.planta;
  return PLANTA_DESPACHO[agente.despacho];
}

export function nombrePlanta(n: number): string {
  return PLANTAS.find((p) => p.n === n)?.nombre ?? `Planta ${n}`;
}
