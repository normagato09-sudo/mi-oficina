import "server-only";
import { aprendizajesPara, conAprendizajes } from "./aprendizajes";
import { contextoAgente, sistemaDeAgente } from "./datos";
import { NOMBRE_DESPACHO } from "./despachos";
import type { Encargo, Pregunta } from "./encargos";
import type { EstadoEncargo } from "./encargos-reglas";
import { generarEstructurado, IAError, type EsquemaJSON } from "./ia";
import { ENCADENADO, ahoraConMargen, avisoDeError, cargarImagenes, conReintento, pasoHasta, textoEncargo } from "./pasos";
import { supabase } from "./supabase";
import { ENTREGAS, esDespachoTrabajo } from "./trabajos";
import type { Agente, Despacho } from "./tipos";

/**
 * El Director reparte: lee el encargo y decide a qué agentes se lo encarga (con instrucciones)
 * o qué dato le falta preguntar a la CEO. Es el primer paso de cada encargo en la cola (lib/cola.ts).
 */

const MAX_TOKENS_REPARTO = 3_000;

type Decision = {
  accion: "repartir" | "preguntar";
  pregunta: string;
  resumen: string;
  tareas: { agente_id: string; instrucciones: string }[];
};

/**
 * Toma el encargo en curso que esté listo para continuar (y que no esté procesando otra ejecución).
 * La base de datos marca "listo" con su propio reloj: se da un margen por si el del servidor va algo atrasado.
 */
export async function tomarEncargoListo(): Promise<Encargo | null> {
  const ahora = ahoraConMargen();
  const { data, error } = await supabase()
    .from("encargos")
    .update({ reintentar_en: null, paso_hasta: pasoHasta() })
    .eq("estado", "en_curso" satisfies EstadoEncargo)
    .lte("reintentar_en", ahora)
    .or(`paso_hasta.is.null,paso_hasta.lt.${ahora}`)
    .select("*")
    .returns<Encargo[]>();
  if (error) throw new Error(`No se pudo tomar el encargo: ${error.message}`);
  return data?.[0] ?? null;
}

async function actualizar(id: string, cambios: Record<string, unknown>): Promise<void> {
  const { error } = await supabase().from("encargos").update(cambios).eq("id", id);
  if (error) throw new Error(`No se pudo actualizar el encargo: ${error.message}`);
}

/** Un paso del Director con un encargo: decide y guarda el resultado (reparto, pregunta o error). */
export async function procesarEncargo(encargo: Encargo, inicio: number): Promise<void> {
  try {
    const decision = await conReintento(() => decidir(encargo), {
      reintentos: encargo.reintentos ?? 0,
      inicio,
      encadenar: (reintentarEn) => actualizar(encargo.id, { reintentos: 1, paso_hasta: null, reintentar_en: reintentarEn }),
    });
    if (decision === ENCADENADO) return;
    await aplicarDecision(encargo, decision);
  } catch (e) {
    const aviso = avisoDeError(e);
    console.error(`Encargo ${encargo.id}:`, aviso);
    await actualizar(encargo.id, { estado: "error" satisfies EstadoEncargo, aviso, paso_hasta: null, reintentar_en: null });
  }
}

/** El equipo al que se puede repartir: agentes activos con despacho de trabajo (todos menos el Director). */
async function cargarEquipo(directorId: string): Promise<(Agente & { despacho: Despacho })[]> {
  const { data, error } = await supabase()
    .from("agentes")
    .select("*")
    .not("despacho", "is", null)
    .neq("id", directorId)
    .order("creado_en")
    .returns<(Agente & { despacho: Despacho })[]>();
  if (error) throw new Error(`No se pudo leer el equipo: ${error.message}`);
  return (data ?? []).filter((a) => a.activo !== false && esDespachoTrabajo(a.despacho));
}

const INSTRUCCIONES_REPARTO = `Ahora tu trabajo es REPARTIR este encargo, no hacerlo tú.
- Decide qué agente o agentes del equipo deben hacerlo. Puede ser más de uno (por ejemplo, el Diseñador para el cartel e Instagram para la publicación). Elige solo agentes de la lista del equipo, por su id, y solo los que de verdad hagan falta.
- Cada agente SOLO puede entregar lo que pone en su "Entrega". Pide únicamente eso: nunca PDF, Word, archivos .txt, A4 para imprimir, vídeos ni nada que no esté en su lista.
- Para cada uno, escribe instrucciones claras y concretas: qué tiene que entregar (de su lista) y en qué idioma, y copia los datos exactos que necesite (fechas, horas, lugares, nombres, cifras). No inventes datos.
- Si varios agentes trabajan en el mismo encargo, dales a todos exactamente los mismos datos (fechas, horas, lugar) para que digan lo mismo.
- Si falta un dato imprescindible que no se puede sacar del encargo, de los adjuntos ni de la ficha del proyecto, NO repartas: haz una sola pregunta, corta y concreta, a la CEO (accion "preguntar", tareas vacías). No preguntes por lo que puedes decidir tú con sentido común (tono, hashtags, diseño, longitud…).
- Las fotos e imágenes NO son imprescindibles: el Diseñador hace carteles sin foto (plantillas convocatoria y frase o dato) e Instagram puede publicar el cartel. Nunca preguntes por fotos, imágenes, logos ni colores.
- Si repartes, deja "pregunta" vacía.
- Escribe el resumen, la pregunta y las instrucciones en español.`;

