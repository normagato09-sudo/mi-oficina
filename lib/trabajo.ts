import "server-only";
import { aprendizajesPara, conAprendizajes } from "./aprendizajes";
import { contextoAgente, sistemaDeAgente } from "./datos";
import type { Encargo, EstadoTarea, Tarea } from "./encargos";
import type { EstadoEncargo } from "./encargos-reglas";
import { cargarOrigenProyecto, comprobarFase, tareasDeProyectoListas, type TareaDelProyecto } from "./ejecucion";
import { generarEstructurado, IAError } from "./ia";
import { ENCADENADO, ahoraConMargen, avisoDeError, cargarImagenes, conReintento, pasoHasta, textoEncargo } from "./pasos";
import { supabase } from "./supabase";
import { ENTREGAS, esDespachoTrabajo, esquemaTrabajo, leerResultado, textoDeResultado, type DespachoTrabajo } from "./trabajos";
import type { Agente } from "./tipos";

/**
 * Los agentes trabajan y el Director revisa. Cada tarea es un paso de la cola (lib/cola.ts), de una en una:
 *   pendiente → en_curso (el agente trabaja) → revision → revisando (el Director revisa)
 *     → revisada | vuelve a pendiente con comentarios (máximo 2 vueltas)
 * Cuando todas las tareas del encargo están revisadas: tareas "lista", encargo "listo_revision" y aviso.
 */

const MAX_TOKENS_TRABAJO = 3_500;
const MAX_TOKENS_REVISION = 1_500;
/** Vueltas que el Director puede devolver un trabajo; a la siguiente, se queda como está con una nota. */
const MAX_VUELTAS = 2;
/** Lo que el Director lee de cada entrega al revisar (la cuenta gratuita de Groq admite 8.000 tokens por minuto). */
const MAX_CARACTERES_ENTREGA = 6_000;
const MAX_CARACTERES_OTRA_ENTREGA = 1_500;
/** Lo que lee el agente de cada tarea de la que depende (proyectos). */
const MAX_CARACTERES_DEPENDENCIA = 1_500;

/** Paso siguiente al tomar una tarea, y el paso al que vuelve si algo falla. */
const AL_TOMAR: Partial<Record<EstadoTarea, EstadoTarea>> = { pendiente: "en_curso", revision: "revisando" };
const AL_FALLAR: Partial<Record<EstadoTarea, EstadoTarea>> = { en_curso: "pendiente", revisando: "revision" };

type TareaConEncargo = Tarea & {
  encargos: Pick<Encargo, "estado" | "urgente" | "orden" | "creado_en"> | null;
};

/**
 * Toma la siguiente tarea que toque, de los encargos repartidos y de los proyectos en marcha: primero las
 * de encargos urgentes y después por orden de llegada (del encargo o del proyecto); dentro de cada uno,
 * primero las revisiones. De una en una: si otra ejecución tiene una tarea entre manos, no toma ninguna.
 */
export async function tomarTareaLista(): Promise<Tarea | null> {
  const db = supabase();
  const ahora = ahoraConMargen();
  const [{ data: ocupadas, error: e1 }, { data: candidatas, error: e2 }, deProyectos] = await Promise.all([
    db.from("tareas").select("id").in("estado", ["en_curso", "revisando"]).gt("paso_hasta", new Date().toISOString()).limit(1),
    db
      .from("tareas")
      .select("*, encargos!inner(estado, urgente, orden, creado_en)")
      .in("estado", ["pendiente", "revision"] satisfies EstadoTarea[])
      .eq("encargos.estado", "repartido" satisfies EstadoEncargo)
      .returns<TareaConEncargo[]>(),
    tareasDeProyectoListas(),
  ]);
  if (e1 || e2) throw new Error(`No se pudieron leer las tareas: ${(e1 ?? e2)!.message}`);
  if (ocupadas?.length) return null;

  const todas: TareaDelProyecto[] = [
    ...(candidatas ?? []).map(({ encargos, ...t }) => ({
      ...t,
      urgente: Boolean(encargos?.urgente),
      llegada: encargos?.creado_en ?? t.creado_en,
    })),
    ...deProyectos,
  ];
  const listas = todas
    .filter((t) => (!t.reintentar_en || t.reintentar_en <= ahora) && (!t.paso_hasta || t.paso_hasta < ahora))
    .sort(
      (a, b) =>
        Number(b.urgente) - Number(a.urgente) ||
        a.llegada.localeCompare(b.llegada) ||
        Number(b.estado === "revision") - Number(a.estado === "revision") ||
        a.creado_en.localeCompare(b.creado_en),
    );
  for (const candidata of listas) {
    // Se marca como suya solo si nadie la ha cogido entretanto (mismo estado y sin dueño).
    const { data, error } = await db
      .from("tareas")
      .update({ estado: AL_TOMAR[candidata.estado], paso_hasta: pasoHasta(), reintentar_en: null })
      .eq("id", candidata.id)
      .eq("estado", candidata.estado)
      .or(`paso_hasta.is.null,paso_hasta.lt.${ahora}`)
      .select("*")
      .returns<Tarea[]>();
    // 23505: otra ejecución acaba de tomar una tarea (índice tareas_una_a_la_vez): de una en una.
    if (error?.code === "23505") return null;
    if (error) throw new Error(`No se pudo tomar la tarea: ${error.message}`);
    if (data?.[0]) return data[0];
  }
  return null;
}

