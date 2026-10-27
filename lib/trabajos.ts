/**
 * Lo que entrega cada agente: qué sabe hacer (para que el Director solo pida eso), el esquema de su
 * respuesta estructurada y cómo se lee su resultado. Lo comparten el navegador y el servidor.
 */
import { CAMPOS, ESQUEMA_CARTEL, PLANTILLAS, TAMANOS, leerCartel, type CartelDiseñador } from "./carteles";
import type { EsquemaJSON } from "./ia";
import type { Despacho } from "./tipos";

/** Despachos que hacen tareas: todos menos Dirección y las jefaturas (que aún no trabajan). */
export type DespachoTrabajo = Exclude<Despacho, "direccion" | "jefatura">;

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
  planificacion: "Un calendario de publicaciones en tabla: fecha, red social, formato, tema, objetivo y quién del equipo lo hace. Solo usa los eventos y fechas que le dan.",
  comunidad: "Una respuesta por cada mensaje, comentario o duda (de redes, Discord o correo), lista para copiar, con los datos que falten señalados. No envía nada.",
  revision: "Una lista de problemas o mejoras del código, cada uno con prioridad (alta, media o baja), explicación sencilla y cómo arreglarlo, y el código corregido listo para copiar.",
  web: "Una lista de mejoras para la web con prioridad (alta, media o baja) y los textos de cada sección listos para copiar (estructura, llamadas a la acción, SEO básico y accesibilidad).",
  agenda: "Una propuesta de reunión: fecha y hora para cada participante en su zona horaria, duración, orden del día y mensaje de convocatoria. Pregunta lo que falte.",
  rrhh: "Una oferta de vacante, el resumen de una candidatura (puntos fuertes, dudas, si encaja y preguntas para la entrevista) o un mensaje para un candidato. No contacta a nadie.",
  estrategia: "Un análisis con opciones, pros y contras de cada una, una recomendación razonada y los próximos pasos concretos.",
  finanzas: "Tablas con las cuentas (gastos, ingresos, presupuestos o previsiones) y un resumen, con avisos si algo no cuadra o falta un dato. Nunca inventa cifras.",
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

export type Prioridad = "alta" | "media" | "baja";
export type ResultadoCalendario = {
  titulo: string;
  publicaciones: { fecha: string; red: string; formato: string; tema: string; objetivo: string; responsable: string }[];
};
export type ResultadoRespuestas = { respuestas: { mensaje: string; canal: string; respuesta: string; faltan: string[] }[] };
/** Revisor de código y Web: mejoras con prioridad y piezas (textos o código) listas para copiar. */
export type ResultadoMejoras = {
  resumen: string;
  mejoras: { titulo: string; prioridad: Prioridad; explicacion: string; solucion: string }[];
  piezas: { titulo: string; lenguaje: string; contenido: string }[];
};
export type ResultadoReunion = {
  asunto: string;
  duracion: string;
  participantes: { nombre: string; zona_horaria: string; fecha_hora: string }[];
  orden_del_dia: string[];
  convocatoria: string;
  faltan: string[];
};
export type ResultadoRRHH = {
  clase: "vacante" | "candidatura" | "mensaje";
  titulo: string;
  /** La oferta o el mensaje (Markdown sencillo); en una candidatura, un resumen corto. */
  texto: string;
  puntos_fuertes: string[];
  dudas: string[];
  encaja: string;
  preguntas: string[];
};
export type ResultadoEstrategia = {
  resumen: string;
  opciones: { opcion: string; pros: string[]; contras: string[] }[];
  recomendacion: string;
  proximos_pasos: string[];
};
export type ResultadoFinanzas = { resumen: string; tablas: { titulo: string; columnas: string[]; filas: string[][] }[]; avisos: string[] };

