/**
 * Plantillas de cartel del Diseñador (las comparten el navegador y el servidor).
 *
 * `CartelDiseñador` es la respuesta estructurada que devolverá el Diseñador cuando
 * el Director le reparta un encargo con IA: elige plantilla y tamaño y rellena los textos.
 * `ESQUEMA_CARTEL` es su JSON Schema (para pedírsela al modelo) y `leerCartel` la valida.
 */

export const PLANTILLAS = {
  convocatoria: "Convocatoria",
  frase: "Frase o dato",
  foto: "Anuncio con foto",
} as const;
export type Plantilla = keyof typeof PLANTILLAS;

export const TAMANOS = {
  cuadrado: { nombre: "Cuadrado 1080×1080", ancho: 1080, alto: 1080 },
  vertical: { nombre: "Vertical 1080×1350", ancho: 1080, alto: 1350 },
} as const;
export type Tamano = keyof typeof TAMANOS;

/** Textos de cada plantilla. */
export type TextosConvocatoria = { titulo: string; subtitulo: string; fecha: string; hora: string; lugar: string; llamada: string };
export type TextosFrase = { frase: string; contexto: string };
export type TextosFoto = { titulo: string; texto: string };

export type CartelDiseñador =
  | { plantilla: "convocatoria"; tamano: Tamano; textos: TextosConvocatoria; explicacion: string }
  | { plantilla: "frase"; tamano: Tamano; textos: TextosFrase; explicacion: string }
  /** `foto`: índice de la imagen adjunta del encargo que va de fondo (0 = la primera), o null. */
  | { plantilla: "foto"; tamano: Tamano; textos: TextosFoto; foto: number | null; explicacion: string };

/** Campos de cada plantilla, en orden, con su etiqueta y su longitud máxima. */
export const CAMPOS: { [P in Plantilla]: { clave: string; etiqueta: string; max: number; largo?: boolean }[] } = {
  convocatoria: [
    { clave: "titulo", etiqueta: "Título", max: 80 },
    { clave: "subtitulo", etiqueta: "Subtítulo", max: 140, largo: true },
    { clave: "fecha", etiqueta: "Fecha", max: 40 },
    { clave: "hora", etiqueta: "Hora", max: 30 },
    { clave: "lugar", etiqueta: "Lugar", max: 80 },
    { clave: "llamada", etiqueta: "Llamada a la acción", max: 60 },
  ],
  frase: [
    { clave: "frase", etiqueta: "Frase o cifra", max: 160, largo: true },
    { clave: "contexto", etiqueta: "Línea de contexto", max: 120 },
  ],
  foto: [
    { clave: "titulo", etiqueta: "Título", max: 80 },
    { clave: "texto", etiqueta: "Texto", max: 240, largo: true },
  ],
};

/** Textos de ejemplo para empezar. */
export const EJEMPLOS: { [P in Plantilla]: Record<string, string> } = {
  convocatoria: {
    titulo: "Jornada de puertas abiertas",
    subtitulo: "Ven a conocernos y prueba una clase gratis",
    fecha: "Sábado 14 de noviembre",
    hora: "10:00 h",
    lugar: "Sala principal",
    llamada: "Apúntate en el enlace de la bio",
  },
  frase: { frase: "+120 alumnos", contexto: "han pasado ya por nuestros cursos este año" },
  foto: { titulo: "¡Ya estamos aquí!", texto: "Empieza la nueva temporada. Te esperamos." },
};

/** JSON Schema de la respuesta del Diseñador (salida estructurada). */
export const ESQUEMA_CARTEL = {
  type: "object",
  additionalProperties: false,
  required: ["plantilla", "tamano", "textos", "foto", "explicacion"],
  properties: {
    plantilla: { type: "string", enum: Object.keys(PLANTILLAS), description: "convocatoria, frase o foto (solo si hay una imagen adjunta)" },
    tamano: { type: "string", enum: Object.keys(TAMANOS), description: "cuadrado (1080×1080) o vertical (1080×1350)" },
    textos: {
      type: "object",
      description: "Solo los campos de la plantilla elegida. Textos cortos y legibles; nunca inventes datos.",
      additionalProperties: { type: "string" },
    },
    foto: { type: ["integer", "null"], description: "Índice de la imagen adjunta que va de fondo (plantilla foto), o null" },
    explicacion: { type: "string", description: "Breve explicación de las decisiones de diseño" },
  },
} as const;

/** Valida y normaliza la respuesta del Diseñador. Lanza un Error si no es válida. */
export function leerCartel(valor: unknown): CartelDiseñador {
  if (typeof valor !== "object" || valor === null) throw new Error("La respuesta del Diseñador no es un objeto.");
  const v = valor as Record<string, unknown>;
  const plantilla = v.plantilla;
  if (typeof plantilla !== "string" || !(plantilla in PLANTILLAS)) throw new Error("Plantilla de cartel desconocida.");
  const tamano = typeof v.tamano === "string" && v.tamano in TAMANOS ? (v.tamano as Tamano) : "cuadrado";
  const crudos = (typeof v.textos === "object" && v.textos !== null ? v.textos : {}) as Record<string, unknown>;
  const textos: Record<string, string> = {};
  for (const campo of CAMPOS[plantilla as Plantilla]) {
    const t = crudos[campo.clave];
    textos[campo.clave] = typeof t === "string" ? t.trim().slice(0, campo.max) : "";
  }
  const explicacion = typeof v.explicacion === "string" ? v.explicacion.trim() : "";
  if (plantilla === "foto") {
    const foto = Number.isInteger(v.foto) && (v.foto as number) >= 0 ? (v.foto as number) : null;
    return { plantilla, tamano, textos: textos as TextosFoto, foto, explicacion };
  }
  if (plantilla === "frase") return { plantilla, tamano, textos: textos as TextosFrase, explicacion };
  return { plantilla: "convocatoria", tamano, textos: textos as TextosConvocatoria, explicacion };
}

/** Datos del proyecto que usa el cartel. */
export type MarcaCartel = { nombre: string; secundario: string | null; color: string; colorSecundario: string };
