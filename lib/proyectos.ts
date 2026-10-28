import "server-only";
import { randomUUID } from "node:crypto";
import { comprobarSubidas, conAdjuntos, firmarImagenes, MINUTOS_ATASCADO, type Adjunto, type AdjuntoImagen, type AdjuntoPdf, type Pregunta } from "./encargos";
import { MAX_CARACTERES_PROYECTO, MAX_NOMBRE_PROYECTO, type EstadoProyecto, type Plan, type VersionPlan } from "./proyectos-reglas";
import { supabase } from "./supabase";
import type { Agente, Edificio } from "./tipos";

/**
 * Proyectos: trabajos grandes de una organización que el equipo hace hasta el 100 % (migración 0015).
 * Al crearlo, el Director hace un plan por fases (lib/plan.ts); yo lo apruebo o pido cambios.
 */

export type Proyecto = {
  id: string;
  /** Organización del proyecto (tabla edificios). */
  edificio_id: string;
  director_id: string | null;
  nombre: string;
  objetivo: string;
  /** "AAAA-MM-DD" o null. */
  fecha_limite: string | null;
  notas: string;
  adjuntos: Adjunto[];
  estado: EstadoProyecto;
  plan: Plan | null;
  versiones: VersionPlan[];
  /** Cambios que he pedido y el Director aún no ha aplicado. */
  cambios_pedidos: string | null;
  preguntas: Pregunta[];
  progreso: number;
  aprobado_en: string | null;
  aviso: string | null;
  reintentar_en: string | null;
  paso_hasta: string | null;
  reintentos: number;
  creado_en: string;
  actualizado_en: string;
};

type Organizacion = Pick<Edificio, "nombre" | "color">;

/** Un proyecto para la lista del panel. */
export type ProyectoResumen = Pick<Proyecto, "id" | "nombre" | "estado" | "progreso" | "fecha_limite" | "aviso" | "creado_en"> & {
  organizacion: Organizacion;
  /** Turno de los que están "en espera" (1 = el siguiente), o null. */
  turno: number | null;
};

/** Un proyecto con todo su detalle (imágenes con URL firmada). */
export type ProyectoVista = Omit<Proyecto, "adjuntos"> & {
  adjuntos: ((AdjuntoImagen & { url: string | null }) | (Omit<AdjuntoPdf, "texto"> & { caracteres: number }))[];
  organizacion: Organizacion;
  turno: number | null;
  /** Lleva demasiado tiempo haciendo el plan sin avanzar (se cortó la ejecución): "Reanudar". */
  atascado: boolean;
};

const SIN_MIGRACION = "¿Has ejecutado la migración 0015?";

function organizacionDe(fila: { edificios: Organizacion | null }): Organizacion {
  return { nombre: fila.edificios?.nombre ?? "Organización", color: fila.edificios?.color ?? "#8a93ad" };
}

/** Turno de cada proyecto "en espera": por orden de aprobación. */
async function turnos(): Promise<Map<string, number>> {
  const { data } = await supabase()
    .from("proyectos")
    .select("id")
    .eq("estado", "en_espera" satisfies EstadoProyecto)
    .order("aprobado_en")
    .order("creado_en")
    .order("id")
    .returns<{ id: string }[]>();
  return new Map((data ?? []).map((p, i) => [p.id, i + 1]));
}

export function proyectoAtascado(p: Pick<Proyecto, "estado" | "aviso" | "reintentar_en" | "paso_hasta" | "actualizado_en">): boolean {
  if (p.estado !== "borrador" || p.aviso) return false;
  // Nadie lo tiene (ni debe retomarlo) o quien lo tenía se cortó, y lleva mucho sin moverse.
  const sinDueño = !p.reintentar_en && (!p.paso_hasta || Date.parse(p.paso_hasta) < Date.now());
  return sinDueño && Date.now() - Date.parse(p.actualizado_en) > MINUTOS_ATASCADO * 60_000;
}

/* ───────────── Leer ───────────── */

/** Todos los proyectos: primero los que están vivos y después los terminados y cancelados; los más nuevos arriba. */
export async function cargarProyectos(): Promise<ProyectoResumen[]> {
  const [{ data, error }, turno] = await Promise.all([
    supabase()
      .from("proyectos")
      .select("id, nombre, estado, progreso, fecha_limite, aviso, creado_en, edificios(nombre, color)")
      .order("creado_en", { ascending: false })
      .returns<(Omit<ProyectoResumen, "organizacion" | "turno"> & { edificios: Organizacion | null })[]>(),
    turnos(),
  ]);
  if (error) throw new Error(`No se pudieron leer los proyectos: ${error.message}. ${SIN_MIGRACION}`);
  const cerrado = (e: EstadoProyecto) => e === "terminado" || e === "cancelado";
  return (data ?? [])
    .map(({ edificios, ...p }) => ({ ...p, organizacion: organizacionDe({ edificios }), turno: turno.get(p.id) ?? null }))
    .sort((a, b) => Number(cerrado(a.estado)) - Number(cerrado(b.estado)));
}

