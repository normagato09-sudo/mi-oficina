/** Reglas de los encargos que comparten el navegador y el servidor. */

export const TIPOS_ADJUNTO = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
} as const;

export type TipoAdjunto = keyof typeof TIPOS_ADJUNTO;

export const ACEPTA_ADJUNTOS = Object.keys(TIPOS_ADJUNTO).join(",");

export const MAX_ADJUNTOS = 10;
/** Tamaño máximo de cada archivo original (también lo limita el bucket). */
export const MAX_BYTES_ADJUNTO = 20 * 1024 * 1024;
export const MAX_CARACTERES_ENCARGO = 10_000;

export function esTipoAdjunto(tipo: string): tipo is TipoAdjunto {
  return tipo in TIPOS_ADJUNTO;
}

export type EstadoEncargo =
  | "en_cola"
  | "en_curso"
  | "esperando_respuesta"
  | "repartido"
  | "listo_revision"
  | "error"
  | "terminado"
  | "cancelado";

export const TEXTO_ESTADO_ENCARGO: Record<EstadoEncargo, string> = {
  en_cola: "En cola",
  en_curso: "En curso",
  esperando_respuesta: "Esperando tu respuesta",
  repartido: "El equipo trabaja",
  listo_revision: "Listo para revisar",
  error: "Error",
  terminado: "Terminado",
  cancelado: "Cancelado",
};

export const TEXTO_ESTADO_TAREA: Record<"pendiente" | "en_curso" | "revision" | "revisando" | "revisada" | "lista" | "error", string> = {
  pendiente: "Pendiente",
  en_curso: "Trabajando…",
  revision: "Esperando revisión",
  revisando: "El Director lo revisa…",
  revisada: "Revisada",
  lista: "Lista",
  error: "Error",
};
