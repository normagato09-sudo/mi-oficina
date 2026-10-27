import "server-only";
import { contextoAgente, sistemaDeAgente, NOMBRE_DESPACHO } from "./datos";
import { BUCKET_ENCARGOS, type Encargo, type Pregunta } from "./encargos";
import type { EstadoEncargo } from "./encargos-reglas";
import { generarEstructurado, IAError, LimiteIAError, MENSAJE_LIMITE, type EsquemaJSON, type ImagenIA } from "./ia";
import { supabase } from "./supabase";
import type { Agente, Despacho } from "./tipos";

/**
 * Cola automática del Director: los encargos se atienden de uno en uno (urgentes primero).
 *
 * Todo corre en segundo plano con after() (maxDuration = 60 s). Cada paso es una llamada corta
 * a la IA; lo que no cabe en una ejecución se deja preparado (reintentar_en) para la siguiente,
 * que llega con el refresco de la página (cada 4 s mientras hay algo en curso).
 */

/** Tiempo útil de cada ejecución (maxDuration = 60 s, con margen para guardar). */
const PRESUPUESTO_MS = 50_000;
/** Si ya se ha gastado esto, no se empieza otra llamada a la IA en esta ejecución. */
const MAX_PARA_EMPEZAR_MS = 25_000;
/** Lo que se tarda, como mucho, en una llamada a la IA (para decidir si cabe esperar y reintentar). */
const DURACION_LLAMADA_MS = 20_000;
/** Mientras una ejecución procesa un encargo, nadie más lo toca (y si se corta, deja de valer). */
const DURACION_PASO_S = 70;
const MAX_IMAGENES = 3;
/** Texto de los PDF que se le pasa al Director (la cuenta gratuita de Groq admite 8.000 tokens por minuto). */
const MAX_CARACTERES_PDF = 6_000;
const MAX_CARACTERES_PERFIL = 220;
const MAX_TOKENS_REPARTO = 3_000;
/** Diferencia de reloj tolerada entre este servidor y la base de datos. */
const MARGEN_RELOJ_MS = 5_000;

type Decision = {
  accion: "repartir" | "preguntar";
  pregunta: string;
  resumen: string;
  tareas: { agente_id: string; instrucciones: string }[];
};

const dormir = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Hace avanzar la cola: si no hay ningún encargo en curso, empieza el primero; si hay uno listo
 * para continuar, lo procesa. Al terminar uno, sigue con el siguiente mientras quede tiempo.
 * Nunca lanza: los fallos se guardan en el encargo (rojo, "Reintentar").
 */
export async function avanzarCola(): Promise<void> {
  const inicio = Date.now();
  try {
    while (true) {
      // Pasa el primero de la cola a "en curso" (si no hay ya uno); si no da tiempo a procesarlo,
      // queda listo y lo coge la siguiente ejecución.
      const { error } = await supabase().rpc("empezar_siguiente_encargo");
      if (error) {
        console.error(`Cola del Director: ${error.message}. ¿Has ejecutado la migración 0010?`);
        return;
      }
      if (Date.now() - inicio > MAX_PARA_EMPEZAR_MS) return;
      const encargo = await tomarEncargoListo();
      if (!encargo) return;
      await procesarEncargo(encargo, inicio);
    }
  } catch (e) {
    console.error("Cola del Director:", e);
  }
}

/**
 * Toma el encargo en curso que esté listo para continuar (y que no esté procesando otra ejecución).
 * La base de datos marca "listo" con su propio reloj: se da un margen por si el del servidor va algo atrasado.
 */