/** Un proyecto con todo su detalle, o null si no existe. */
export async function cargarProyecto(id: string): Promise<ProyectoVista | null> {
  const [{ data, error }, turno] = await Promise.all([
    supabase()
      .from("proyectos")
      .select("*, edificios(nombre, color)")
      .eq("id", id)
      .maybeSingle<Proyecto & { edificios: Organizacion | null }>(),
    turnos(),
  ]);
  if (error) throw new Error(`No se pudo leer el proyecto: ${error.message}. ${SIN_MIGRACION}`);
  if (!data) return null;
  const { edificios, ...p } = data;
  const urls = await firmarImagenes(p.adjuntos.flatMap((a) => (a.tipo === "imagen" ? [a.ruta] : [])));
  return {
    ...p,
    adjuntos: p.adjuntos.map((a) =>
      a.tipo === "imagen"
        ? { ...a, url: urls.get(a.ruta) ?? null }
        : { tipo: "pdf" as const, nombre: a.nombre, paginas: a.paginas, caracteres: a.texto.length },
    ),
    organizacion: organizacionDe({ edificios }),
    turno: turno.get(p.id) ?? null,
    atascado: proyectoAtascado(p),
  };
}

/* ───────────── Crear ───────────── */

/** El Director de la oficina (activo y en su despacho), o null si no hay. */
export async function cargarDirectorOficina(): Promise<Agente | null> {
  const { data, error } = await supabase()
    .from("agentes")
    .select("*")
    .eq("tipo", "direccion")
    .eq("despacho", "direccion")
    .order("creado_en")
    .returns<Agente[]>();
  if (error) throw new Error(`No se pudo leer el Director: ${error.message}`);
  return (data ?? []).find((a) => a.activo !== false) ?? null;
}

export type NuevoProyecto = {
  director: Agente;
  organizacionId: string;
  nombre: string;
  objetivo: string;
  fechaLimite: string | null;
  notas: string;
  subidas: { ruta: string; nombre: string; tipo: string }[];
};

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Guarda el proyecto en "borrador del plan": el Director se pone con el plan en cuanto la cola llega a él. */
export async function crearProyecto(datos: NuevoProyecto): Promise<string> {
  const nombre = datos.nombre.trim();
  const objetivo = datos.objetivo.replace(/\r\n/g, "\n").trim();
  const notas = datos.notas.replace(/\r\n/g, "\n").trim();
  const fecha = datos.fechaLimite?.trim() || null;
  if (!nombre) throw new Error("Escribe el nombre del proyecto.");
  if (nombre.length > MAX_NOMBRE_PROYECTO) throw new Error(`El nombre admite como máximo ${MAX_NOMBRE_PROYECTO} caracteres.`);
  if (!objetivo) throw new Error("Escribe el objetivo: qué quieres conseguir.");
  if (objetivo.length + notas.length > MAX_CARACTERES_PROYECTO) {
    throw new Error(`El objetivo y las notas admiten como máximo ${MAX_CARACTERES_PROYECTO.toLocaleString("es-ES")} caracteres entre los dos.`);
  }
  if (fecha && (!FECHA.test(fecha) || Number.isNaN(Date.parse(fecha)))) throw new Error("La fecha límite no es válida.");
  comprobarSubidas(datos.subidas);

  const id = randomUUID();
  await conAdjuntos(datos.subidas, `${datos.organizacionId}/proyectos/${id}`, async (adjuntos) => {
    const { error } = await supabase().from("proyectos").insert({
      id,
      edificio_id: datos.organizacionId,
      director_id: datos.director.id,
      nombre,
      objetivo,
      fecha_limite: fecha,
      notas,
      adjuntos,
      estado: "borrador" satisfies EstadoProyecto,
      reintentar_en: new Date().toISOString(),
    });
    if (error) throw new Error(`No se pudo guardar el proyecto: ${error.message}. ${SIN_MIGRACION}`);
  });
  return id;
}

/* ───────────── Mis respuestas y decisiones ───────────── */

async function leer(id: string): Promise<Proyecto> {
  const { data, error } = await supabase().from("proyectos").select("*").eq("id", id).maybeSingle<Proyecto>();
  if (error) throw new Error(`No se pudo leer el proyecto: ${error.message}`);
  if (!data) throw new Error("Este proyecto no existe.");
  return data;
}