async function actualizarTarea(id: string, cambios: Record<string, unknown>): Promise<void> {
  const { error } = await supabase().from("tareas").update(cambios).eq("id", id);
  if (error) throw new Error(`No se pudo actualizar la tarea: ${error.message}`);
}

/** De dónde viene la tarea: su encargo o, en un proyecto, el proyecto (con su texto y adjuntos). */
export type OrigenTarea = Pick<Encargo, "edificio_id" | "director_id" | "texto" | "adjuntos">;

/** Lo que además lee el agente en una tarea de proyecto. */
export type DelProyecto = {
  nombre: string;
  fase: { numero: number; total: number; nombre: string; objetivo: string };
  /** Las tareas de las que depende, ya revisadas por el Director, con su resultado. */
  dependencias: { clave: string; titulo: string; agente: string; resultado: string }[];
};

type Contexto = {
  tarea: Tarea;
  agente: Agente & { despacho: DespachoTrabajo };
  encargo: OrigenTarea;
  proyecto: DelProyecto | null;
  /** Las demás tareas del mismo encargo, o de las que depende en un proyecto (para que todos digan lo mismo). */
  otras: (Pick<Tarea, "id" | "estado" | "resultado" | "instrucciones"> & { agentes: { nombre: string } | null })[];
};

/** Un paso con una tarea: el agente trabaja (en_curso) o el Director revisa (revisando). */
export async function procesarTarea(tarea: Tarea, inicio: number): Promise<void> {
  let ctx: Contexto | null = null;
  try {
    ctx = await cargarContexto(tarea);
    const resultado = await conReintento(() => (tarea.estado === "en_curso" ? trabajar(ctx!) : revisar(ctx!)), {
      reintentos: tarea.reintentos ?? 0,
      inicio,
      encadenar: (reintentarEn) =>
        actualizarTarea(tarea.id, { estado: AL_FALLAR[tarea.estado], reintentos: 1, paso_hasta: null, reintentar_en: reintentarEn }),
    });
    if (resultado === ENCADENADO) return;
    await resultado();
  } catch (e) {
    const aviso = avisoDeError(e);
    const quien = ctx?.agente.nombre ?? "Un agente";
    console.error(`Tarea ${tarea.id}:`, aviso);
    // La tarea vuelve a su paso anterior y el encargo se queda en rojo con "Reintentar"
    // (en un proyecto, la tarea: "Reintentar" en esa tarea y el Director en rojo).
    await actualizarTarea(tarea.id, { estado: AL_FALLAR[tarea.estado] ?? tarea.estado, aviso, paso_hasta: null, reintentar_en: null });
    if (!tarea.encargo_id) return;
    await supabase()
      .from("encargos")
      .update({ estado: "error" satisfies EstadoEncargo, aviso: `${tarea.estado === "revisando" ? `Al revisar a ${quien}` : quien}: ${aviso}` })
      .eq("id", tarea.encargo_id)
      .eq("estado", "repartido" satisfies EstadoEncargo);
  }
}

