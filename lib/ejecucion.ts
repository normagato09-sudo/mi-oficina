import "server-only";
import { aprendizajesPara, conAprendizajes } from "./aprendizajes";
import { contextoAgente, sistemaDeAgente } from "./datos";
import type { EstadoTarea, Tarea } from "./encargos";
import { generarEstructurado, IAError, type EsquemaJSON } from "./ia";
import { ENCADENADO, MARGEN_RELOJ_MS, ahoraConMargen, avisoDeError, conReintento, pasoHasta } from "./pasos";
import { cargarDirectorOficina, rellenarHuecos, type Proyecto } from "./proyectos";
import {
  MAX_CARACTERES_PROYECTO,
  TAREA_TERMINADA,
  type EstadoFase,
  type EstadoProyecto,
  type InfoFase,
  type ResumenFinal,
  type TareaCeoHecha,
  type TareaPlan,
} from "./proyectos-reglas";
import { supabase } from "./supabase";
import { textoDeResultado } from "./trabajos";
import type { DelProyecto, OrigenTarea } from "./trabajo";

/**
 * Los proyectos en marcha, fase a fase (migración 0016):
 *   - al aprobar el plan (y con hueco) el proyecto pasa a "en marcha" y empieza la fase 1;
 *   - cada tarea de agente es una fila de "tareas" que la cola trabaja y el Director revisa como en los
 *     encargos (lib/trabajo.ts), cuando ya están terminadas las tareas de las que depende;
 *   - las tareas para la CEO las marco yo como hechas;
 *   - con todo terminado, el Director resume la fase y la reviso: la apruebo (siguiente fase) o pido cambios
 *     (el Director decide qué tareas rehacer); tras la última, el Director escribe el resumen final.
 */

export type ProyectoEnMarcha = Proyecto & {
  fase_actual: number;
  fase_estado: EstadoFase | null;
  fases: InfoFase[];
  tareas_ceo: Record<string, TareaCeoHecha>;
  resumen_final: ResumenFinal | null;
  terminado_en: string | null;
};

/** Una tarea candidata para la cola, con su prioridad: urgente (solo encargos) y llegada (del encargo o del proyecto). */
export type TareaDelProyecto = Tarea & { urgente: boolean; llegada: string };

type FilaTarea = Pick<Tarea, "id" | "clave" | "fase" | "estado" | "aviso" | "resultado" | "texto_editado" | "titulo"> & { agentes: { nombre: string } | null };

const MAX_TOKENS_RESUMEN = 2_000;
const MAX_TOKENS_CAMBIOS = 1_500;
const MAX_TOKENS_FINAL = 2_500;
/** Lo que lee el Director de cada entrega al resumir (Groq gratis: 8.000 tokens por minuto). */
const MAX_ENTREGA_RESUMEN = 1_000;

const tareasDeFase = (p: Pick<Proyecto, "plan">, n: number): TareaPlan[] => p.plan?.fases[n]?.tareas ?? [];
const todasLasTareas = (p: Pick<Proyecto, "plan">): TareaPlan[] => p.plan?.fases.flatMap((f) => f.tareas) ?? [];
const terminada = (estado: string) => (TAREA_TERMINADA as readonly string[]).includes(estado);

async function leerProyecto(id: string): Promise<ProyectoEnMarcha> {
  const { data, error } = await supabase().from("proyectos").select("*").eq("id", id).maybeSingle<ProyectoEnMarcha>();
  if (error) throw new Error(`No se pudo leer el proyecto: ${error.message}`);
  if (!data) throw new Error("Este proyecto no existe.");
  return data;
}

async function tareasDelProyecto(id: string): Promise<FilaTarea[]> {
  const { data, error } = await supabase()
    .from("tareas")
    .select("id, clave, fase, estado, aviso, resultado, texto_editado, titulo, agentes(nombre)")
    .eq("proyecto_id", id)
    .returns<FilaTarea[]>();
  if (error) throw new Error(`No se pudieron leer las tareas del proyecto: ${error.message}`);
  return data ?? [];
}