/** Cambia el proyecto solo si sigue en `estado` (si no, otro paso ya lo ha movido). */
async function cambiar(id: string, estado: EstadoProyecto, cambios: Record<string, unknown>, siNo: string): Promise<void> {
  const { data, error } = await supabase().from("proyectos").update(cambios).eq("id", id).eq("estado", estado).select("id");
  if (error) throw new Error(`No se pudo guardar: ${error.message}`);
  if (!data?.length) throw new Error(siNo);
}

/** El Director vuelve a ponerse con el plan (lo coge la cola en cuanto puede). */
const VOLVER_A_PLANIFICAR = () => ({
  estado: "borrador" satisfies EstadoProyecto,
  aviso: null,
  paso_hasta: null,
  reintentos: 0,
  reintentar_en: new Date().toISOString(),
});

function limpio(texto: string, vacio: string): string {
  const t = texto.replace(/\r\n/g, "\n").trim();
  if (!t) throw new Error(vacio);
  if (t.length > MAX_CARACTERES_PROYECTO) throw new Error(`Máximo ${MAX_CARACTERES_PROYECTO.toLocaleString("es-ES")} caracteres.`);
  return t;
}

/** Mi respuesta a las preguntas del Director: vuelve a hacer el plan con ella. */
export async function responderPreguntasProyecto(id: string, respuesta: string): Promise<void> {
  const texto = limpio(respuesta, "Escribe tu respuesta.");
  const proyecto = await leer(id);
  if (proyecto.estado !== "esperando_respuesta") throw new Error("Este proyecto ya no está esperando respuesta.");
  const preguntas = [...(proyecto.preguntas ?? [])];
  const ultima = preguntas.at(-1);
  if (ultima && ultima.respuesta === null) preguntas[preguntas.length - 1] = { ...ultima, respuesta: texto };
  else preguntas.push({ pregunta: "(sin pregunta)", respuesta: texto });
  await cambiar(id, "esperando_respuesta", { preguntas, ...VOLVER_A_PLANIFICAR() }, "Este proyecto ya no está esperando respuesta.");
}

/** "Aprobar plan": pasa a "plan aprobado" o, si ya hay 3, a "en espera". Devuelve el estado nuevo. */
export async function aprobarPlan(id: string): Promise<EstadoProyecto> {
  const { data, error } = await supabase().rpc("aprobar_plan_proyecto", { p_id: id });
  if (error) throw new Error(`No se pudo aprobar el plan: ${error.message}. ${SIN_MIGRACION}`);
  if (!data) throw new Error("Este plan ya no está para revisar.");
  return data as EstadoProyecto;
}

/** "Pedir cambios": se guarda la versión actual y el Director rehace el plan con mis comentarios. */
export async function pedirCambiosPlan(id: string, comentario: string): Promise<void> {
  const cambios = limpio(comentario, "Escribe qué quieres cambiar.");
  const proyecto = await leer(id);
  if (proyecto.estado !== "plan_revision" || !proyecto.plan) throw new Error("Este plan ya no está para revisar.");
  const version: VersionPlan = { plan: proyecto.plan, cambios, guardado_en: new Date().toISOString() };
  await cambiar(
    id,
    "plan_revision",
    { versiones: [...(proyecto.versiones ?? []), version], cambios_pedidos: cambios, ...VOLVER_A_PLANIFICAR() },
    "Este plan ya no está para revisar.",
  );
}

/** Cancela un proyecto (no se borra). Si tenía hueco, el siguiente en espera avanza. */
export async function cancelarProyecto(id: string): Promise<void> {
  const { data, error } = await supabase()
    .from("proyectos")
    .update({ estado: "cancelado" satisfies EstadoProyecto, reintentar_en: null, paso_hasta: null })
    .eq("id", id)
    .not("estado", "in", "(terminado,cancelado)")
    .select("id");
  if (error) throw new Error(`No se pudo cancelar: ${error.message}`);
  if (!data?.length) throw new Error("Este proyecto ya está terminado o cancelado.");
  await rellenarHuecos();
}

/** Los que esperan turno avanzan si hay hueco. */
export async function rellenarHuecos(): Promise<void> {
  const { error } = await supabase().rpc("rellenar_huecos_proyectos");
  if (error) console.error(`No se pudieron mover los proyectos en espera: ${error.message}`);
}

/** "Reintentar" (el plan falló) o "Reanudar" (atascado): el Director vuelve a hacer el plan. */
export async function reintentarPlan(id: string): Promise<void> {
  const proyecto = await leer(id);
  if (proyecto.estado !== "borrador" || !(proyecto.aviso || proyectoAtascado(proyecto))) {
    throw new Error("Este proyecto ya no necesita reintentarse.");
  }
  await cambiar(id, "borrador", VOLVER_A_PLANIFICAR(), "Este proyecto ya no necesita reintentarse.");
}
