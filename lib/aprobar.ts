import "server-only";
import { aprenderDe } from "./aprendizajes";
import type { Encargo, EstadoTarea, Tarea } from "./encargos";
import type { EstadoEncargo } from "./encargos-reglas";
import { cargarDirectorOficina, type Proyecto } from "./proyectos";
import { supabase } from "./supabase";
import { esDespachoTrabajo, leerResultado, textoDeResultado, type Resultado } from "./trabajos";
import type { Agente } from "./tipos";

/**
 * Lo que hace la CEO con los trabajos listos: editarlos, pedir cambios o aprobarlos.
 * Cuando todas las tareas de un encargo están aprobadas, el encargo termina y el Director deja un aviso.
 */

const MAX_CARACTERES_EDICION = 20_000;
const MAX_CARACTERES_COMENTARIO = 2_000;

type TareaCompleta = Tarea & {
  agentes: Pick<Agente, "id" | "nombre" | "despacho"> | null;
  encargos: (Pick<Encargo, "id" | "texto" | "estado" | "edificio_id" | "director_id"> & { edificios: { nombre: string } | null }) | null;
  /** Si es una tarea de proyecto (migración 0016): su proyecto. */
  proyecto?: Pick<Proyecto, "id" | "nombre" | "objetivo" | "estado" | "fase_estado" | "fase_actual" | "edificio_id" | "director_id"> | null;
};

async function cargarTarea(id: string): Promise<TareaCompleta> {
  const { data, error } = await supabase()
    .from("tareas")
    .select("*, agentes(id, nombre, despacho), encargos(id, texto, estado, edificio_id, director_id, edificios(nombre))")
    .eq("id", id)
    .maybeSingle<TareaCompleta>();
  if (error) throw new Error(`No se pudo leer la tarea: ${error.message}`);
  if (data?.proyecto_id && data.agentes) {
    const { data: proyecto, error: e2 } = await supabase()
      .from("proyectos")
      .select("id, nombre, objetivo, estado, fase_estado, fase_actual, edificio_id, director_id")
      .eq("id", data.proyecto_id)
      .maybeSingle<NonNullable<TareaCompleta["proyecto"]>>();
    if (e2) throw new Error(`No se pudo leer el proyecto: ${e2.message}`);
    if (proyecto) return { ...data, proyecto };
  }
  if (!data || !data.encargos || !data.agentes) throw new Error("Esta tarea ya no existe.");
  return data;
}

function soloSiLista(tarea: Tarea) {
  if (tarea.estado !== "lista") throw new Error("Este trabajo ya no está esperando tu revisión.");
}

/** Se puede editar: un trabajo listo de un encargo o, en un proyecto, una entrega de la fase que reviso o del final. */
function soloSiEditable(tarea: TareaCompleta) {
  const p = tarea.proyecto;
  if (!p) return soloSiLista(tarea);
  const enRevision =
    (p.estado === "en_marcha" && p.fase_estado === "para_revisar" && tarea.fase === p.fase_actual) || p.estado === "final_revision";
  if (!enRevision || !["revisada", "lista", "aprobada"].includes(tarea.estado)) throw new Error("Esta entrega ya no se puede editar.");
}

/* ───────────── Editar ───────────── */

/** Lo que cambio al editar: los campos del resultado (Instagram, cartel, traducción, redacción) o el texto entero. */
export type Edicion = { tipo: "datos"; resultado: Resultado } | { tipo: "texto"; texto: string };

/** Guarda mi versión. La del agente se conserva (la primera vez) para aprender de la diferencia. */
export async function editarTarea(id: string, edicion: Edicion): Promise<void> {
  const tarea = await cargarTarea(id);
  soloSiEditable(tarea);
  const despacho = tarea.agentes!.despacho;
  if (!esDespachoTrabajo(despacho)) throw new Error("Este trabajo no se puede editar.");

  let cambios: Record<string, unknown>;
  if (edicion.tipo === "datos") {
    if (edicion.resultado?.tipo !== despacho) throw new Error("El resultado no corresponde a este agente.");
    // Se vuelve a normalizar: mismas reglas que lo que devuelve la IA.
    const { resultado } = leerResultado(despacho, { datos: edicion.resultado.datos });
    cambios = { resultado_json: resultado, resultado: textoDeResultado(resultado), texto_editado: null };
  } else {
    const texto = String(edicion.texto ?? "").replace(/\r\n/g, "\n").trim();
    if (!texto) throw new Error("El texto no puede quedar vacío.");
    if (texto.length > MAX_CARACTERES_EDICION) throw new Error(`Máximo ${MAX_CARACTERES_EDICION.toLocaleString("es-ES")} caracteres.`);
    cambios = { texto_editado: texto, resultado: texto };
  }
  if (!tarea.resultado_agente_texto) {
    cambios.resultado_agente = tarea.resultado_json ?? null;
    cambios.resultado_agente_texto = tarea.resultado;
  }
  const { error } = await supabase().from("tareas").update(cambios).eq("id", id).eq("estado", tarea.estado);
  if (error) throw new Error(`No se pudo guardar: ${error.message}`);
}

/* ───────────── Pedir cambios ───────────── */

/**
 * La tarea vuelve a la cola: el agente la rehace con mi comentario y el Director la revisa otra vez.
 * Devuelve la versión que tenía (para aprender de ella aunque el agente la rehaga enseguida).
 */