/** Aviso de la campana sobre un proyecto (si falla, solo se anota). */
async function avisar(p: Pick<Proyecto, "id" | "nombre">, mensaje: string): Promise<void> {
  const { error } = await supabase().from("avisos").insert({ proyecto_id: p.id, mensaje: `${mensaje} · ${p.nombre}` });
  if (error) console.error(`Aviso del proyecto ${p.id}: ${error.message}`);
}

/* ───────────── Empezar proyectos y fases ───────────── */

/** Crea las tareas de agente de una fase que aún no existan (si dos ejecuciones lo intentan a la vez, gana una). */
async function crearTareasFase(p: ProyectoEnMarcha, n: number, existentes: FilaTarea[]): Promise<void> {
  const director = p.director_id ?? (await cargarDirectorOficina())?.id ?? null;
  const ya = new Set(existentes.map((t) => t.clave));
  const nuevas = tareasDeFase(p, n)
    .filter((t) => t.agente_id && !ya.has(t.id))
    .map((t) => ({
      proyecto_id: p.id,
      fase: n,
      clave: t.id,
      titulo: t.titulo,
      agente_id: t.agente_id,
      depende_de: t.depende_de,
      instrucciones: [t.titulo, t.descripcion, t.entrega && `Entrega: ${t.entrega}`].filter(Boolean).join("\n"),
    }));
  if (!nuevas.length || !director) return;
  const { error } = await supabase().from("tareas").insert(nuevas);
  // 23505: otra ejecución acaba de crearlas.
  if (error && error.code !== "23505") throw new Error(`No se pudieron crear las tareas de la fase: ${error.message}`);
}

/** Los proyectos con el plan aprobado (y hueco: lo garantiza la base de datos) pasan a "en marcha" y empiezan la fase 1. */
export async function arrancarProyectos(): Promise<void> {
  const db = supabase();
  const { data, error } = await db.from("proyectos").select("id").eq("estado", "aprobado" satisfies EstadoProyecto).order("aprobado_en");
  // Sin la migración 0016 no hay fases: los proyectos se quedan en "plan aprobado".
  if (error || !data?.length) return;
  for (const { id } of data) {
    const { data: movido, error: e2 } = await db
      .from("proyectos")
      .update({ estado: "en_marcha" satisfies EstadoProyecto, fase_actual: 0, fase_estado: "trabajando" satisfies EstadoFase, aviso: null })
      .eq("id", id)
      .eq("estado", "aprobado" satisfies EstadoProyecto)
      .select("id");
    if (e2) {
      console.error(`No se pudo poner en marcha el proyecto ${id}: ${e2.message}`);
      continue;
    }
    if (movido?.length) await comprobarFase(id);
  }
}

/**
 * Pone al día la fase actual: crea las tareas que falten y, si todas (las de los agentes y las mías)
 * están terminadas, pasa la fase a "resumiendo" para que el Director escriba su resumen. Recalcula el progreso.
 */
export async function comprobarFase(id: string): Promise<void> {
  const p = await leerProyecto(id);
  let tareas = await tareasDelProyecto(id);
  if (p.estado === "en_marcha" && p.fase_estado === "trabajando") {
    const n = p.fase_actual;
    const plan = tareasDeFase(p, n);
    if (plan.some((t) => t.agente_id && !tareas.some((f) => f.clave === t.id))) {
      await crearTareasFase(p, n, tareas);
      tareas = await tareasDelProyecto(id);
    }
    const hecha = (t: TareaPlan) => (t.agente_id ? terminada(tareas.find((f) => f.clave === t.id)?.estado ?? "") : Boolean(p.tareas_ceo?.[t.id]));
    if (plan.every(hecha)) {
      await supabase()
        .from("proyectos")
        .update({ fase_estado: "resumiendo" satisfies EstadoFase, reintentar_en: new Date().toISOString(), paso_hasta: null, aviso: null, reintentos: 0 })
        .eq("id", id)
        .eq("estado", "en_marcha" satisfies EstadoProyecto)
        .eq("fase_estado", "trabajando" satisfies EstadoFase)
        .eq("fase_actual", n);
    }
  }
  await guardarProgreso(p, tareas);
}