/** Resultado guardado en la tarea (columna resultado_json). */
export type Resultado =
  | { tipo: "redes"; datos: ResultadoInstagram }
  | { tipo: "diseno"; datos: CartelDiseñador }
  | { tipo: "traduccion"; datos: ResultadoTraduccion }
  | { tipo: "redaccion"; datos: ResultadoRedaccion }
  | { tipo: "programacion"; datos: ResultadoCodigo }
  | { tipo: "ciberseguridad"; datos: ResultadoSeguridad }
  | { tipo: "secretaria"; datos: ResultadoAlumno }
  | { tipo: "informes"; datos: ResultadoInforme }
  | { tipo: "planificacion"; datos: ResultadoCalendario }
  | { tipo: "comunidad"; datos: ResultadoRespuestas }
  | { tipo: "revision"; datos: ResultadoMejoras }
  | { tipo: "web"; datos: ResultadoMejoras }
  | { tipo: "agenda"; datos: ResultadoReunion }
  | { tipo: "rrhh"; datos: ResultadoRRHH }
  | { tipo: "estrategia"; datos: ResultadoEstrategia }
  | { tipo: "finanzas"; datos: ResultadoFinanzas };

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
const PRIORIDAD = { type: "string", enum: ["alta", "media", "baja"] };

/** Revisor de código y Web comparten forma. */
const esquemaMejoras = (pieza: string) =>
  objeto({
    resumen: texto("Resumen en una o dos frases."),
    mejoras: lista(
      objeto({
        titulo: texto(),
        prioridad: PRIORIDAD,
        explicacion: texto("Qué pasa y por qué importa, en palabras sencillas."),
        solucion: texto("Cómo arreglarlo o mejorarlo."),
      }),
      "Problemas o mejoras, de más a menos importante.",
    ),
    piezas: lista(
      objeto({
        titulo: texto("Para qué es (sección de la web, archivo…)."),
        lenguaje: texto("Lenguaje del código (javascript, html…) o «texto» si es un texto."),
        contenido: texto(pieza),
      }),
      "Textos o código listos para copiar (vacía si no hacen falta).",
    ),
  });

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
  planificacion: objeto({
    titulo: texto("Proyecto y periodo del calendario."),
    publicaciones: lista(
      objeto({
        fecha: texto("Fecha (y hora si la hay)."),
        red: texto("Red social o canal."),
        formato: texto("Carrusel, reel, historia, publicación, mensaje…"),
        tema: texto(),
        objetivo: texto(),
        responsable: texto("Quién del equipo lo hace (Redactor, Diseñador, Instagram…)."),
      }),
      "Una fila por publicación, en orden de fecha.",
    ),
  }),
  comunidad: objeto({
    respuestas: lista(
      objeto({
        mensaje: texto("El mensaje original, resumido en una frase."),
        canal: texto("Instagram, Discord, correo…"),
        respuesta: texto("La respuesta completa, lista para copiar."),
        faltan: lista(texto(), "Datos que harían falta para responder bien (vacía si no falta nada)."),
      }),
      "Una respuesta por mensaje.",
    ),
  }),
  revision: esquemaMejoras("El código corregido completo, listo para copiar."),
  web: esquemaMejoras("El texto de la sección o el código, listo para copiar."),
  agenda: objeto({
    asunto: texto(),
    duracion: texto("Duración de la reunión."),
    participantes: lista(
      objeto({ nombre: texto(), zona_horaria: texto("Zona horaria (p. ej. Europe/Madrid)."), fecha_hora: texto("Fecha y hora de la reunión en su zona horaria.") }),
    ),
    orden_del_dia: lista(texto()),
    convocatoria: texto("Mensaje de convocatoria listo para copiar."),
    faltan: lista(texto(), "Datos que faltan y hay que preguntar (vacía si no falta nada)."),
  }),
  rrhh: objeto({
    clase: { type: "string", enum: ["vacante", "candidatura", "mensaje"], description: "Qué entregas." },
    titulo: texto("Puesto, candidato o asunto."),
    texto: texto("La oferta o el mensaje completo (Markdown sencillo). En una candidatura, un resumen corto."),
    puntos_fuertes: lista(texto(), "Solo candidatura (si no, vacía)."),
    dudas: lista(texto(), "Solo candidatura (si no, vacía)."),
    encaja: texto("Solo candidatura: si encaja con el puesto y por qué (si no, vacío)."),
    preguntas: lista(texto(), "Solo candidatura: preguntas para la entrevista (si no, vacía)."),
  }),
  estrategia: objeto({
    resumen: texto("La situación en pocas frases."),
    opciones: lista(objeto({ opcion: texto(), pros: lista(texto()), contras: lista(texto()) })),
    recomendacion: texto("Tu recomendación razonada y honesta."),
    proximos_pasos: lista(texto(), "Próximos pasos concretos."),
  }),
  finanzas: objeto({
    resumen: texto("Resumen claro de las cuentas."),
    tablas: lista(
      objeto({
        titulo: texto(),
        columnas: lista(texto()),
        filas: lista(lista(texto()), "Cada fila, con un valor por columna."),
      }),
    ),
    avisos: lista(texto(), "Cosas que no cuadran o datos que faltan (vacía si no hay)."),
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
    case "planificacion":
      return {
        nota,
        resultado: {
          tipo: "planificacion",
          datos: {
            titulo: str(d.titulo),
            publicaciones: objs(d.publicaciones).map((p) => ({
              fecha: str(p.fecha),
              red: str(p.red),
              formato: str(p.formato),
              tema: str(p.tema),
              objetivo: str(p.objetivo),
              responsable: str(p.responsable),
            })),
          },
        },
      };
    case "comunidad":
      return {
        nota,
        resultado: {
          tipo: "comunidad",
          datos: { respuestas: objs(d.respuestas).map((r) => ({ mensaje: str(r.mensaje), canal: str(r.canal), respuesta: str(r.respuesta), faltan: strs(r.faltan) })) },
        },
      };
    case "revision":
    case "web":
      return { nota, resultado: { tipo: despacho, datos: leerMejoras(d) } };
    case "agenda":
      return {
        nota,
        resultado: {
          tipo: "agenda",
          datos: {
            asunto: str(d.asunto),
            duracion: str(d.duracion),
            participantes: objs(d.participantes).map((p) => ({ nombre: str(p.nombre), zona_horaria: str(p.zona_horaria), fecha_hora: str(p.fecha_hora) })),
            orden_del_dia: strs(d.orden_del_dia),
            convocatoria: str(d.convocatoria),
            faltan: strs(d.faltan),
          },
        },
      };
    case "rrhh":
      return {
        nota,
        resultado: {
          tipo: "rrhh",
          datos: {
            clase: (["vacante", "candidatura", "mensaje"] as const).find((c) => c === d.clase) ?? "mensaje",
            titulo: str(d.titulo),
            texto: str(d.texto),
            puntos_fuertes: strs(d.puntos_fuertes),
            dudas: strs(d.dudas),
            encaja: str(d.encaja),
            preguntas: strs(d.preguntas),
          },
        },
      };
    case "estrategia":
      return {
        nota,
        resultado: {
          tipo: "estrategia",
          datos: {
            resumen: str(d.resumen),
            opciones: objs(d.opciones).map((o) => ({ opcion: str(o.opcion), pros: strs(o.pros), contras: strs(o.contras) })),
            recomendacion: str(d.recomendacion),
            proximos_pasos: strs(d.proximos_pasos),
          },
        },
      };
    case "finanzas":
      return {
        nota,
        resultado: {
          tipo: "finanzas",
          datos: {
            resumen: str(d.resumen),
            tablas: objs(d.tablas).map((t) => ({
              titulo: str(t.titulo),
              columnas: strs(t.columnas),
              filas: (Array.isArray(t.filas) ? t.filas : [])
                .filter((f): f is unknown[] => Array.isArray(f))
                .map((f) => f.map((v) => (typeof v === "number" ? String(v) : str(v)))),
            })),
            avisos: strs(d.avisos),
          },
        },
      };
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

function leerMejoras(d: Record<string, unknown>): ResultadoMejoras {
  return {
    resumen: str(d.resumen),
    mejoras: objs(d.mejoras).map((m) => ({
      titulo: str(m.titulo),
      prioridad: (["alta", "media", "baja"] as const).find((p) => p === m.prioridad) ?? "media",
      explicacion: str(m.explicacion),
      solucion: str(m.solucion),
    })),
    piezas: objs(d.piezas).map((p) => ({ titulo: str(p.titulo), lenguaje: str(p.lenguaje), contenido: typeof p.contenido === "string" ? p.contenido : "" })),
  };
}

const vinetas = (items: string[]) => items.map((i) => `- ${i}`).join("\n");
const numerada = (items: string[]) => items.map((p, i) => `${i + 1}. ${p}`).join("\n");

/** Tabla en texto (Markdown). */
function tablaTexto(columnas: string[], filas: string[][]): string {
  const fila = (celdas: string[]) => `| ${celdas.map((c) => c.replace(/\|/g, "/")).join(" | ")} |`;
  return [fila(columnas), fila(columnas.map(() => "---")), ...filas.map(fila)].join("\n");
}

/** Une las partes no vacías con una línea en blanco. */
const juntar = (partes: string[]) => partes.filter(Boolean).join("\n\n");

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
    case "planificacion":
      return juntar([
        r.datos.titulo ? `# ${r.datos.titulo}` : "",
        tablaTexto(
          ["Fecha", "Red", "Formato", "Tema", "Objetivo", "Responsable"],
          r.datos.publicaciones.map((p) => [p.fecha, p.red, p.formato, p.tema, p.objetivo, p.responsable]),
        ),
      ]);
    case "comunidad":
      return juntar(
        r.datos.respuestas.map(
          (x, i) => `## ${i + 1}. ${x.canal ? `[${x.canal}] ` : ""}${x.mensaje}\n${x.respuesta}${x.faltan.length ? `\n\nFalta:\n${vinetas(x.faltan)}` : ""}`,
        ),
      );
    case "revision":
    case "web":
      return juntar([
        r.datos.resumen,
        ...r.datos.mejoras.map((m) => `[${m.prioridad.toUpperCase()}] ${m.titulo}\n${m.explicacion}\nCómo: ${m.solucion}`),
        ...r.datos.piezas.map((p) =>
          p.lenguaje && p.lenguaje !== "texto" ? `${p.titulo}\n\`\`\`${p.lenguaje}\n${p.contenido}\n\`\`\`` : `## ${p.titulo}\n${p.contenido}`,
        ),
      ]);
    case "agenda":
      return juntar([
        `# ${r.datos.asunto || "Reunión"}`,
        r.datos.duracion ? `Duración: ${r.datos.duracion}` : "",
        r.datos.participantes.length ? `Participantes:\n${vinetas(r.datos.participantes.map((p) => `${p.nombre}: ${p.fecha_hora} (${p.zona_horaria})`))}` : "",
        r.datos.orden_del_dia.length ? `Orden del día:\n${numerada(r.datos.orden_del_dia)}` : "",
        r.datos.convocatoria ? `Convocatoria:\n${r.datos.convocatoria}` : "",
        r.datos.faltan.length ? `Falta:\n${vinetas(r.datos.faltan)}` : "",
      ]);
    case "rrhh":
      return juntar([
        r.datos.titulo ? `# ${r.datos.titulo}` : "",
        r.datos.texto,
        r.datos.puntos_fuertes.length ? `Puntos fuertes:\n${vinetas(r.datos.puntos_fuertes)}` : "",
        r.datos.dudas.length ? `Dudas:\n${vinetas(r.datos.dudas)}` : "",
        r.datos.encaja ? `¿Encaja? ${r.datos.encaja}` : "",
        r.datos.preguntas.length ? `Preguntas para la entrevista:\n${numerada(r.datos.preguntas)}` : "",
      ]);
    case "estrategia":
      return juntar([
        r.datos.resumen,
        ...r.datos.opciones.map((o) => `## ${o.opcion}\nPros:\n${vinetas(o.pros) || "- —"}\nContras:\n${vinetas(o.contras) || "- —"}`),
        r.datos.recomendacion ? `## Recomendación\n${r.datos.recomendacion}` : "",
        r.datos.proximos_pasos.length ? `## Próximos pasos\n${numerada(r.datos.proximos_pasos)}` : "",
      ]);
    case "finanzas":
      return juntar([
        r.datos.resumen,
        ...r.datos.tablas.map((t) => `## ${t.titulo}\n${tablaTexto(t.columnas, t.filas)}`),
        r.datos.avisos.length ? `Avisos:\n${vinetas(r.datos.avisos)}` : "",
      ]);
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