async function cargarContexto(tarea: Tarea): Promise<Contexto> {
  const db = supabase();
  if (!tarea.encargo_id) {
    const [{ data: agente, error: e1 }, origen] = await Promise.all([
      db.from("agentes").select("*").eq("id", tarea.agente_id).single<Agente>(),
      cargarOrigenProyecto(tarea),
    ]);
    if (e1) throw new Error(`No se pudo leer el agente: ${e1.message}`);
    if (!esDespachoTrabajo(agente.despacho)) throw new IAError(`${agente.nombre} no tiene un despacho de trabajo.`);
    return {
      tarea,
      agente: agente as Contexto["agente"],
      encargo: origen.encargo,
      proyecto: origen.proyecto,
      otras: origen.proyecto.dependencias.map((d) => ({
        id: d.clave,
        estado: "revisada" as const,
        resultado: d.resultado,
        instrucciones: d.titulo,
        agentes: { nombre: d.agente },
      })),
    };
  }
  const [{ data: agente, error: e1 }, { data: encargo, error: e2 }] = await Promise.all([
    db.from("agentes").select("*").eq("id", tarea.agente_id).single<Agente>(),
    db
      .from("encargos")
      .select("*, edificios(nombre), tareas(id, estado, resultado, instrucciones, agentes(nombre))")
      .eq("id", tarea.encargo_id)
      .single<Encargo & { edificios: { nombre: string } | null; tareas: Contexto["otras"] }>(),
  ]);
  if (e1) throw new Error(`No se pudo leer el agente: ${e1.message}`);
  if (e2) throw new Error(`No se pudo leer el encargo: ${e2.message}`);
  if (!esDespachoTrabajo(agente.despacho)) throw new IAError(`${agente.nombre} no tiene un despacho de trabajo.`);
  const { tareas, ...resto } = encargo;
  return { tarea, agente: agente as Contexto["agente"], encargo: resto, proyecto: null, otras: (tareas ?? []).filter((t) => t.id !== tarea.id) };
}

/* ───────────── El agente trabaja ───────────── */

const INDICACIONES: Partial<Record<DespachoTrabajo, string>> = {
  redes: "En \"imagenes\" elige solo imágenes adjuntas, por su número (0 = la primera), en el orden en que van; si no hay imágenes, déjala vacía.",
  diseno:
    "Usa la plantilla \"foto\" solo si hay una imagen adjunta (y pon su número en \"foto\"); si no, pon -1. Rellena solo los textos de la plantilla que elijas y deja los demás vacíos. Textos cortos: el título, pocas palabras.",
  informes: "Usa solo los datos reales de la oficina que te paso; si no hay datos de una organización, dilo. Termina con exactamente 3 prioridades.",
  secretaria: "Si falta un dato imprescindible, déjalo vacío en la ficha y añádelo a \"faltan\"; nunca lo inventes.",
  planificacion: "Usa solo los eventos y fechas del encargo y de la ficha de la organización; si no bastan, propón temas sin inventar eventos y dilo en tu nota.",
  comunidad: "Una respuesta por cada mensaje que te pasen. Si falta un dato para responder, ponlo en \"faltan\" y no lo inventes.",
  agenda: "Si no te dan la fecha, la duración, los participantes o su zona horaria, no lo supongas: déjalo vacío y añádelo a \"faltan\".",
  rrhh: "Elige en \"clase\" qué entregas. Si no es una candidatura, deja vacías las listas de candidatura y \"encaja\". Nunca juzgues por edad, origen, género ni nada que no tenga que ver con el puesto.",
  finanzas: "Usa solo las cifras que te dan; si falta una, ponlo en \"avisos\" en vez de inventarla. Cada fila con un valor por columna.",
};