/** Progreso: tareas terminadas (las de los agentes revisadas por el Director y las mías hechas) entre el total. */
function progresoDe(p: ProyectoEnMarcha, tareas: FilaTarea[]): number {
  if (p.estado === "terminado") return 100;
  const total = todasLasTareas(p);
  if (!total.length) return 0;
  const hechas = total.filter((t) => (t.agente_id ? terminada(tareas.find((f) => f.clave === t.id)?.estado ?? "") : Boolean(p.tareas_ceo?.[t.id])));
  return Math.round((hechas.length / total.length) * 100);
}

async function guardarProgreso(p: ProyectoEnMarcha, tareas: FilaTarea[]): Promise<void> {
  const progreso = progresoDe(p, tareas);
  if (progreso !== p.progreso) await supabase().from("proyectos").update({ progreso }).eq("id", p.id);
}

/* ───────────── Qué tareas de proyecto puede trabajar la cola ───────────── */

/**
 * Tareas de proyectos en marcha listas para trabajar o revisar: de la fase actual, sin aviso y con las tareas
 * de las que dependen terminadas. Antes, devuelve a su paso anterior las que se quedaron a medias (la ejecución
 * que las tenía se cortó): quien llama tiene el turno de la IA, así que nadie más las está trabajando.
 */
export async function tareasDeProyectoListas(): Promise<TareaDelProyecto[]> {
  const db = supabase();
  const { data: proyectos, error } = await db
    .from("proyectos")
    .select("id, creado_en, fase_actual, tareas_ceo")
    .eq("estado", "en_marcha" satisfies EstadoProyecto)
    .eq("fase_estado", "trabajando" satisfies EstadoFase)
    .returns<Pick<ProyectoEnMarcha, "id" | "creado_en" | "fase_actual" | "tareas_ceo">[]>();
  // Sin la migración 0016 no hay proyectos en marcha.
  if (error || !proyectos?.length) return [];

  const ids = proyectos.map((p) => p.id);
  const caducado = new Date(Date.now() - MARGEN_RELOJ_MS).toISOString();
  const deshacer: [EstadoTarea, EstadoTarea][] = [
    ["en_curso", "pendiente"],
    ["revisando", "revision"],
  ];
  for (const [de, a] of deshacer) {
    await db.from("tareas").update({ estado: a, paso_hasta: null }).in("proyecto_id", ids).eq("estado", de).lt("paso_hasta", caducado);
  }

  const { data: tareas, error: e2 } = await db.from("tareas").select("*").in("proyecto_id", ids).returns<Tarea[]>();
  if (e2) throw new Error(`No se pudieron leer las tareas de los proyectos: ${e2.message}`);
  const todas = tareas ?? [];
  return todas.flatMap((t) => {
    const p = proyectos.find((x) => x.id === t.proyecto_id);
    if (!p || t.fase !== p.fase_actual || t.aviso || !["pendiente", "revision"].includes(t.estado)) return [];
    const hermanas = todas.filter((h) => h.proyecto_id === p.id);
    const listas = (t.depende_de ?? []).every((clave) => {
      const de = hermanas.find((h) => h.clave === clave);
      // Si no es de un agente, es mía: hecha cuando la marco.
      return de ? terminada(de.estado) : Boolean(p.tareas_ceo?.[clave]);
    });
    return listas ? [{ ...t, urgente: false, llegada: p.creado_en }] : [];
  });
}