/** Lo que lee el Director: el encargo, los PDF, las preguntas ya respondidas y el equipo con lo que entrega cada uno. */
function mensajeReparto(encargo: Encargo, proyecto: string, equipo: (Agente & { despacho: Despacho })[], imagenes: number): string {
  const partes = [`Encargo para el proyecto "${proyecto}"${encargo.urgente ? " (URGENTE)" : ""}:\n${textoEncargo(encargo, imagenes)}`];
  if (encargo.adjuntos.some((a) => a.tipo === "imagen")) partes.push("Los agentes recibirán las imágenes adjuntas con su tarea.");

  const preguntas = (encargo.preguntas ?? []).filter((p): p is Pregunta & { respuesta: string } => p.respuesta !== null);
  if (preguntas.length) {
    partes.push(`Preguntas que ya me hiciste y mis respuestas:\n${preguntas.map((p) => `P: ${p.pregunta}\nR: ${p.respuesta}`).join("\n\n")}`);
  }

  partes.push(
    `Equipo disponible (elige por id):\n${equipo
      .map((a) => `- id ${a.id} · ${a.nombre} (${NOMBRE_DESPACHO[a.despacho]}). Entrega: ${esDespachoTrabajo(a.despacho) ? ENTREGAS[a.despacho] : "—"}`)
      .join("\n")}`,
  );
  return partes.join("\n\n");
}

function esquemaReparto(ids: string[]): EsquemaJSON {
  return {
    type: "object",
    additionalProperties: false,
    required: ["accion", "pregunta", "resumen", "tareas"],
    properties: {
      accion: { type: "string", enum: ["repartir", "preguntar"] },
      pregunta: { type: "string", description: "Solo si accion es preguntar: una pregunta corta para la CEO. Si no, vacía." },
      resumen: { type: "string", description: "Una o dos frases: qué has decidido y por qué." },
      tareas: {
        type: "array",
        description: "Una tarea por agente. Vacía si accion es preguntar.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["agente_id", "instrucciones"],
          properties: {
            agente_id: { type: "string", enum: ids },
            instrucciones: { type: "string", description: "Qué tiene que hacer y entregar (solo de su lista), con los datos exactos." },
          },
        },
      },
    },
  };
}

/** Una llamada a la IA: el Director lee todo y decide a quién reparte (o qué pregunta). */
async function decidir(encargo: Encargo): Promise<Decision> {
  const [contexto, equipo, imagenes, aprendizajes] = await Promise.all([
    contextoAgente(encargo.director_id, encargo.edificio_id),
    cargarEquipo(encargo.director_id),
    cargarImagenes(encargo),
    aprendizajesPara(encargo.director_id, encargo.edificio_id),
  ]);
  if (!equipo.length) throw new IAError("No hay ningún agente activo en el equipo al que repartir.");

  const decision = await generarEstructurado<Decision>({
    sistema: conAprendizajes(`${sistemaDeAgente(contexto)}\n\n${INSTRUCCIONES_REPARTO}`, aprendizajes),
    mensaje: mensajeReparto(encargo, contexto.proyecto.nombre, equipo, imagenes.length),
    imagenes,
    nombre: "reparto_director",
    esquema: esquemaReparto(equipo.map((a) => a.id)),
    maxTokens: MAX_TOKENS_REPARTO,
  });

  // Por si la IA se sale del esquema: solo agentes del equipo y con instrucciones.
  const ids = new Set(equipo.map((a) => a.id));
  return {
    accion: decision.accion === "preguntar" ? "preguntar" : "repartir",
    pregunta: String(decision.pregunta ?? "").trim(),
    resumen: String(decision.resumen ?? "").trim(),
    tareas: (Array.isArray(decision.tareas) ? decision.tareas : [])
      .map((t) => ({ agente_id: String(t?.agente_id ?? ""), instrucciones: String(t?.instrucciones ?? "").trim() }))
      .filter((t) => ids.has(t.agente_id) && t.instrucciones),
  };
}

/** Guarda la decisión: una pregunta para mí o una tarea por agente (que la cola pondrá a trabajar). */
async function aplicarDecision(encargo: Encargo, decision: Decision): Promise<void> {
  const db = supabase();
  if (decision.pregunta && (decision.accion === "preguntar" || !decision.tareas.length)) {
    await actualizar(encargo.id, {
      estado: "esperando_respuesta" satisfies EstadoEncargo,
      preguntas: [...(encargo.preguntas ?? []), { pregunta: decision.pregunta, respuesta: null }],
      nota_director: decision.resumen || null,
      aviso: null,
      paso_hasta: null,
      reintentar_en: null,
    });
    return;
  }
  if (!decision.tareas.length) throw new IAError("El Director no ha sabido a quién repartir este encargo. Reintenta o añade más detalles.");

  const { data: tareas, error } = await db
    .from("tareas")
    .insert(decision.tareas.map((t) => ({ encargo_id: encargo.id, agente_id: t.agente_id, instrucciones: t.instrucciones })))
    .select("id");
  if (error) throw new Error(`No se pudieron crear las tareas: ${error.message}`);
  try {
    await actualizar(encargo.id, {
      estado: "repartido" satisfies EstadoEncargo,
      nota_director: decision.resumen || null,
      aviso: null,
      paso_hasta: null,
      reintentar_en: null,
    });
  } catch (e) {
    // Sin encargo repartido, las tareas no deben quedar sueltas.
    await db.from("tareas").delete().in("id", (tareas ?? []).map((t) => t.id));
    throw e;
  }
}