async function tomarEncargoListo(): Promise<Encargo | null> {
  const ahora = new Date(Date.now() + MARGEN_RELOJ_MS).toISOString();
  const { data, error } = await supabase()
    .from("encargos")
    .update({ reintentar_en: null, paso_hasta: new Date(Date.now() + DURACION_PASO_S * 1000).toISOString() })
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
async function procesarEncargo(encargo: Encargo, inicio: number): Promise<void> {
  try {
    const decision = await decidirConReintento(encargo, inicio);
    if (decision === "encadenado") return;
    await aplicarDecision(encargo, decision);
  } catch (e) {
    const aviso =
      e instanceof LimiteIAError
        ? `${MENSAJE_LIMITE}${e.reintentarEnSegundos ? ` (Groq pide esperar ${Math.ceil(e.reintentarEnSegundos / 60)} min)` : ""}.`
        : e instanceof Error
          ? e.message
          : String(e);
    console.error(`Encargo ${encargo.id}:`, aviso);
    await actualizar(encargo.id, { estado: "error" satisfies EstadoEncargo, aviso, paso_hasta: null, reintentar_en: null });
  }
}

/**
 * Límite de Groq con poca espera (menos de 60 s): espera y reintenta una sola vez, aquí mismo si
 * cabe en esta ejecución o en la siguiente si no. Con más espera, o si vuelve a fallar, lanza el error.
 */
async function decidirConReintento(encargo: Encargo, inicio: number): Promise<Decision | "encadenado"> {
  try {
    return await decidir(encargo);
  } catch (e) {
    const espera = e instanceof LimiteIAError ? e.reintentarEnSegundos : undefined;
    if (espera === undefined || espera >= 60 || (encargo.reintentos ?? 0) >= 1) throw e;
    if (Date.now() - inicio + espera * 1000 + DURACION_LLAMADA_MS < PRESUPUESTO_MS) {
      await dormir(espera * 1000 + 500);
      return await decidir(encargo);
    }
    await actualizar(encargo.id, {
      reintentos: 1,
      paso_hasta: null,
      // + el margen de reloj: así no se toma antes de que Groq deje volver a llamar.
      reintentar_en: new Date(Date.now() + espera * 1000 + 500 + MARGEN_RELOJ_MS).toISOString(),
    });
    return "encadenado";
  }
}

/** El equipo al que se puede repartir: agentes activos con despacho, menos el Director. */
async function cargarEquipo(directorId: string): Promise<(Agente & { despacho: Despacho })[]> {
  const { data, error } = await supabase()
    .from("agentes")
    .select("*")
    .not("despacho", "is", null)
    .neq("id", directorId)
    .order("creado_en")
    .returns<(Agente & { despacho: Despacho })[]>();
  if (error) throw new Error(`No se pudo leer el equipo: ${error.message}`);
  return (data ?? []).filter((a) => a.activo !== false && a.despacho in NOMBRE_DESPACHO);
}

/** Hasta 3 imágenes adjuntas, en base64, para que el Director las vea. */
async function cargarImagenes(encargo: Encargo): Promise<ImagenIA[]> {
  const rutas = encargo.adjuntos.flatMap((a) => (a.tipo === "imagen" ? [a.ruta] : [])).slice(0, MAX_IMAGENES);
  const almacen = supabase().storage.from(BUCKET_ENCARGOS);
  return Promise.all(
    rutas.map(async (ruta) => {
      const { data, error } = await almacen.download(ruta);
      if (error || !data) throw new IAError(`No se pudo leer una imagen adjunta: ${error?.message ?? ruta}`);
      return { tipo: "image/jpeg" as const, base64: Buffer.from(await data.arrayBuffer()).toString("base64") };
    }),
  );
}

const INSTRUCCIONES_REPARTO = `Ahora tu trabajo es REPARTIR este encargo, no hacerlo tú.
- Decide qué agente o agentes del equipo deben hacerlo. Puede ser más de uno (por ejemplo, el Diseñador para el cartel e Instagram para la publicación). Elige solo agentes de la lista del equipo, por su id, y solo los que de verdad hagan falta.
- Para cada uno, escribe instrucciones claras y concretas: qué tiene que entregar, en qué formato e idioma, y copia los datos exactos que necesite (fechas, horas, lugares, nombres, cifras). No inventes datos.
- Si falta un dato imprescindible que no se puede sacar del encargo, de los adjuntos ni de la ficha del proyecto, NO repartas: haz una sola pregunta, corta y concreta, a la CEO (accion "preguntar", tareas vacías). No preguntes por lo que puedes decidir tú con sentido común (tono, hashtags, diseño, longitud…).
- Si repartes, deja "pregunta" vacía.
- Escribe el resumen, la pregunta y las instrucciones en español.`;

/** Lo que lee el Director: el encargo, los PDF, las preguntas ya respondidas y el equipo. */
function mensajeReparto(encargo: Encargo, proyecto: string, equipo: Agente[], imagenes: number): string {
  const partes = [`Encargo para el proyecto "${proyecto}"${encargo.urgente ? " (URGENTE)" : ""}:\n${encargo.texto.trim() || "(sin texto: mira los adjuntos)"}`];

  let restante = MAX_CARACTERES_PDF;
  const pdfs = encargo.adjuntos.flatMap((a) => (a.tipo === "pdf" ? [a] : []));
  for (const pdf of pdfs) {
    const texto = pdf.texto.slice(0, Math.max(0, restante));
    restante -= texto.length;
    partes.push(
      `PDF adjunto "${pdf.nombre}" (${pdf.paginas} págs.)${texto.length < pdf.texto.length ? ", recortado" : ""}:\n${texto || "(sin texto legible)"}`,
    );
  }
  const totalImagenes = encargo.adjuntos.filter((a) => a.tipo === "imagen").length;
  if (totalImagenes) {
    partes.push(`Imágenes adjuntas: ${totalImagenes}${imagenes < totalImagenes ? ` (te envío las ${imagenes} primeras)` : " (te las envío)"}. Los agentes las recibirán con su tarea.`);
  }

  const preguntas = (encargo.preguntas ?? []).filter((p): p is Pregunta & { respuesta: string } => p.respuesta !== null);
  if (preguntas.length) {
    partes.push(`Preguntas que ya me hiciste y mis respuestas:\n${preguntas.map((p) => `P: ${p.pregunta}\nR: ${p.respuesta}`).join("\n\n")}`);
  }

  partes.push(
    `Equipo disponible (elige por id):\n${equipo
      .map((a) => {
        const perfil = a.instrucciones.trim().replace(/\s+/g, " ");
        const corto = perfil.length > MAX_CARACTERES_PERFIL ? `${perfil.slice(0, MAX_CARACTERES_PERFIL)}…` : perfil;
        return `- id ${a.id} · ${a.nombre} (${NOMBRE_DESPACHO[a.despacho as Despacho] ?? a.despacho}): ${corto}`;
      })
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
            instrucciones: { type: "string", description: "Qué tiene que hacer y entregar, con los datos exactos." },
          },
        },
      },
    },
  };
}

/** Una llamada a la IA: el Director lee todo y decide a quién reparte (o qué pregunta). */
async function decidir(encargo: Encargo): Promise<Decision> {
  const contexto = await contextoAgente(encargo.director_id, encargo.edificio_id);
  const equipo = await cargarEquipo(encargo.director_id);
  if (!equipo.length) throw new IAError("No hay ningún agente activo en el equipo al que repartir.");
  const imagenes = await cargarImagenes(encargo);

  const decision = await generarEstructurado<Decision>({
    sistema: `${sistemaDeAgente(contexto)}\n\n${INSTRUCCIONES_REPARTO}`,
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

/** Guarda la decisión: una pregunta para mí o una tarea por agente. */
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