/** Lo que lee el agente (y el Director al revisar) de una tarea de proyecto. */
export async function cargarOrigenProyecto(tarea: Tarea): Promise<{ encargo: OrigenTarea; proyecto: DelProyecto }> {
  const [p, filas, director] = await Promise.all([
    leerProyecto(tarea.proyecto_id!),
    tareasDelProyecto(tarea.proyecto_id!),
    cargarDirectorOficina(),
  ]);
  const fase = p.plan?.fases[tarea.fase ?? 0];
  const plan = todasLasTareas(p);
  const texto = [`Objetivo: ${p.objetivo}`, p.notas && `Notas: ${p.notas}`, p.fecha_limite && `Fecha límite: ${p.fecha_limite}`].filter(Boolean).join("\n\n");
  const dependencias = (tarea.depende_de ?? []).flatMap((clave) => {
    const fila = filas.find((f) => f.clave === clave);
    const delPlan = plan.find((t) => t.id === clave);
    if (fila) {
      return [{ clave, titulo: fila.titulo ?? delPlan?.titulo ?? clave, agente: fila.agentes?.nombre ?? "Agente", resultado: fila.texto_editado || fila.resultado }];
    }
    const ceo = p.tareas_ceo?.[clave];
    if (!delPlan || !ceo) return [];
    return [{ clave, titulo: delPlan.titulo, agente: "CEO", resultado: `Hecho por la CEO.${ceo.nota ? ` Nota: ${ceo.nota}` : ""}` }];
  });
  return {
    encargo: { edificio_id: p.edificio_id, director_id: p.director_id ?? director?.id ?? "", texto, adjuntos: p.adjuntos },
    proyecto: {
      nombre: p.nombre,
      fase: { numero: (tarea.fase ?? 0) + 1, total: p.plan?.fases.length ?? 1, nombre: fase?.nombre ?? "", objetivo: fase?.objetivo ?? "" },
      dependencias,
    },
  };
}

/* ───────────── Pasos del Director: resumen de fase, qué rehacer y resumen final ───────────── */

/** Toma un proyecto en el que el Director tiene que escribir (el más antiguo), si nadie lo tiene ya. */
export async function tomarPasoProyecto(): Promise<ProyectoEnMarcha | null> {
  const db = supabase();
  const ahora = ahoraConMargen();
  const libre = `paso_hasta.is.null,paso_hasta.lt.${ahora}`;
  const pasos: EstadoFase[] = ["resumiendo", "cambios", "final"];
  const { data: candidatos, error } = await db
    .from("proyectos")
    .select("id")
    .eq("estado", "en_marcha" satisfies EstadoProyecto)
    .in("fase_estado", pasos)
    .is("aviso", null)
    .lte("reintentar_en", ahora)
    .or(libre)
    .order("creado_en")
    .limit(1)
    .returns<{ id: string }[]>();
  if (error || !candidatos?.[0]) return null;
  const { data, error: e2 } = await db
    .from("proyectos")
    .update({ reintentar_en: null, paso_hasta: pasoHasta() })
    .eq("id", candidatos[0].id)
    .eq("estado", "en_marcha" satisfies EstadoProyecto)
    .in("fase_estado", pasos)
    .lte("reintentar_en", ahora)
    .or(libre)
    .select("*")
    .returns<ProyectoEnMarcha[]>();
  if (e2) throw new Error(`No se pudo tomar el proyecto: ${e2.message}`);
  return data?.[0] ?? null;
}

/** Guarda cambios del proyecto solo si sigue en marcha y en el mismo paso (si lo he cancelado, no se toca). */
async function guardarPaso(p: ProyectoEnMarcha, cambios: Record<string, unknown>): Promise<boolean> {
  const { data, error } = await supabase()
    .from("proyectos")
    .update(cambios)
    .eq("id", p.id)
    .eq("estado", "en_marcha" satisfies EstadoProyecto)
    .eq("fase_estado", p.fase_estado!)
    .eq("fase_actual", p.fase_actual)
    .select("id");
  if (error) throw new Error(`No se pudo guardar el proyecto: ${error.message}`);
  return Boolean(data?.length);
}

/** Un paso del Director con un proyecto en marcha. Si falla: aviso en el proyecto (rojo, "Reintentar"). */
export async function procesarPasoProyecto(p: ProyectoEnMarcha, inicio: number): Promise<void> {
  try {
    const guardar = await conReintento(() => (p.fase_estado === "cambios" ? decidirCambios(p) : p.fase_estado === "final" ? escribirFinal(p) : resumirFase(p)), {
      reintentos: p.reintentos ?? 0,
      inicio,
      encadenar: (reintentarEn) => guardarPaso(p, { reintentos: 1, paso_hasta: null, reintentar_en: reintentarEn }).then(() => undefined),
    });
    if (guardar === ENCADENADO) return;
    await guardar();
  } catch (e) {
    const aviso = avisoDeError(e);
    console.error(`Proyecto ${p.id}:`, aviso);
    await guardarPaso(p, { aviso, paso_hasta: null, reintentar_en: null });
  }
}

