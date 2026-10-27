/**
 * Lo que entrega cada agente: qué sabe hacer (para que el Director solo pida eso), el esquema de su
 * respuesta estructurada y cómo se lee su resultado. Lo comparten el navegador y el servidor.
 */
import { CAMPOS, ESQUEMA_CARTEL, PLANTILLAS, TAMANOS, leerCartel, type CartelDiseñador } from "./carteles";
import type { EsquemaJSON } from "./ia";
import type { Despacho } from "./tipos";

/** Despachos que trabajan en tareas (todos menos Dirección). */
export type DespachoTrabajo = Exclude<Despacho, "direccion">;

/** Qué puede entregar cada agente. El Director recibe esta lista y solo pide entregas de aquí. */
export const ENTREGAS: Record<DespachoTrabajo, string> = {
  redes:
    "Texto de la publicación de Instagram (caption) con sus hashtags, qué imágenes adjuntas usar y en qué orden, y el texto alternativo de cada una. Todavía no publica.",
  diseno: `Un cartel con una de las 3 plantillas (${Object.values(PLANTILLAS).join(", ")}), en ${Object.values(TAMANOS)
    .map((t) => `${t.ancho}×${t.alto}`)
    .join(" o ")}, que se descarga como PNG. Solo puede usar como foto una imagen adjunta al encargo.`,
  traduccion: "El texto traducido o corregido, más una lista corta de cambios.",
  redaccion: "Un texto con formato (títulos, listas), listo para copiar: correos, actas, normas, propuestas, comunicados, anuncios largos.",
  programacion: "Una explicación y el código en bloques, listo para copiar. No ejecuta nada ni sube cambios.",
  ciberseguridad: "Una lista de problemas de seguridad, cada uno con su riesgo (alto, medio o bajo), una explicación sencilla y los pasos para arreglarlo.",
  secretaria: "La ficha de un alumno (nombre, Discord, país, correo, cumpleaños, cursos) y la lista de datos que faltan.",
  informes:
    "Un informe por proyecto con lo hecho, lo pendiente, lo que espera a la CEO y 3 prioridades. Recibe los datos reales de los encargos y las tareas de los últimos 7 días.",
};

export function esDespachoTrabajo(despacho: string | null | undefined): despacho is DespachoTrabajo {
  return !!despacho && despacho in ENTREGAS;
}

/* ───────────── Resultados de cada tipo ───────────── */

export type ResultadoInstagram = { caption: string; hashtags: string[]; imagenes: { numero: number; alt: string }[] };
export type ResultadoTraduccion = { idioma: string; texto: string; cambios: string[] };
export type ResultadoRedaccion = { titulo: string; texto: string };
export type ResultadoCodigo = { explicacion: string; bloques: { lenguaje: string; descripcion: string; codigo: string }[] };
export type Riesgo = "alto" | "medio" | "bajo";
export type ResultadoSeguridad = { resumen: string; problemas: { titulo: string; riesgo: Riesgo; explicacion: string; pasos: string[] }[] };
export type ResultadoAlumno = {
  ficha: { nombre: string; discord: string; pais: string; correo: string; cumpleanos: string; cursos: string[] };
  faltan: string[];
};
export type ResultadoInforme = {
  proyectos: { proyecto: string; hecho: string[]; pendiente: string[]; espera_ceo: string[] }[];
  prioridades: string[];
};

/** Resultado guardado en la tarea (columna resultado_json). */
export type Resultado =
  | { tipo: "redes"; datos: ResultadoInstagram }
  | { tipo: "diseno"; datos: CartelDiseñador }
  | { tipo: "traduccion"; datos: ResultadoTraduccion }
  | { tipo: "redaccion"; datos: ResultadoRedaccion }
  | { tipo: "programacion"; datos: ResultadoCodigo }
  | { tipo: "ciberseguridad"; datos: ResultadoSeguridad }
  | { tipo: "secretaria"; datos: ResultadoAlumno }
  | { tipo: "informes"; datos: ResultadoInforme };

/* ───────────── Esquemas (modo estricto: todo obligatorio, sin propiedades extra) ───────────── */

const texto = (description?: string) => ({ type: "string", ...(description ? { description } : {}) });
const lista = (items: object, description?: string) => ({ type: "array", items, ...(description ? { description } : {}) });
const objeto = (properties: Record<string, object>, description?: string) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
  ...(description ? { description } : {}),
});

const NOTA = texto("Nota corta para la CEO: qué has hecho y por qué (1 o 2 frases).");

