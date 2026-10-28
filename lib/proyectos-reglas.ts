/** Reglas y tipos de los proyectos que comparten el navegador y el servidor (migración 0015). */

/**
 * borrador (el Director hace el plan) → plan_revision (plan para revisar) → aprobado | en_espera (ya hay 3)
 *   → en_marcha → terminado. En cualquier momento: cancelado.
 * Si al Director le falta información: esperando_respuesta → (respondo) → borrador.
 */
export type EstadoProyecto =
  | "borrador"
  | "esperando_respuesta"
  | "plan_revision"
  | "aprobado"
  | "en_espera"
  | "en_marcha"
  | "terminado"
  | "cancelado";

export const TEXTO_ESTADO_PROYECTO: Record<EstadoProyecto, string> = {
  borrador: "Borrador del plan",
  esperando_respuesta: "Esperando tu respuesta",
  plan_revision: "Plan para revisar",
  aprobado: "Plan aprobado",
  en_espera: "En espera",
  en_marcha: "En marcha",
  terminado: "Terminado",
  cancelado: "Cancelado",
};

/** Proyectos a la vez entre "plan aprobado" y "en marcha" (los demás esperan turno). */
export const MAX_PROYECTOS_A_LA_VEZ = 3;

/** Estados que ya no cambian. */
export const ESTADOS_CERRADOS: EstadoProyecto[] = ["terminado", "cancelado"];

export const MAX_NOMBRE_PROYECTO = 120;
export const MAX_CARACTERES_PROYECTO = 10_000;

/** Una tarea del plan. `id` es "T1", "T2"… en el orden del plan. */
export type TareaPlan = {
  id: string;
  titulo: string;
  /** Qué hay que hacer, con los datos que hagan falta. */
  descripcion: string;
  /** El agente que la hace, o null si es una tarea para la CEO. */
  agente_id: string | null;
  /** Nombre del agente cuando se hizo el plan (o "CEO"). */
  agente: string;
  /** Qué entregará (de la lista de lo que puede entregar el agente). */
  entrega: string;
  /** Tareas cuyo resultado le hace falta (siempre anteriores en el plan). */
  depende_de: string[];
  /** Solo en las tareas para la CEO: por qué no la puede hacer el equipo. */
  motivo_ceo: string;
};

export type FasePlan = { nombre: string; objetivo: string; tareas: TareaPlan[] };

export type Plan = {
  resumen: string;
  /** Qué quedará hecho al 100 %. */
  resultado_final: string;
  fases: FasePlan[];
  creado_en: string;
};

/** Una versión anterior del plan y los cambios que pedí sobre ella. */
export type VersionPlan = { plan: Plan; cambios: string; guardado_en: string };
