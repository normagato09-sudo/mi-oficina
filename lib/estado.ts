import type { EstadoPublicacion } from "./tipos";

export type Tono = "verde" | "amarillo" | "rojo" | "azul" | "gris";

/** Luz de un agente: en su ventana de la fachada, en su puesto y en el punto de su burbuja. */
export type Luz = "apagada" | "amarillo" | "rojo" | "verde";

/** Cómo va el reparto del Director (encargos en curso, en error o esperando mi respuesta). */
export type ResumenReparto = {
  enCurso: boolean;
  /** El Director está revisando el trabajo de un agente. */
  revisando: boolean;
  /** Encargos en los que el Director me ha hecho una pregunta. */
  esperando: number;
  /** Texto corto si el encargo en curso ha fallado (se ve en rojo), o null. */
  error: string | null;
  /** Los planes de los proyectos (migración 0015). */
  planes?: ResumenPlanes;
};

/** Cómo van los planes de los proyectos del Director. */
export type ResumenPlanes = {
  /** Está haciendo (o rehaciendo) un plan. */
  haciendo: boolean;
  /** Planes esperando que los revise. */
  paraRevisar: number;
  /** Proyectos en los que me ha hecho preguntas. */
  preguntas: number;
  /** Texto corto si un plan ha fallado, o null. */
  error: string | null;
};

/** Tareas de un agente según su paso. */
export type ResumenTareas = {
  pendientes: number;
  /** Trabajando en ella ahora mismo. */
  trabajando: number;
  /** Entregada: esperando o en revisión del Director, o revisada esperando al resto del equipo. */
  enRevision: number;
  /** Todo el encargo revisado: te necesita. */
  listas: number;
};

export type EstadoAgente = {
  luz: Luz;
  texto: string;
  trabajando: boolean;
  /** Agente que aún no trabaja (activo = false): en gris y "Próximamente". */
  inactivo: boolean;
};

/**
 * Estado visible del agente a partir del recuento de sus publicaciones.
 * Prioridad: rojo (te necesita) > amarillo (trabajando) > verde (terminado sin ver) > apagada.
 */
export function estadoAgente(
  agente: {
    estados: Record<EstadoPublicacion, number>;
    sinVer: number;
    activo?: boolean;
    aviso_ia?: string | null;
    /** Sus tareas, por paso. */
    tareas?: ResumenTareas;
    /** Solo el Director: cómo va el reparto de los encargos. */
    reparto?: ResumenReparto;
  },
  /** Encargos esperando en su cola (Director): si no hay nada más urgente, dice "X en cola". */
  enCola = 0,
): EstadoAgente {
  const { estados, sinVer, reparto } = agente;
  if (agente.activo === false) return { luz: "apagada", texto: "Próximamente", trabajando: false, inactivo: true };
  const base = { trabajando: estados.preparando + estados.publicando > 0, inactivo: false };
  // La IA no ha podido trabajar (p. ej. límite gratuito alcanzado): también te necesita.
  if (agente.aviso_ia) return { ...base, luz: "rojo", texto: agente.aviso_ia };
  if (reparto?.error) return { ...base, luz: "rojo", texto: reparto.error };
  const planes = reparto?.planes;
  if (planes?.error) return { ...base, luz: "rojo", texto: planes.error };
  const esperando = (reparto?.esperando ?? 0) + (planes?.preguntas ?? 0);
  if (esperando) return { ...base, luz: "rojo", texto: esperando === 1 ? "Te ha hecho una pregunta" : `${esperando} preguntas para ti` };
  if (planes?.paraRevisar) return { ...base, luz: "rojo", texto: planes.paraRevisar === 1 ? "Plan para revisar" : `${planes.paraRevisar} planes para revisar` };
  const tareas = agente.tareas;
  // Su trabajo está revisado y listo: te necesita.
  if (tareas?.listas) return { ...base, luz: "rojo", texto: "Te necesita" };
  if (reparto?.enCurso) return { ...base, trabajando: true, luz: "amarillo", texto: "Repartiendo…" };
  if (reparto?.revisando) return { ...base, trabajando: true, luz: "amarillo", texto: "Revisando…" };
  if (planes?.haciendo) return { ...base, trabajando: true, luz: "amarillo", texto: "Haciendo un plan…" };
  if (tareas?.trabajando) return { ...base, trabajando: true, luz: "amarillo", texto: "Trabajando…" };
  if (estados.lista > 0) return { ...base, luz: "rojo", texto: "Te necesita" };
  if (estados.error > 0) return { ...base, luz: "rojo", texto: "Error" };
  if (estados.preparando > 0) return { ...base, luz: "amarillo", texto: "Preparando…" };
  if (estados.publicando > 0) return { ...base, luz: "amarillo", texto: "Publicando…" };
  if (tareas?.enRevision) return { ...base, luz: "amarillo", texto: "En revisión" };
  if (tareas?.pendientes) return { ...base, luz: "amarillo", texto: "Tarea pendiente" };
  if (sinVer > 0) return { ...base, luz: "verde", texto: "¡Terminado!" };
  if (enCola > 0) return { ...base, luz: "apagada", texto: `${enCola} en cola` };
  return { ...base, luz: "apagada", texto: "Libre" };
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
