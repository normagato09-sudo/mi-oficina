import "server-only";
import { aprendizajesPara, conAprendizajes } from "./aprendizajes";
import { contextoAgente, sistemaDeAgente } from "./datos";
import { NOMBRE_DESPACHO } from "./despachos";
import { generarEstructurado, IAError, type EsquemaJSON } from "./ia";
import { ENCADENADO, ahoraConMargen, avisoDeError, conReintento, pasoHasta, textoEncargo } from "./pasos";
import type { Proyecto } from "./proyectos";
import type { EstadoProyecto, FasePlan, Plan, TareaPlan } from "./proyectos-reglas";
import { cargarEquipo } from "./reparto";
import { supabase } from "./supabase";
import { ENTREGAS, esDespachoTrabajo } from "./trabajos";
import type { Agente, Despacho } from "./tipos";

/**
 * El plan del Director: lee el proyecto y lo divide en fases y tareas (qué agente hace cada una y de cuáles
 * depende), o me pregunta lo que le falta. Es un paso más de la cola (lib/cola.ts), como el reparto.
 */

/** Groq gratis: 8.000 tokens por minuto entre lo que lee y lo que escribe (el plan es lo más largo). */
const MAX_TOKENS_PLAN = 4_500;
/** Texto de los PDF que lee el Director para el plan (menos que en un encargo: el plan ocupa más). */
const MAX_PDF_PLAN = 3_000;
/** Rondas de preguntas antes de que tenga que hacer el plan con lo que haya. */
const MAX_RONDAS_PREGUNTAS = 2;
/** El id con el que el Director marca una tarea para la CEO. */
const CEO = "ceo";

type TareaIA = { id: string; titulo: string; descripcion: string; agente_id: string; entrega: string; depende_de: string[]; motivo_ceo: string };
type DecisionIA = {
  accion: "plan" | "preguntar";
  preguntas: string[];
  resumen: string;
  resultado_final: string;
  fases: { nombre: string; objetivo: string; tareas: TareaIA[] }[];
};

type Decision = { accion: "preguntar"; preguntas: string[] } | { accion: "plan"; plan: Plan };

/**
 * Toma un proyecto que espera su plan (el más antiguo), si no lo está procesando otra ejecución.
 * Sin la migración 0015 no hay proyectos: devuelve null sin cortar la cola.
 */
export async function tomarProyectoListo(): Promise<Proyecto | null> {
  const db = supabase();
  const ahora = ahoraConMargen();
  const libre = `paso_hasta.is.null,paso_hasta.lt.${ahora}`;

  const { data: candidatos, error } = await db
    .from("proyectos")
    .select("id")
    .eq("estado", "borrador" satisfies EstadoProyecto)
    .lte("reintentar_en", ahora)
    .or(libre)
    .order("creado_en")
    .limit(1)
    .returns<{ id: string }[]>();
  if (error) return null;
  const id = candidatos?.[0]?.id;
  if (!id) return null;

  // Solo se lo queda si nadie lo ha cogido entre medias.
  const { data, error: e2 } = await db
    .from("proyectos")
    .update({ reintentar_en: null, paso_hasta: pasoHasta() })
    .eq("id", id)
    .eq("estado", "borrador" satisfies EstadoProyecto)
    .lte("reintentar_en", ahora)
    .or(libre)
    .select("*")
    .returns<Proyecto[]>();
  if (e2) throw new Error(`No se pudo tomar el proyecto: ${e2.message}`);
  return data?.[0] ?? null;
}

async function actualizar(id: string, cambios: Record<string, unknown>): Promise<void> {
  // Solo mientras sigue en borrador: si lo he cancelado mientras tanto, no se toca.
  const { error } = await supabase().from("proyectos").update(cambios).eq("id", id).eq("estado", "borrador" satisfies EstadoProyecto);
  if (error) throw new Error(`No se pudo actualizar el proyecto: ${error.message}`);
}

/** Un paso del Director con un proyecto: hace el plan (o pregunta) y lo guarda; si falla, aviso y "Reintentar". */
export async function procesarProyecto(proyecto: Proyecto, inicio: number): Promise<void> {
  try {
    const decision = await conReintento(() => planificar(proyecto), {
      reintentos: proyecto.reintentos ?? 0,
      inicio,
      encadenar: (reintentarEn) => actualizar(proyecto.id, { reintentos: 1, paso_hasta: null, reintentar_en: reintentarEn }),
    });
    if (decision === ENCADENADO) return;
    await guardar(proyecto, decision);
  } catch (e) {
    const aviso = avisoDeError(e);
    console.error(`Proyecto ${proyecto.id}:`, aviso);
    await actualizar(proyecto.id, { aviso, paso_hasta: null, reintentar_en: null });
  }
}