export async function pedirCambios(id: string, comentario: string): Promise<string> {
  const texto = String(comentario ?? "").replace(/\r\n/g, "\n").trim();
  if (!texto) throw new Error("Escribe qué hay que cambiar.");
  if (texto.length > MAX_CARACTERES_COMENTARIO) throw new Error(`Máximo ${MAX_CARACTERES_COMENTARIO.toLocaleString("es-ES")} caracteres.`);
  const tarea = await cargarTarea(id);
  soloSiLista(tarea);
  const db = supabase();

  const { data, error } = await db
    .from("tareas")
    .update({
      estado: "pendiente" satisfies EstadoTarea,
      comentario_ceo: texto,
      // Una vuelta nueva: el Director puede volver a devolverla hasta 2 veces.
      comentarios: null,
      vueltas: 0,
      nota_director: null,
      aviso: null,
      reintentos: 0,
      reintentar_en: null,
      paso_hasta: null,
      // Se parte de la versión actual (con mis ediciones, si las hay).
      resultado_agente: null,
      resultado_agente_texto: null,
    })
    .eq("id", id)
    .eq("estado", "lista" satisfies EstadoTarea)
    .select("id");
  if (error) throw new Error(`No se pudo pedir cambios: ${error.message}`);
  if (!data?.length) throw new Error("Este trabajo ya no está esperando tu revisión.");

  // El encargo vuelve a estar "en marcha" para que la cola retome la tarea.
  const { error: e2 } = await db
    .from("encargos")
    .update({ estado: "repartido" satisfies EstadoEncargo })
    .eq("id", tarea.encargo_id)
    .in("estado", ["listo_revision", "terminado"] satisfies EstadoEncargo[]);
  if (e2) throw new Error(`No se pudo volver a poner en marcha el encargo: ${e2.message}`);
  return tarea.resultado;
}

/* ───────────── Aprender ───────────── */

/**
 * Después de editar o de pedir cambios: el Director escribe 1 o 2 aprendizajes para el agente.
 * Se llama en segundo plano (after); si falla, solo se anota en el registro.
 */
export async function aprenderDeTarea(id: string, origen: "edicion" | "cambios", versionAntes?: string): Promise<void> {
  try {
    const tarea = await cargarTarea(id);
    const versionAgente = origen === "edicion" ? (tarea.resultado_agente_texto ?? "") : (versionAntes ?? tarea.resultado);
    const cambioCeo = origen === "edicion" ? tarea.resultado : (tarea.comentario_ceo ?? "");
    if (!versionAgente.trim() || !cambioCeo.trim() || versionAgente.trim() === cambioCeo.trim()) return;
    const p = tarea.proyecto;
    const directorId = p ? (p.director_id ?? (await cargarDirectorOficina())?.id) : tarea.encargos!.director_id;
    if (!directorId) return;
    await aprenderDe({
      tareaId: id,
      agente: { id: tarea.agentes!.id, nombre: tarea.agentes!.nombre },
      directorId,
      proyectoId: p ? p.edificio_id : tarea.encargos!.edificio_id,
      encargo: p ? `Proyecto "${p.nombre}": ${p.objetivo}

Tarea: ${tarea.instrucciones}` : tarea.encargos!.texto,
      versionAgente,
      origen,
      cambioCeo,
    });
  } catch (e) {
    console.error(`Aprendizaje de la tarea ${id}:`, e);
  }
}

/* ───────────── Aprobar ───────────── */

/** Apruebo el trabajo. Si era el último del encargo, el encargo termina y el Director deja un aviso con el resumen. */
export async function aprobarTarea(id: string): Promise<void> {
  const tarea = await cargarTarea(id);
  soloSiLista(tarea);
  const db = supabase();
  const { data, error } = await db
    .from("tareas")
    .update({ estado: "aprobada" satisfies EstadoTarea, aprobada_en: new Date().toISOString() })
    .eq("id", id)
    .eq("estado", "lista" satisfies EstadoTarea)
    .select("id");
  if (error) throw new Error(`No se pudo aprobar: ${error.message}`);
  if (!data?.length) throw new Error("Este trabajo ya no está esperando tu revisión.");

  const { data: hermanas, error: e2 } = await db
    .from("tareas")
    .select("estado, agentes(nombre)")
    .eq("encargo_id", tarea.encargo_id)
    .returns<{ estado: EstadoTarea; agentes: { nombre: string } | null }[]>();
  if (e2) throw new Error(`No se pudieron leer las tareas: ${e2.message}`);
  if (!hermanas?.length || hermanas.some((t) => t.estado !== "aprobada")) return;

  const { data: cerrado, error: e3 } = await db
    .from("encargos")
    .update({ estado: "terminado" satisfies EstadoEncargo })
    .eq("id", tarea.encargo_id)
    .eq("estado", "listo_revision" satisfies EstadoEncargo)
    .select("id");
  if (e3) throw new Error(`No se pudo terminar el encargo: ${e3.message}`);
  if (!cerrado?.length) return;

  const encargo = tarea.encargos!;
  const texto = encargo.texto.replace(/\s+/g, " ").trim();
  const quienes = [...new Set(hermanas.map((t) => t.agentes?.nombre ?? "Agente"))];
  const lista = quienes.length > 1 ? `${quienes.slice(0, -1).join(", ")} y ${quienes.at(-1)}` : quienes[0];
  await db.from("avisos").insert({
    encargo_id: encargo.id,
    mensaje: `El Director: terminado (${encargo.edificios?.nombre ?? "organización"}) · ${texto.length > 60 ? `${texto.slice(0, 60)}…` : texto || "encargo con adjuntos"} — aprobaste el trabajo de ${lista}.`,
  });
}