const ESQUEMAS_DATOS: Record<DespachoTrabajo, object> = {
  redes: objeto({
    caption: texto("Texto de la publicación, listo para pegar en Instagram (sin los hashtags)."),
    hashtags: lista(texto(), "Hashtags, cada uno con su #."),
    imagenes: lista(
      objeto({
        numero: { type: "integer", description: "Número de la imagen adjunta (0 = la primera)." },
        alt: texto("Texto alternativo de esa imagen, para personas ciegas."),
      }),
      "Imágenes adjuntas que hay que publicar, en el orden en que van. Vacía si no hay imágenes.",
    ),
  }),
  // El cartel de lib/carteles.ts sin su "explicacion" (aquí va en la nota).
  diseno: objeto(Object.fromEntries(Object.entries(ESQUEMA_CARTEL.properties).filter(([clave]) => clave !== "explicacion"))),
  traduccion: objeto({
    idioma: texto("Idioma del texto entregado."),
    texto: texto("El texto traducido o corregido completo."),
    cambios: lista(texto(), "Lista corta de cambios o decisiones importantes."),
  }),
  redaccion: objeto({
    titulo: texto("Título o asunto."),
    texto: texto("El texto completo con formato Markdown sencillo: # títulos, - listas, **negrita**."),
  }),
  programacion: objeto({
    explicacion: texto("Qué hace el código y cómo usarlo, en pocas frases."),
    bloques: lista(objeto({ lenguaje: texto("Lenguaje (javascript, python, sql…)."), descripcion: texto(), codigo: texto("Código completo, listo para copiar.") })),
  }),
  ciberseguridad: objeto({
    resumen: texto("Resumen en una o dos frases."),
    problemas: lista(
      objeto({
        titulo: texto(),
        riesgo: { type: "string", enum: ["alto", "medio", "bajo"] },
        explicacion: texto("Explicación sencilla del riesgo."),
        pasos: lista(texto(), "Pasos para arreglarlo."),
      }),
    ),
  }),
  secretaria: objeto({
    ficha: objeto({
      nombre: texto(),
      discord: texto("Usuario de Discord, o vacío si no lo dan."),
      pais: texto(),
      correo: texto(),
      cumpleanos: texto("Cumpleaños si lo dan; si no, vacío."),
      cursos: lista(texto()),
    }),
    faltan: lista(texto(), "Datos imprescindibles que faltan (vacía si no falta nada)."),
  }),
  informes: objeto({
    proyectos: lista(
      objeto({
        proyecto: texto(),
        hecho: lista(texto()),
        pendiente: lista(texto()),
        espera_ceo: lista(texto(), "Lo que está esperando a la CEO."),
      }),
    ),
    prioridades: lista(texto(), "Exactamente 3 prioridades."),
  }),
};

/** Esquema de la respuesta de un agente: sus datos más una nota corta. */
export function esquemaTrabajo(despacho: DespachoTrabajo): EsquemaJSON {
  return objeto({ datos: ESQUEMAS_DATOS[despacho], nota: NOTA }) as EsquemaJSON;
}

/* ───────────── Leer y presentar resultados ───────────── */

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const strs = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
const objs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null) : []);

/** Normaliza la respuesta de la IA (por si se sale del esquema) y la deja lista para guardar. */
export function leerResultado(despacho: DespachoTrabajo, crudo: unknown): { resultado: Resultado; nota: string } {
  const r = (typeof crudo === "object" && crudo !== null ? crudo : {}) as Record<string, unknown>;
  const d = (typeof r.datos === "object" && r.datos !== null ? r.datos : {}) as Record<string, unknown>;
  const nota = str(r.nota);
  switch (despacho) {
    case "redes":
      return {
        nota,
        resultado: {
          tipo: "redes",
          datos: {
            caption: str(d.caption),
            hashtags: strs(d.hashtags).map((h) => (h.startsWith("#") ? h : `#${h}`)),
            imagenes: objs(d.imagenes)
              .filter((i) => Number.isInteger(i.numero) && (i.numero as number) >= 0)
              .map((i) => ({ numero: i.numero as number, alt: str(i.alt) })),
          },
        },
      };
    case "diseno":
      return { nota, resultado: { tipo: "diseno", datos: leerCartel({ ...d, explicacion: nota }) } };
    case "traduccion":
      return { nota, resultado: { tipo: "traduccion", datos: { idioma: str(d.idioma), texto: str(d.texto), cambios: strs(d.cambios) } } };
    case "redaccion":
      return { nota, resultado: { tipo: "redaccion", datos: { titulo: str(d.titulo), texto: str(d.texto) } } };
    case "programacion":
      return {
        nota,
        resultado: {
          tipo: "programacion",
          datos: {
            explicacion: str(d.explicacion),
            bloques: objs(d.bloques).map((b) => ({ lenguaje: str(b.lenguaje), descripcion: str(b.descripcion), codigo: typeof b.codigo === "string" ? b.codigo : "" })),
          },
        },
      };
    case "ciberseguridad":
      return {
        nota,
        resultado: {
          tipo: "ciberseguridad",
          datos: {
            resumen: str(d.resumen),
            problemas: objs(d.problemas).map((p) => ({
              titulo: str(p.titulo),
              riesgo: (["alto", "medio", "bajo"] as const).find((x) => x === p.riesgo) ?? "medio",
              explicacion: str(p.explicacion),
              pasos: strs(p.pasos),
            })),
          },
        },
      };
    case "secretaria": {
      const f = (typeof d.ficha === "object" && d.ficha !== null ? d.ficha : {}) as Record<string, unknown>;
      return {
        nota,
        resultado: {
          tipo: "secretaria",
          datos: {
            ficha: { nombre: str(f.nombre), discord: str(f.discord), pais: str(f.pais), correo: str(f.correo), cumpleanos: str(f.cumpleanos), cursos: strs(f.cursos) },
            faltan: strs(d.faltan),
          },
        },
      };
    }
    case "informes":
      return {
        nota,
        resultado: {
          tipo: "informes",
          datos: {
            proyectos: objs(d.proyectos).map((p) => ({ proyecto: str(p.proyecto), hecho: strs(p.hecho), pendiente: strs(p.pendiente), espera_ceo: strs(p.espera_ceo) })),
            prioridades: strs(d.prioridades).slice(0, 3),
          },
        },
      };
  }
}