async function sistemaDirector(p: ProyectoEnMarcha, instrucciones: string): Promise<string> {
  const directorId = p.director_id ?? (await cargarDirectorOficina())?.id;
  if (!directorId) throw new IAError("No hay ningún Director activo.");
  const [contexto, aprendizajes] = await Promise.all([contextoAgente(directorId, p.edificio_id), aprendizajesPara(directorId, p.edificio_id)]);
  return conAprendizajes(`${sistemaDeAgente(contexto)}\n\n${instrucciones}`, aprendizajes);
}

/** Las entregas de una fase, en texto corto para el Director. */
function entregasEnTexto(p: ProyectoEnMarcha, n: number, filas: FilaTarea[], max: number): string {
  return tareasDeFase(p, n)
    .map((t) => {
      if (!t.agente_id) {
        const ceo = p.tareas_ceo?.[t.id];
        return `--- ${t.id} · ${t.titulo} (tarea de la CEO): ${ceo ? `hecha${ceo.nota ? `. Nota: ${ceo.nota}` : ""}` : "pendiente"}`;
      }
      const f = filas.find((x) => x.clave === t.id);
      const texto = (f?.texto_editado || f?.resultado || "(sin entrega)").slice(0, max);
      return `--- ${t.id} · ${t.titulo} (${f?.agentes?.nombre ?? t.agente}):\n${texto}`;
    })
    .join("\n\n");
}

function cabecera(p: ProyectoEnMarcha, n: number): string {
  const fase = p.plan?.fases[n];
  return `Proyecto "${p.nombre}". Objetivo: ${p.objetivo.slice(0, 1_500)}\n\nFase ${n + 1} de ${p.plan?.fases.length ?? 1}: ${fase?.nombre ?? ""}. Objetivo de la fase: ${fase?.objetivo ?? ""}`;
}

const INSTRUCCIONES_RESUMEN = `Ahora escribes el RESUMEN de una fase terminada de un proyecto, para que la CEO la revise.
- Corto: de 2 a 5 frases. Qué se ha preparado en la fase, si cumple el objetivo y si hay algo que la CEO deba mirar con atención (un dato que falta, una duda, algo que quedó flojo).
- No inventes nada que no esté en las entregas. Escribe en español.`;

/** El Director resume la fase: pasa a "para revisar" (luz roja). */
async function resumirFase(p: ProyectoEnMarcha): Promise<() => Promise<void>> {
  const n = p.fase_actual;
  const filas = await tareasDelProyecto(p.id);
  const r = await generarEstructurado<{ resumen: string }>({
    sistema: await sistemaDirector(p, INSTRUCCIONES_RESUMEN),
    mensaje: `${cabecera(p, n)}\n\nEntregas de la fase:\n${entregasEnTexto(p, n, filas, MAX_ENTREGA_RESUMEN)}`,
    nombre: "resumen_fase",
    esquema: { type: "object", additionalProperties: false, required: ["resumen"], properties: { resumen: { type: "string" } } },
    maxTokens: MAX_TOKENS_RESUMEN,
  });
  const resumen = String(r.resumen ?? "").trim() || "Fase terminada.";
  return async () => {
    const fases = [...(p.fases ?? [])];
    fases[n] = { ...fases[n], resumen };
    const ok = await guardarPaso(p, { fases, fase_estado: "para_revisar" satisfies EstadoFase, aviso: null, paso_hasta: null, reintentos: 0 });
    if (ok) await avisar(p, `Fase ${n + 1} lista para revisar`);
  };
}

const INSTRUCCIONES_CAMBIOS = `La CEO ha revisado una fase de un proyecto y pide cambios. Decide qué tareas hay que rehacer para cumplirlos: SOLO esas (si un cambio afecta a varias, todas las afectadas). Para cada una, explica en "que_cambiar" qué tiene que cambiar el agente, concreto y en una o dos frases. En "nota", una frase para la CEO con lo que vas a hacer. Escribe en español.`;

