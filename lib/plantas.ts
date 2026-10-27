import type { Despacho } from "./tipos";

/** Plantas del edificio, de abajo arriba (lo comparten el navegador y el servidor). */
export const PLANTAS = [
  { n: 0, nombre: "Recepción" },
  { n: 1, nombre: "Administración" },
  { n: 2, nombre: "Tecnología" },
  { n: 3, nombre: "Comunicación" },
  { n: 4, nombre: "Dirección" },
] as const;

export const PLANTA_DIRECCION = 4;

/** Planta de cada despacho si el agente aún no tiene una guardada (migración 0013 sin ejecutar). */
const PLANTA_DESPACHO: Record<Exclude<Despacho, "jefatura">, number> = {
  direccion: 4,
  redaccion: 3,
  traduccion: 3,
  diseno: 3,
  redes: 3,
  programacion: 2,
  ciberseguridad: 2,
  secretaria: 1,
  informes: 1,
};

/** La planta de un agente: la guardada o, si no hay, la de su despacho. */
export function plantaDe(agente: { planta?: number | null; despacho: Despacho }): number {
  if (typeof agente.planta === "number") return agente.planta;
  return agente.despacho === "jefatura" ? 1 : PLANTA_DESPACHO[agente.despacho];
}

export function nombrePlanta(n: number): string {
  return PLANTAS.find((p) => p.n === n)?.nombre ?? `Planta ${n}`;
}