const vinetas = (items: string[]) => items.map((i) => `- ${i}`).join("\n");

/** El resultado en texto plano: para que el Director lo revise y para el botón "Copiar". */
export function textoDeResultado(r: Resultado): string {
  switch (r.tipo) {
    case "redes":
      return [
        r.datos.caption,
        r.datos.hashtags.join(" "),
        r.datos.imagenes.length
          ? `Imágenes, en orden:\n${r.datos.imagenes.map((i, n) => `${n + 1}. Imagen adjunta nº ${i.numero} — alt: ${i.alt}`).join("\n")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n");
    case "diseno": {
      const campos = CAMPOS[r.datos.plantilla].map((c) => `${c.etiqueta}: ${(r.datos.textos as Record<string, string>)[c.clave] || "—"}`);
      const foto = r.datos.plantilla === "foto" ? `\nFoto de fondo: ${r.datos.foto === null ? "ninguna" : `imagen adjunta nº ${r.datos.foto}`}` : "";
      return `Cartel "${PLANTILLAS[r.datos.plantilla]}" · ${TAMANOS[r.datos.tamano].nombre}\n${campos.join("\n")}${foto}`;
    }
    case "traduccion":
      return `${r.datos.texto}${r.datos.cambios.length ? `\n\nCambios:\n${vinetas(r.datos.cambios)}` : ""}`;
    case "redaccion":
      return r.datos.titulo ? `# ${r.datos.titulo}\n\n${r.datos.texto}` : r.datos.texto;
    case "programacion":
      return [r.datos.explicacion, ...r.datos.bloques.map((b) => `${b.descripcion ? `${b.descripcion}\n` : ""}\`\`\`${b.lenguaje}\n${b.codigo}\n\`\`\``)].join("\n\n");
    case "ciberseguridad":
      return [
        r.datos.resumen,
        ...r.datos.problemas.map((p) => `[${p.riesgo.toUpperCase()}] ${p.titulo}\n${p.explicacion}\n${vinetas(p.pasos)}`),
      ].join("\n\n");
    case "secretaria": {
      const f = r.datos.ficha;
      return [
        `Nombre: ${f.nombre || "—"}`,
        `Discord: ${f.discord || "—"}`,
        `País: ${f.pais || "—"}`,
        `Correo: ${f.correo || "—"}`,
        `Cumpleaños: ${f.cumpleanos || "—"}`,
        `Cursos: ${f.cursos.join(", ") || "—"}`,
        r.datos.faltan.length ? `\nFaltan:\n${vinetas(r.datos.faltan)}` : "",
      ].join("\n");
    }
    case "informes":
      return [
        ...r.datos.proyectos.map(
          (p) =>
            `## ${p.proyecto}\nHecho:\n${vinetas(p.hecho) || "- —"}\nPendiente:\n${vinetas(p.pendiente) || "- —"}\nEsperando a la CEO:\n${vinetas(p.espera_ceo) || "- —"}`,
        ),
        `## Prioridades\n${r.datos.prioridades.map((p, i) => `${i + 1}. ${p}`).join("\n")}`,
      ].join("\n\n");
  }
}