/** El Director decide qué tareas de la fase se rehacen con mi comentario; los agentes las rehacen y la fase vuelve a "trabajando". */
async function decidirCambios(p: ProyectoEnMarcha): Promise<() => Promise<void>> {
  const n = p.fase_actual;
  const comentario = p.fases?.[n]?.cambios?.at(-1) ?? "";
  const filas = (await tareasDelProyecto(p.id)).filter((f) => f.fase === n);
  const claves = filas.map((f) => f.clave!).filter(Boolean);
  if (!claves.length) {
    // Sin tareas de agentes en la fase no hay nada que rehacer: vuelve a "para revisar".
    return async () => {
      await guardarPaso(p, { fase_estado: "para_revisar" satisfies EstadoFase, paso_hasta: null, reintentos: 0 });
    };
  }
  const r = await generarEstructurado<{ tareas: { clave: string; que_cambiar: string }[]; nota: string }>({
    sistema: await sistemaDirector(p, INSTRUCCIONES_CAMBIOS),
    mensaje: `${cabecera(p, n)}\n\nEntregas de la fase:\n${entregasEnTexto(p, n, filas, 800)}\n\nCambios que pide la CEO:\n${comentario}`,
    nombre: "cambios_fase",
    esquema: {
      type: "object",
      additionalProperties: false,
      required: ["tareas", "nota"],
      properties: {
        tareas: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["clave", "que_cambiar"],
            properties: { clave: { type: "string", enum: claves }, que_cambiar: { type: "string" } },
          },
        },
        nota: { type: "string" },
      },
    } satisfies EsquemaJSON,
    maxTokens: MAX_TOKENS_CAMBIOS,
  });
  const elegidas = new Map<string, string>();
  for (const t of Array.isArray(r.tareas) ? r.tareas : []) {
    const clave = String(t?.clave ?? "");
    if (claves.includes(clave)) elegidas.set(clave, String(t?.que_cambiar ?? "").trim());
  }
  // Si el Director no elige ninguna, se rehacen todas las de la fase.
  if (!elegidas.size) for (const c of claves) elegidas.set(c, "");

  return async () => {
    const db = supabase();
    for (const [clave, queCambiar] of elegidas) {
      const fila = filas.find((f) => f.clave === clave)!;
      const { error } = await db
        .from("tareas")
        .update({
          estado: "pendiente" satisfies EstadoTarea,
          comentario_ceo: `${comentario}${queCambiar ? `\n\nLo que tienes que cambiar, según el Director: ${queCambiar}` : ""}`,
          comentarios: null,
          vueltas: 0,
          nota_director: null,
          aviso: null,
          reintentos: 0,
          reintentar_en: null,
          paso_hasta: null,
          resultado_agente: null,
          resultado_agente_texto: null,
        })
        .eq("id", fila.id);
      if (error) throw new Error(`No se pudo devolver la tarea ${clave}: ${error.message}`);
    }
    await guardarPaso(p, { fase_estado: "trabajando" satisfies EstadoFase, paso_hasta: null, reintentos: 0, aviso: null });
    await comprobarFase(p.id);
  };
}

const INSTRUCCIONES_FINAL = `Ahora escribes el RESUMEN FINAL de un proyecto terminado, para que la CEO lo revise.
- "hecho": de 3 a 6 frases con lo que se ha conseguido.
- "entregas": la lista de TODAS las entregas, una por línea: "T1 · título (agente): qué es".
- "pendiente_ceo": lo que queda por hacer por parte de la CEO (publicar, enviar, subir, pagar…), sacado de sus tareas y de las entregas. Vacía si no queda nada.
- El equipo no publica, no envía ni despliega nada: todo eso es de la CEO. No inventes. Escribe en español.`;