function instruccionesTrabajo(despacho: DespachoTrabajo, enProyecto = false): string {
  return [
    "Ahora haz la tarea que te ha encargado el Director.",
    `Lo que entregas: ${ENTREGAS[despacho]}`,
    INDICACIONES[despacho],
    `Usa solo los datos del ${enProyecto ? "proyecto, de las entregas de las que depende tu tarea" : "encargo"}, de los adjuntos, de las instrucciones del Director y de la ficha de la organización: nunca inventes fechas, horas, lugares, nombres, cifras ni enlaces. Si te falta un dato, dilo en tu nota en vez de inventarlo.`,
    "En \"nota\", explica en una o dos frases qué has hecho y por qué.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Para el agente de Informes: encargos y tareas reales de los últimos 7 días, por proyecto. */
async function datosUltimaSemana(): Promise<string> {
  const desde = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  const { data, error } = await supabase()
    .from("encargos")
    .select("texto, estado, creado_en, edificios(nombre), tareas(estado, agentes(nombre))")
    .gte("actualizado_en", desde)
    .order("creado_en")
    .returns<
      (Pick<Encargo, "texto" | "estado" | "creado_en"> & {
        edificios: { nombre: string } | null;
        tareas: { estado: string; agentes: { nombre: string } | null }[] | null;
      })[]
    >();
  if (error) throw new Error(`No se pudieron leer los datos de la semana: ${error.message}`);
  if (!data?.length) return "No hay encargos en los últimos 7 días.";
  const porProyecto = new Map<string, string[]>();
  for (const e of data) {
    const proyecto = e.edificios?.nombre ?? "Sin organización";
    const tareas = (e.tareas ?? []).map((t) => `${t.agentes?.nombre ?? "?"}: ${t.estado}`).join(", ");
    const linea = `- [${e.estado}] ${e.creado_en.slice(0, 10)} · ${e.texto.replace(/\s+/g, " ").slice(0, 160)}${tareas ? ` (tareas: ${tareas})` : ""}`;
    porProyecto.set(proyecto, [...(porProyecto.get(proyecto) ?? []), linea]);
  }
  return [...porProyecto].map(([p, lineas]) => `${p}:\n${lineas.join("\n")}`).join("\n\n");
}

/** Lo que lee de un proyecto un agente (o el Director al revisar): el proyecto, la fase y lo que necesita de otras tareas. */
function partesProyecto(p: DelProyecto, origen: OrigenTarea, imagenes: number, maxPorDependencia: number): string[] {
  const partes = [
    `Proyecto de la CEO "${p.nombre}":\n${textoEncargo(origen, imagenes, 2_000)}`,
    `Fase ${p.fase.numero} de ${p.fase.total}: ${p.fase.nombre}. Objetivo de la fase: ${p.fase.objetivo}`,
  ];
  if (p.dependencias.length) {
    partes.push(
      `Resultados de las tareas de las que depende esta (ya revisados por el Director; úsalos y no los contradigas):\n${p.dependencias
        .map((d) => `--- ${d.clave} · ${d.titulo} (${d.agente}):\n${d.resultado.slice(0, maxPorDependencia)}`)
        .join("\n\n")}`,
    );
  }
  return partes;
}

/** Una llamada a la IA: el agente hace su tarea. Devuelve cómo guardarla (pasa a revisión). */
async function trabajar({ tarea, agente, encargo, proyecto }: Contexto): Promise<() => Promise<void>> {
  const [contexto, imagenes, semana, aprendizajes] = await Promise.all([
    contextoAgente(agente.id, encargo.edificio_id),
    cargarImagenes(encargo),
    agente.despacho === "informes" ? datosUltimaSemana() : Promise.resolve(null),
    aprendizajesPara(agente.id, encargo.edificio_id),
  ]);

  const partes = proyecto
    ? [
        `Instrucciones del Director para ti (tarea ${tarea.clave ?? ""} del plan):\n${tarea.instrucciones}`,
        ...partesProyecto(proyecto, encargo, imagenes.length, MAX_CARACTERES_DEPENDENCIA),
      ]
    : [`Instrucciones del Director para ti:\n${tarea.instrucciones}`, `Encargo original de la CEO:\n${textoEncargo(encargo, imagenes.length)}`];
  if (semana) partes.push(`Datos reales de la oficina (encargos y tareas de los últimos 7 días):\n${semana}`);
  if (tarea.comentario_ceo) {
    partes.push(
      `La CEO ha revisado tu entrega y te pide cambios. Tu entrega anterior:\n${tarea.resultado.slice(0, MAX_CARACTERES_ENTREGA)}\n\nComentario de la CEO (tenlo en cuenta por encima de todo):\n${tarea.comentario_ceo}`,
    );
  }
  if (tarea.vueltas && tarea.comentarios) {
    partes.push(
      `El Director te ha devuelto tu entrega anterior para que la corrijas (vuelta ${tarea.vueltas} de ${MAX_VUELTAS}).\nTu entrega anterior:\n${tarea.resultado.slice(0, MAX_CARACTERES_ENTREGA)}\n\nComentarios del Director (corrige exactamente esto):\n${tarea.comentarios}`,
    );
  }

  const crudo = await generarEstructurado<unknown>({
    sistema: conAprendizajes(`${sistemaDeAgente(contexto)}\n\n${instruccionesTrabajo(agente.despacho, Boolean(proyecto))}`, aprendizajes),
    mensaje: partes.join("\n\n"),
    imagenes,
    nombre: `trabajo_${agente.despacho}`,
    esquema: esquemaTrabajo(agente.despacho),
    maxTokens: MAX_TOKENS_TRABAJO,
  });
  const { resultado, nota } = leerResultado(agente.despacho, crudo);
  // Solo imágenes que existen de verdad en el encargo.
  const totalImagenes = encargo.adjuntos.filter((a) => a.tipo === "imagen").length;
  if (resultado.tipo === "redes") resultado.datos.imagenes = resultado.datos.imagenes.filter((i) => i.numero < totalImagenes);
  if (resultado.tipo === "diseno" && resultado.datos.plantilla === "foto" && (resultado.datos.foto ?? 0) >= totalImagenes) resultado.datos.foto = null;

  return () =>
    actualizarTarea(tarea.id, {
      estado: "revision" satisfies EstadoTarea,
      resultado_json: resultado,
      resultado: textoDeResultado(resultado),
      texto_editado: null,
      nota_agente: nota || null,
      aviso: null,
      reintentos: 0,
      paso_hasta: null,
      reintentar_en: null,
    });
}

/* ───────────── El Director revisa ───────────── */

const INSTRUCCIONES_REVISION = `Ahora REVISAS el trabajo que ha entregado un agente del equipo. Compruébalo con cuidado:
1. Que cumpla tus instrucciones y entregue lo que se le pidió.
2. Que no haya NINGÚN dato inventado (fecha, hora, lugar, nombre, cifra, enlace) que no esté en el encargo, en los adjuntos, en tus instrucciones o en la ficha de la organización (en un proyecto, también valen el proyecto y las entregas de las que depende).
3. Que el tono y el idioma sean los de la organización (o los que pediste).
4. Si hay otras entregas del mismo encargo, que digan lo mismo (mismas fechas, horas y lugar).
Si está bien, "correcto": true y "comentarios" vacío. Si algo falla, "correcto": false y en "comentarios" di exactamente qué tiene que cambiar, de forma concreta (no repitas lo que está bien).
En "nota_para_ceo" pon solo algo que la CEO deba saber (por ejemplo, un dato que falta y que habrá que añadir); si no hay nada, déjalo vacío.
Escribe en español.`;

type Revision = { correcto: boolean; comentarios: string; nota_para_ceo: string };

const ESQUEMA_REVISION = {
  type: "object",
  additionalProperties: false,
  required: ["correcto", "comentarios", "nota_para_ceo"],
  properties: {
    correcto: { type: "boolean" },
    comentarios: { type: "string", description: "Qué tiene que cambiar, concreto. Vacío si está bien." },
    nota_para_ceo: { type: "string", description: "Algo que la CEO deba saber, o vacío." },
  },
};

/** Una llamada a la IA: el Director revisa la entrega. Devuelve cómo guardar su decisión. */
async function revisar({ tarea, agente, encargo, proyecto, otras }: Contexto): Promise<() => Promise<void>> {
  const [contexto, delDirector, delAgente] = await Promise.all([
    contextoAgente(encargo.director_id, encargo.edificio_id),
    aprendizajesPara(encargo.director_id, encargo.edificio_id),
    aprendizajesPara(agente.id, encargo.edificio_id),
  ]);
  const partes = [
    ...(proyecto
      ? partesProyecto({ ...proyecto, dependencias: [] }, encargo, 0, 0)
      : [`Encargo original de la CEO (organización "${contexto.organizacion.nombre}"):\n${textoEncargo(encargo, 0, 2_000)}`]),
    `Instrucciones que le diste a ${agente.nombre}:\n${tarea.instrucciones}`,
    tarea.comentario_ceo ? `La CEO pidió estos cambios (comprueba que estén hechos):\n${tarea.comentario_ceo}` : "",
    delAgente.length ? `Lo que ${agente.nombre} ha aprendido de la CEO (también debe cumplirlo):\n${delAgente.map((a) => `- ${a.texto}`).join("\n")}` : "",
    `Lo único que ${agente.nombre} puede entregar: ${ENTREGAS[agente.despacho]}\nSi tus instrucciones pedían algo fuera de esto (otros tamaños, A4, PDF, JPEG, archivos…), NO se lo reclames: valora la entrega por lo que sí puede hacer.`,
    `Lo que ha entregado ${agente.nombre}${tarea.vueltas ? ` (después de ${tarea.vueltas} ${tarea.vueltas === 1 ? "corrección" : "correcciones"})` : ""}:\n${tarea.resultado.slice(0, MAX_CARACTERES_ENTREGA)}${tarea.nota_agente ? `\n\nNota de ${agente.nombre}: ${tarea.nota_agente}` : ""}`,
  ];
  const conEntrega = otras.filter((o) => o.resultado.trim());
  if (conEntrega.length) {
    partes.push(
      `${proyecto ? "Entregas de las que depende esta (deben decir lo mismo)" : "Otras entregas del mismo encargo (deben decir lo mismo)"}:\n${conEntrega
        .map((o) => `--- ${o.agentes?.nombre ?? "Agente"}:\n${o.resultado.slice(0, MAX_CARACTERES_OTRA_ENTREGA)}`)
        .join("\n\n")}`,
    );
  }

  const r = await generarEstructurado<Revision>({
    sistema: conAprendizajes(`${sistemaDeAgente(contexto)}\n\n${INSTRUCCIONES_REVISION}`, delDirector),
    mensaje: partes.filter(Boolean).join("\n\n"),
    nombre: "revision_director",
    esquema: ESQUEMA_REVISION,
    maxTokens: MAX_TOKENS_REVISION,
  });
  const comentarios = String(r.comentarios ?? "").trim();
  const nota = String(r.nota_para_ceo ?? "").trim();
  const vueltas = tarea.vueltas ?? 0;

  return async () => {
    if (r.correcto === true || !comentarios) {
      await actualizarTarea(tarea.id, { estado: "revisada" satisfies EstadoTarea, nota_director: nota || null, paso_hasta: null, aviso: null, reintentos: 0 });
    } else if (vueltas < MAX_VUELTAS) {
      // Se lo devuelve al agente con comentarios concretos: lo rehará en el siguiente paso.
      await actualizarTarea(tarea.id, {
        estado: "pendiente" satisfies EstadoTarea,
        comentarios,
        vueltas: vueltas + 1,
        paso_hasta: null,
        aviso: null,
        reintentos: 0,
      });
      return;
    } else {
      await actualizarTarea(tarea.id, {
        estado: "revisada" satisfies EstadoTarea,
        nota_director: `Te lo dejo como está después de ${MAX_VUELTAS} correcciones. Aún falla: ${comentarios}${nota ? ` ${nota}` : ""}`,
        paso_hasta: null,
        aviso: null,
        reintentos: 0,
      });
    }
    if (tarea.proyecto_id) await comprobarFase(tarea.proyecto_id);
    else if (tarea.encargo_id) await terminarSiTodoRevisado(tarea.encargo_id);
  };
}

/** Si todas las tareas del encargo están revisadas: listas para la CEO, encargo "listo para revisar" y aviso. */
async function terminarSiTodoRevisado(encargoId: string): Promise<void> {
  const db = supabase();
  const { data: tareas, error } = await db.from("tareas").select("estado").eq("encargo_id", encargoId).returns<{ estado: EstadoTarea }[]>();
  if (error) throw new Error(`No se pudieron leer las tareas: ${error.message}`);
  // Listo cuando no queda nada en marcha (las ya listas o aprobadas cuentan como hechas: p. ej. si pedí cambios en una).
  if (!tareas?.some((t) => t.estado === "revisada") || tareas.some((t) => !["revisada", "lista", "aprobada"].includes(t.estado))) return;

  const { data: encargo, error: e2 } = await db
    .from("encargos")
    .update({ estado: "listo_revision" satisfies EstadoEncargo, aviso: null })
    .eq("id", encargoId)
    .eq("estado", "repartido" satisfies EstadoEncargo)
    .select("texto, edificios(nombre)")
    .returns<(Pick<Encargo, "texto"> & { edificios: { nombre: string } | null })[]>();
  if (e2) throw new Error(`No se pudo cerrar el encargo: ${e2.message}`);
  if (!encargo?.[0]) return;

  const { error: e3 } = await db.from("tareas").update({ estado: "lista" satisfies EstadoTarea }).eq("encargo_id", encargoId).eq("estado", "revisada");
  if (e3) throw new Error(`No se pudieron marcar las tareas: ${e3.message}`);
  const texto = encargo[0].texto.replace(/\s+/g, " ").trim();
  await db.from("avisos").insert({
    encargo_id: encargoId,
    mensaje: `Listo para revisar (${encargo[0].edificios?.nombre ?? "organización"}): ${texto.length > 70 ? `${texto.slice(0, 70)}…` : texto || "encargo con adjuntos"}`,
  });
}