const INSTRUCCIONES_PLAN = `Ahora tu trabajo es hacer el PLAN de un proyecto (no hacerlo tú).
- Divide el proyecto en fases, en orden (entre 2 y 6), cada una con un nombre corto y su objetivo.
- En cada fase, las tareas necesarias para llegar al 100 %. Cada tarea la hace UN agente del equipo (por su id) y SOLO puede entregar lo que pone en su "Entrega": nunca PDF, Word, vídeos, A4 para imprimir ni nada que no esté en su lista. En "entrega" escribe qué entregará, de su lista.
- Límite honesto: el equipo prepara todo (textos, carteles, código, calendarios, análisis…), pero NO publica, NO envía, NO despliega, NO paga, NO contacta con nadie y NO crea cuentas. "100 %" significa todo preparado y aprobado por la CEO. Si una tarea necesita algo que el equipo no puede hacer (publicar, enviar correos, subir la web, pagar, grabar, reunirse…), ponla como tarea para la CEO (agente_id "ceo") y explica en "motivo_ceo" por qué la tiene que hacer ella. En las demás tareas, "motivo_ceo" vacío.
- Ids de las tareas: "T1", "T2"… seguidos en todo el plan. En "depende_de", los ids de las tareas anteriores cuyo resultado le hace falta (vacío si no depende de ninguna). Nunca una tarea posterior.
- En "descripcion", qué tiene que hacer, en una o dos frases, con los datos exactos que te han dado (fechas, nombres, cifras). No inventes datos.
- Entre 4 y 20 tareas en total. Frases cortas.
- Si falta información IMPORTANTE para planificar (no detalles que puedas decidir tú con sentido común), no hagas el plan: accion "preguntar", de 1 a 3 preguntas cortas y concretas, y fases vacías. Nunca preguntes por fotos, logos ni colores.
- Si hay un plan anterior y cambios pedidos por la CEO, rehaz el plan aplicando esos cambios.
- "resumen": 2 o 3 frases sobre el plan. "resultado_final": qué quedará hecho al 100 %.
- Escribe todo en español.`;

function fechaHoy(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
}

/** El plan anterior, en texto corto (para rehacerlo con los cambios). */
function planEnTexto(plan: Plan): string {
  return plan.fases
    .map(
      (f, i) =>
        `Fase ${i + 1}: ${f.nombre} (${f.objetivo})\n${f.tareas
          .map((t) => `- ${t.id} · ${t.agente}: ${t.titulo}${t.depende_de.length ? ` (depende de ${t.depende_de.join(", ")})` : ""}`)
          .join("\n")}`,
    )
    .join("\n");
}

/** Lo que lee el Director: el proyecto, sus adjuntos, mis respuestas, el plan anterior con mis cambios y el equipo. */
function mensajePlan(p: Proyecto, organizacion: string, equipo: (Agente & { despacho: Despacho })[]): string {
  const texto = [`Objetivo: ${p.objetivo}`, p.notas && `Notas: ${p.notas}`].filter(Boolean).join("\n\n");
  const partes = [
    `Hoy es ${fechaHoy()}.`,
    `Proyecto "${p.nombre}" de la organización "${organizacion}"${p.fecha_limite ? `, con fecha límite ${p.fecha_limite}` : ", sin fecha límite"}:\n${textoEncargo({ texto, adjuntos: p.adjuntos }, 0, MAX_PDF_PLAN)}`,
  ];
  const respondidas = (p.preguntas ?? []).filter((q) => q.respuesta !== null);
  if (respondidas.length) partes.push(`Preguntas que ya me hiciste y mis respuestas:\n${respondidas.map((q) => `P: ${q.pregunta}\nR: ${q.respuesta}`).join("\n\n")}`);
  if (p.plan && p.cambios_pedidos) {
    partes.push(`Tu plan anterior:\n${planEnTexto(p.plan)}\n\nCambios que pide la CEO (aplícalos):\n${p.cambios_pedidos}`);
  }
  partes.push(
    `Equipo disponible (elige por id; para una tarea de la CEO, "${CEO}"):\n${equipo
      .map((a) => `- id ${a.id} · ${a.nombre} (${NOMBRE_DESPACHO[a.despacho]}). Entrega: ${esDespachoTrabajo(a.despacho) ? ENTREGAS[a.despacho] : "—"}`)
      .join("\n")}`,
  );
  return partes.join("\n\n");
}

function esquemaPlan(ids: string[], puedePreguntar: boolean): EsquemaJSON {
  const texto = (description?: string) => ({ type: "string", ...(description ? { description } : {}) });
  return {
    type: "object",
    additionalProperties: false,
    required: ["accion", "preguntas", "resumen", "resultado_final", "fases"],
    properties: {
      accion: { type: "string", enum: puedePreguntar ? ["plan", "preguntar"] : ["plan"] },
      preguntas: { type: "array", items: texto(), description: "Solo si accion es preguntar: de 1 a 3 preguntas cortas. Si no, vacía." },
      resumen: texto("2 o 3 frases sobre el plan (vacío si preguntas)."),
      resultado_final: texto("Qué quedará hecho al 100 % (vacío si preguntas)."),
      fases: {
        type: "array",
        description: "Las fases en orden. Vacía si accion es preguntar.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["nombre", "objetivo", "tareas"],
          properties: {
            nombre: texto(),
            objetivo: texto(),
            tareas: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "titulo", "descripcion", "agente_id", "entrega", "depende_de", "motivo_ceo"],
                properties: {
                  id: texto('"T1", "T2"… seguidos en todo el plan.'),
                  titulo: texto("Qué hay que hacer, en pocas palabras."),
                  descripcion: texto(),
                  agente_id: { type: "string", enum: [...ids, CEO] },
                  entrega: texto("Qué entregará el agente, de su lista (vacío si es para la CEO)."),
                  depende_de: { type: "array", items: texto(), description: "Ids de tareas anteriores cuyo resultado necesita." },
                  motivo_ceo: texto("Solo en tareas de la CEO: por qué no la puede hacer el equipo. Si no, vacío."),
                },
              },
            },
          },
        },
      },
    },
  };
}