/** El Director escribe el resumen final: el proyecto pasa a "final para revisar" (luz roja). */
async function escribirFinal(p: ProyectoEnMarcha): Promise<() => Promise<void>> {
  const filas = await tareasDelProyecto(p.id);
  const fases = (p.plan?.fases ?? []).map((f, i) => {
    const lista = f.tareas
      .map((t) => {
        if (!t.agente_id) return `- ${t.id} · ${t.titulo} (CEO): ${p.tareas_ceo?.[t.id] ? "hecha" : "pendiente"}`;
        const fila = filas.find((x) => x.clave === t.id);
        return `- ${t.id} · ${t.titulo} (${fila?.agentes?.nombre ?? t.agente}): ${(fila?.texto_editado || fila?.resultado || "").replace(/\s+/g, " ").slice(0, 200)}`;
      })
      .join("\n");
    return `Fase ${i + 1}: ${f.nombre}\nResumen: ${p.fases?.[i]?.resumen ?? "—"}\n${lista}`;
  });
  const r = await generarEstructurado<ResumenFinal>({
    sistema: await sistemaDirector(p, INSTRUCCIONES_FINAL),
    mensaje: `Proyecto "${p.nombre}". Objetivo: ${p.objetivo.slice(0, 1_500)}\nLo que debía quedar hecho al 100 %: ${p.plan?.resultado_final ?? ""}\n\n${fases.join("\n\n")}`,
    nombre: "resumen_final",
    esquema: {
      type: "object",
      additionalProperties: false,
      required: ["hecho", "entregas", "pendiente_ceo"],
      properties: {
        hecho: { type: "string" },
        entregas: { type: "array", items: { type: "string" } },
        pendiente_ceo: { type: "array", items: { type: "string" } },
      },
    },
    maxTokens: MAX_TOKENS_FINAL,
  });
  const lista = (x: unknown) => (Array.isArray(x) ? x.map((s) => String(s ?? "").trim()).filter(Boolean) : []);
  const resumen: ResumenFinal = { hecho: String(r.hecho ?? "").trim(), entregas: lista(r.entregas), pendiente_ceo: lista(r.pendiente_ceo) };
  return async () => {
    const ok = await guardarPaso(p, {
      resumen_final: resumen,
      estado: "final_revision" satisfies EstadoProyecto,
      aviso: null,
      paso_hasta: null,
      reintentos: 0,
    });
    if (ok) await avisar(p, "Final del proyecto listo para revisar");
  };
}

/* ───────────── Lo que hago yo ───────────── */

function nota(texto: string): string {
  const t = String(texto ?? "").replace(/\r\n/g, "\n").trim();
  if (t.length > 2_000) throw new Error("La nota admite como máximo 2.000 caracteres.");
  return t;
}

/** Marco como hecha una tarea para la CEO de la fase actual (con una nota opcional). */
export async function marcarTareaCeo(id: string, clave: string, textoNota: string): Promise<void> {
  const p = await leerProyecto(id);
  if (p.estado !== "en_marcha") throw new Error("Este proyecto no está en marcha.");
  const tarea = tareasDeFase(p, p.fase_actual).find((t) => t.id === clave && !t.agente_id);
  if (!tarea) throw new Error("Esta tarea no es tuya o no es de la fase actual.");
  const tareas_ceo = { ...(p.tareas_ceo ?? {}), [clave]: { hecha_en: new Date().toISOString(), nota: nota(textoNota) } };
  const { data, error } = await supabase()
    .from("proyectos")
    .update({ tareas_ceo })
    .eq("id", id)
    .eq("estado", "en_marcha" satisfies EstadoProyecto)
    .eq("fase_actual", p.fase_actual)
    .select("id");
  if (error) throw new Error(`No se pudo guardar: ${error.message}`);
  if (!data?.length) throw new Error("El proyecto ha cambiado. Vuelve a intentarlo.");
  await comprobarFase(id);
}

/** "Aprobar fase": sus entregas quedan aprobadas y empieza la siguiente (o, tras la última, el resumen final). */
export async function aprobarFase(id: string): Promise<void> {
  const p = await leerProyecto(id);
  if (p.estado !== "en_marcha" || p.fase_estado !== "para_revisar") throw new Error("Esta fase ya no está para revisar.");
  const n = p.fase_actual;
  const ultima = n + 1 >= (p.plan?.fases.length ?? 0);
  const fases = [...(p.fases ?? [])];
  fases[n] = { ...fases[n], aprobada_en: new Date().toISOString() };
  const ahora = new Date().toISOString();

  const { data, error } = await supabase()
    .from("proyectos")
    .update(
      ultima
        ? { fases, fase_estado: "final" satisfies EstadoFase, reintentar_en: ahora, paso_hasta: null, aviso: null, reintentos: 0 }
        : { fases, fase_actual: n + 1, fase_estado: "trabajando" satisfies EstadoFase, aviso: null },
    )
    .eq("id", id)
    .eq("estado", "en_marcha" satisfies EstadoProyecto)
    .eq("fase_estado", "para_revisar" satisfies EstadoFase)
    .eq("fase_actual", n)
    .select("id");
  if (error) throw new Error(`No se pudo aprobar la fase: ${error.message}`);
  if (!data?.length) throw new Error("Esta fase ya no está para revisar.");

  const { error: e2 } = await supabase()
    .from("tareas")
    .update({ estado: "aprobada" satisfies EstadoTarea, aprobada_en: ahora })
    .eq("proyecto_id", id)
    .eq("fase", n)
    .in("estado", ["revisada", "lista"] satisfies EstadoTarea[]);
  if (e2) throw new Error(`No se pudieron aprobar las entregas: ${e2.message}`);
  await comprobarFase(id);
}

/** "Pedir cambios" en la fase: el Director decide qué tareas rehacer. */
export async function pedirCambiosFase(id: string, comentario: string): Promise<void> {
  const texto = String(comentario ?? "").replace(/\r\n/g, "\n").trim();
  if (!texto) throw new Error("Escribe qué quieres cambiar.");
  if (texto.length > MAX_CARACTERES_PROYECTO) throw new Error(`Máximo ${MAX_CARACTERES_PROYECTO.toLocaleString("es-ES")} caracteres.`);
  const p = await leerProyecto(id);
  if (p.estado !== "en_marcha" || p.fase_estado !== "para_revisar") throw new Error("Esta fase ya no está para revisar.");
  const n = p.fase_actual;
  const fases = [...(p.fases ?? [])];
  fases[n] = { ...fases[n], cambios: [...(fases[n]?.cambios ?? []), texto] };
  const { data, error } = await supabase()
    .from("proyectos")
    .update({ fases, fase_estado: "cambios" satisfies EstadoFase, reintentar_en: new Date().toISOString(), paso_hasta: null, aviso: null, reintentos: 0 })
    .eq("id", id)
    .eq("estado", "en_marcha" satisfies EstadoProyecto)
    .eq("fase_estado", "para_revisar" satisfies EstadoFase)
    .eq("fase_actual", n)
    .select("id");
  if (error) throw new Error(`No se pudieron pedir los cambios: ${error.message}`);
  if (!data?.length) throw new Error("Esta fase ya no está para revisar.");
}

/** "Aprobar final": el proyecto termina (100 %), deja hueco y el siguiente en espera avanza. */
export async function aprobarFinal(id: string): Promise<void> {
  const { data, error } = await supabase()
    .from("proyectos")
    .update({ estado: "terminado" satisfies EstadoProyecto, progreso: 100, terminado_en: new Date().toISOString(), aviso: null, paso_hasta: null, reintentar_en: null })
    .eq("id", id)
    .eq("estado", "final_revision" satisfies EstadoProyecto)
    .select("id");
  if (error) throw new Error(`No se pudo aprobar el final: ${error.message}`);
  if (!data?.length) throw new Error("Este proyecto ya no tiene el final para revisar.");
  await rellenarHuecos();
}

/** "Reintentar" en un proyecto en marcha: quita los avisos (del Director y de sus tareas) y la cola lo retoma. */
export async function reintentarEnMarcha(id: string): Promise<void> {
  const db = supabase();
  const ahora = new Date().toISOString();
  const { error: e1 } = await db
    .from("tareas")
    .update({ aviso: null, reintentos: 0, reintentar_en: ahora })
    .eq("proyecto_id", id)
    .not("aviso", "is", null);
  if (e1) throw new Error(`No se pudo reintentar: ${e1.message}`);
  const { error: e2 } = await db
    .from("proyectos")
    .update({ aviso: null, reintentos: 0, reintentar_en: ahora, paso_hasta: null })
    .eq("id", id)
    .eq("estado", "en_marcha" satisfies EstadoProyecto);
  if (e2) throw new Error(`No se pudo reintentar: ${e2.message}`);
}


/** El texto de una entrega (mi versión si la edité). */
export function textoEntrega(t: Pick<Tarea, "texto_editado" | "resultado" | "resultado_json">): string {
  return t.texto_editado || (t.resultado_json ? textoDeResultado(t.resultado_json) : t.resultado);
}