/** Una llamada a la IA: el Director lee el proyecto y hace el plan (o pregunta). */
async function planificar(p: Proyecto): Promise<Decision> {
  if (!p.director_id) throw new IAError("Este proyecto no tiene Director que haga el plan.");
  const [contexto, equipo, aprendizajes] = await Promise.all([
    contextoAgente(p.director_id, p.edificio_id),
    cargarEquipo(p.director_id),
    aprendizajesPara(p.director_id, p.edificio_id),
  ]);
  if (!equipo.length) throw new IAError("No hay ningún agente activo en el equipo para hacer el plan.");

  const rondas = (p.preguntas ?? []).filter((q) => q.respuesta !== null).length;
  const decision = await generarEstructurado<DecisionIA>({
    sistema: conAprendizajes(`${sistemaDeAgente(contexto)}\n\n${INSTRUCCIONES_PLAN}`, aprendizajes),
    mensaje: mensajePlan(p, contexto.organizacion.nombre, equipo),
    nombre: "plan_director",
    esquema: esquemaPlan(
      equipo.map((a) => a.id),
      rondas < MAX_RONDAS_PREGUNTAS,
    ),
    maxTokens: MAX_TOKENS_PLAN,
  });

  const preguntas = (Array.isArray(decision.preguntas) ? decision.preguntas : []).map((q) => String(q ?? "").trim()).filter(Boolean).slice(0, 3);
  if (decision.accion === "preguntar" && preguntas.length && rondas < MAX_RONDAS_PREGUNTAS) return { accion: "preguntar", preguntas };

  const plan = ordenarPlan(decision, new Map(equipo.map((a) => [a.id, a.nombre])));
  if (!plan.fases.length) throw new IAError("El Director no ha sabido hacer el plan. Reintenta o añade más detalles al objetivo.");
  return { accion: "plan", plan };
}

/**
 * Por si la IA se sale de lo pedido: tareas numeradas T1, T2… en orden, agentes del equipo (o la CEO),
 * dependencias solo de tareas anteriores y sin fases vacías.
 */
function ordenarPlan(d: DecisionIA, nombres: Map<string, string>): Plan {
  const nuevoId = new Map<string, string>();
  let n = 0;
  const fases: FasePlan[] = [];
  for (const f of Array.isArray(d.fases) ? d.fases : []) {
    const tareas: TareaPlan[] = [];
    for (const t of Array.isArray(f?.tareas) ? f.tareas : []) {
      const titulo = String(t?.titulo ?? "").trim();
      if (!titulo) continue;
      const id = `T${++n}`;
      const original = String(t.id ?? "").trim();
      const depende_de = [
        ...new Set((Array.isArray(t.depende_de) ? t.depende_de : []).map((x) => nuevoId.get(String(x).trim())).filter((x): x is string => !!x)),
      ];
      if (original && !nuevoId.has(original)) nuevoId.set(original, id);
      const agente = nombres.get(String(t.agente_id ?? ""));
      tareas.push({
        id,
        titulo,
        descripcion: String(t.descripcion ?? "").trim(),
        agente_id: agente ? String(t.agente_id) : null,
        agente: agente ?? "CEO",
        entrega: agente ? String(t.entrega ?? "").trim() : "",
        depende_de,
        motivo_ceo: agente ? "" : String(t.motivo_ceo ?? "").trim() || "El equipo no puede hacer esta parte.",
      });
    }
    if (tareas.length) fases.push({ nombre: String(f.nombre ?? "").trim() || `Fase ${fases.length + 1}`, objetivo: String(f.objetivo ?? "").trim(), tareas });
  }
  return {
    resumen: String(d.resumen ?? "").trim(),
    resultado_final: String(d.resultado_final ?? "").trim(),
    fases,
    creado_en: new Date().toISOString(),
  };
}

/** Guarda las preguntas (luz roja, espera mi respuesta) o el plan ("plan para revisar", luz roja). */
async function guardar(p: Proyecto, decision: Decision): Promise<void> {
  const comun = { aviso: null, paso_hasta: null, reintentar_en: null, reintentos: 0 };
  if (decision.accion === "preguntar") {
    await actualizar(p.id, {
      ...comun,
      estado: "esperando_respuesta" satisfies EstadoProyecto,
      preguntas: [...(p.preguntas ?? []), { pregunta: decision.preguntas.join("\n"), respuesta: null }],
    });
    return;
  }
  await actualizar(p.id, { ...comun, estado: "plan_revision" satisfies EstadoProyecto, plan: decision.plan, cambios_pedidos: null });
}
