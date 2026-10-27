import "server-only";
import { NOMBRE_DESPACHO, ORDEN_DESPACHOS } from "./despachos";
import { estadoAgente, type ResumenReparto, type ResumenTareas } from "./estado";
import { LimiteIAError, MENSAJE_LIMITE } from "./ia";
import { supabase } from "./supabase";
import type { Agente, Aviso, Despacho, Edificio, EstadoPublicacion, Publicacion } from "./tipos";
import type { IdiomaProyecto } from "./idiomas";

export type AgenteConEstado = Agente & {
  despacho: Despacho;
  estados: Record<EstadoPublicacion, number>;
  /** Publicaciones publicadas después de la última vez que se abrió su ficha. */
  sinVer: number;
  /** Sus tareas, por paso (pendientes, trabajando, en revisión, listas). */
  tareas: ResumenTareas;
  /** Solo el Director: cómo va el reparto de los encargos. */
  reparto?: ResumenReparto;
};

export type DatosOficina = {
  /** Proyectos activos (los clientes de la oficina), en su orden. */
  proyectos: Edificio[];
  /** El equipo: agentes activos con despacho. */
  agentes: AgenteConEstado[];
  /** Avisos sin leer (campana). */
  avisos: Aviso[];
  /** Encargos esperando en la cola del Director. */
  enCola: number;
  /** Proyecto del encargo en curso: su cartel cuelga en Dirección. */
  proyectoEnCurso: string | null;
  /** El Director trabaja (o hay cola que puede empezar): la página sigue mirando si algo cambia. */
  hayEnCurso: boolean;
  /** Huella de lo que se ve (ver cargarEstadoOficina). */
  firma: string;
};

export { NOMBRE_DESPACHO, ORDEN_DESPACHOS };

function contarEstados(filas: { estado: EstadoPublicacion }[]): Record<EstadoPublicacion, number> {
  const estados: Record<EstadoPublicacion, number> = {
    preparando: 0,
    lista: 0,
    publicando: 0,
    publicada: 0,
    error: 0,
  };
  for (const f of filas) estados[f.estado] = (estados[f.estado] ?? 0) + 1;
  return estados;
}

/** Todos los proyectos (también los archivados), en su orden. */
export async function cargarTodosLosProyectos(): Promise<Edificio[]> {
  const { data, error } = await supabase().from("edificios").select("*").order("creado_en").returns<Edificio[]>();
  if (error) throw new Error(`No se pudieron leer los proyectos: ${error.message}`);
  return (data ?? []).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
}

/** Proyectos activos, en su orden. */
export async function cargarProyectos(): Promise<Edificio[]> {
  return (await cargarTodosLosProyectos()).filter((p) => p.activo !== false);
}

export type DatosProyecto = {
  nombre: string;
  color: string;
  idioma: IdiomaProyecto;
  ficha: string;
  /** Usuario de Instagram sin "@", o null. */
  instagram: string | null;
};

/** Crea un proyecto (activo, al final) o guarda los cambios de uno existente. Devuelve su id. */
export async function guardarProyecto(id: string | null, datos: DatosProyecto): Promise<string> {
  const db = supabase();
  if (!id) {
    const proyectos = await cargarTodosLosProyectos();
    const orden = Math.max(0, ...proyectos.map((p) => p.orden ?? 0)) + 1;
    const { data, error } = await db
      .from("edificios")
      .insert({ ...datos, activo: true, orden })
      .select("id")
      .single<{ id: string }>();
    if (error) throw new Error(`No se pudo crear el proyecto: ${error.message}`);
    return data.id;
  }

  const { data: antes, error: e1 } = await db.from("edificios").select("nombre").eq("id", id).single<{ nombre: string }>();
  if (e1) throw new Error(`No se encontró el proyecto: ${e1.message}`);
  // Si cambia el nombre, el cartel pasa a mostrar el nombre nuevo.
  const letrero = antes.nombre !== datos.nombre ? { letrero: null, letrero_secundario: null } : {};
  const { error } = await db.from("edificios").update({ ...datos, ...letrero }).eq("id", id);
  if (error) throw new Error(`No se pudo guardar el proyecto: ${error.message}`);
  return id;
}

/** Archiva (activo = false) o vuelve a activar un proyecto. Nunca se borra. */
export async function activarProyecto(id: string, activo: boolean): Promise<void> {
  const { error } = await supabase().from("edificios").update({ activo }).eq("id", id);
  if (error) throw new Error(`No se pudo ${activo ? "activar" : "archivar"} el proyecto: ${error.message}`);
}

type FilaAgente = Agente & { despacho: Despacho };

/** El equipo: agentes activos con despacho, en el orden de los despachos. */
async function consultarEquipo(columnas: string): Promise<FilaAgente[]> {
  const { data, error } = await supabase()
    .from("agentes")
    .select(columnas)
    .not("despacho", "is", null)
    .order("creado_en")
    .returns<FilaAgente[]>();
  if (error) throw new Error(`No se pudieron leer los agentes: ${error.message}. ¿Has ejecutado la migración 0007?`);
  return (data ?? [])
    .filter((a) => a.activo !== false && ORDEN_DESPACHOS.includes(a.despacho))
    .sort((a, b) => ORDEN_DESPACHOS.indexOf(a.despacho) - ORDEN_DESPACHOS.indexOf(b.despacho));
}

/** Lo que cambia mientras se trabaja: publicaciones, tareas, encargos activos, cola y avisos. Todo a la vez. */
async function consultarActividad() {
  const db = supabase();
  // Sin la migración 0010 no hay tareas ni estos estados: todo a cero (no se lanza error).
  const [publicaciones, tareasRes, activos, cola, avisos, ultimoEncargo, ultimaTarea] = await Promise.all([
    db
      .from("publicaciones")
      .select("agente_id, estado, actualizado_en")
      .returns<{ agente_id: string; estado: EstadoPublicacion; actualizado_en: string }[]>(),
    db
      .from("tareas")
      .select("agente_id, estado")
      .in("estado", ["pendiente", "en_curso", "revision", "revisando", "revisada", "lista"])
      .returns<{ agente_id: string; estado: string }[]>(),
    db
      .from("encargos")
      .select("estado, aviso, edificio_id, actualizado_en")
      .in("estado", ["en_curso", "error", "esperando_respuesta"])
      .order("actualizado_en")
      .returns<{ estado: "en_curso" | "error" | "esperando_respuesta"; aviso: string | null; edificio_id: string; actualizado_en: string }[]>(),
    // Recuentos con GET (limit 1): las peticiones HEAD dieron algún pico de varios segundos.
    db.from("encargos").select("id", { count: "exact" }).eq("estado", "en_cola").limit(1),
    db.from("avisos").select("id", { count: "exact" }).eq("leido", false).limit(1),
    // Para saber si algo ha cambiado (refresco ligero): lo último que se ha tocado.
    db.from("encargos").select("actualizado_en").order("actualizado_en", { ascending: false }).limit(1).returns<{ actualizado_en: string }[]>(),
    db.from("tareas").select("actualizado_en").order("actualizado_en", { ascending: false }).limit(1).returns<{ actualizado_en: string }[]>(),
  ]);
  if (publicaciones.error) throw new Error(`No se pudieron leer las publicaciones: ${publicaciones.error.message}`);

  const filas = activos.data ?? [];
  const enError = filas.find((e) => e.estado === "error");
  const tareas = tareasRes.data ?? [];
  const reparto: ResumenReparto = {
    enCurso: filas.some((e) => e.estado === "en_curso"),
    revisando: tareas.some((t) => t.estado === "revisando"),
    esperando: filas.filter((e) => e.estado === "esperando_respuesta").length,
    error: enError ? (enError.aviso?.startsWith(MENSAJE_LIMITE) ? "Límite de la IA: reintenta" : "Error al repartir") : null,
  };
  const enCola = cola.count ?? 0;
  return {
    publicaciones: publicaciones.data ?? [],
    tareas,
    reparto,
    enCola,
    avisosSinLeer: avisos.count ?? 0,
    /** Proyecto del encargo en curso (su cartel cuelga en Dirección), o null. */
    proyectoEnCurso: filas.find((e) => e.estado === "en_curso")?.edificio_id ?? null,
    /** Hay que seguir mirando: el Director o el equipo trabajan, o hay cola que puede empezar. */
    activo:
      reparto.enCurso ||
      (!reparto.error && (enCola > 0 || tareas.some((t) => ["pendiente", "en_curso", "revision", "revisando"].includes(t.estado)))),
    ultimoCambio: [ultimoEncargo.data?.[0]?.actualizado_en, ultimaTarea.data?.[0]?.actualizado_en].join("|"),
  };
}

type Actividad = Awaited<ReturnType<typeof consultarActividad>>;

function resumenTareas(tareas: { estado: string }[]): ResumenTareas {
  const cuantas = (...estados: string[]) => tareas.filter((t) => estados.includes(t.estado)).length;
  return {
    pendientes: cuantas("pendiente"),
    trabajando: cuantas("en_curso"),
    enRevision: cuantas("revision", "revisando", "revisada"),
    listas: cuantas("lista"),
  };
}

/** Cada agente con el recuento de sus publicaciones, sus tareas y (el Director) el reparto. */
function conEstados(equipo: FilaAgente[], actividad: Actividad): AgenteConEstado[] {
  return equipo.map((a) => {
    const suyas = actividad.publicaciones.filter((p) => p.agente_id === a.id);
    return {
      ...a,
      estados: contarEstados(suyas),
      sinVer: a.visto_en
        ? suyas.filter((p) => p.estado === "publicada" && Date.parse(p.actualizado_en) > Date.parse(a.visto_en!)).length
        : 0,
      tareas: resumenTareas(actividad.tareas.filter((t) => t.agente_id === a.id)),
      ...(a.despacho === "direccion" && a.tipo === "direccion" ? { reparto: actividad.reparto } : {}),
    };
  });
}

/**
 * Huella de todo lo que se ve: luces y textos de los agentes, cola, avisos, cartel y el último cambio
 * en encargos y tareas. Si no cambia, no hace falta volver a cargar la página.
 */
function firmaDe(agentes: AgenteConEstado[], actividad: Actividad): string {
  return JSON.stringify([
    agentes.map((a) => {
      const e = estadoAgente(a, a.despacho === "direccion" ? actividad.enCola : 0);
      return [a.id, e.luz, e.texto];
    }),
    actividad.enCola,
    actividad.avisosSinLeer,
    actividad.proyectoEnCurso,
    actividad.ultimoCambio,
  ]);
}

/** La oficina: proyectos activos, el equipo con sus estados, la cola, los avisos y la huella. Una sola ronda de consultas. */
export async function cargarOficina(): Promise<DatosOficina> {
  const [proyectos, equipo, actividad, avisos] = await Promise.all([
    cargarProyectos(),
    consultarEquipo("*"),
    consultarActividad(),
    cargarAvisos().catch((): Aviso[] => []),
  ]);
  const agentes = conEstados(equipo, actividad);
  return {
    proyectos,
    agentes,
    avisos,
    enCola: actividad.enCola,
    proyectoEnCurso: actividad.proyectoEnCurso,
    hayEnCurso: actividad.activo,
    firma: firmaDe(agentes, actividad),
  };
}

/** Resumen ligero para el refresco automático: solo la huella y si hay que seguir mirando. */
export async function cargarEstadoOficina(): Promise<{ firma: string; activo: boolean }> {
  const [equipo, actividad] = await Promise.all([
    consultarEquipo("id, nombre, despacho, tipo, activo, aviso_ia, visto_en, creado_en"),
    consultarActividad(),
  ]);
  return { firma: firmaDe(conEstados(equipo, actividad), actividad), activo: actividad.activo };
}

/** Avisos sin leer, del más reciente al más antiguo. */
export async function cargarAvisos(limite = 20): Promise<Aviso[]> {
  const { data, error } = await supabase()
    .from("avisos")
    .select("*")
    .eq("leido", false)
    .order("creado_en", { ascending: false })
    .limit(limite)
    .returns<Aviso[]>();
  if (error) throw new Error(`No se pudieron leer los avisos: ${error.message}`);
  return data ?? [];
}

export async function marcarAvisosLeidos(): Promise<void> {
  const { error } = await supabase().from("avisos").update({ leido: true }).eq("leido", false);
  if (error) throw new Error(`No se pudieron marcar los avisos: ${error.message}`);
}

/**
 * Lo que un agente necesita para trabajar en un encargo: sus instrucciones y la ficha
 * del proyecto de ESE encargo (los agentes son de la oficina, no de un proyecto).
 */
export async function contextoAgente(agenteId: string, proyectoId: string): Promise<{
  agente: Agente;
  proyecto: { nombre: string; idioma: string; ficha: string };
}> {
  const db = supabase();
  const [{ data: agente, error: e1 }, { data: edificio, error: e2 }] = await Promise.all([
    db.from("agentes").select("*").eq("id", agenteId).single<Agente>(),
    db.from("edificios").select("*").eq("id", proyectoId).single<Edificio>(),
  ]);
  if (e1) throw new Error(`No se pudo leer el agente: ${e1.message}`);
  if (e2) throw new Error(`No se pudo leer el proyecto: ${e2.message}`);
  return {
    agente,
    proyecto: { nombre: edificio.nombre, idioma: edificio.idioma ?? "es", ficha: edificio.ficha ?? "" },
  };
}

const IDIOMAS: Record<string, string> = { es: "español", ca: "catalán", en: "inglés" };

/** Instrucciones de sistema de un agente: su perfil, la ficha del proyecto del encargo y el idioma. */
export function sistemaDeAgente({ agente, proyecto }: Awaited<ReturnType<typeof contextoAgente>>): string {
  const idioma = IDIOMAS[proyecto.idioma] ?? proyecto.idioma;
  return [
    agente.instrucciones.trim(),
    agente.tipo === "traduccion"
      ? `Este encargo es del proyecto "${proyecto.nombre}", que suele escribir en ${idioma}. Traduce al idioma que te pidan.`
      : `Este encargo es del proyecto "${proyecto.nombre}". Escribe siempre en ${idioma}.`,
    proyecto.ficha.trim() && `Ficha del proyecto (síguela siempre):\n${proyecto.ficha.trim()}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Ejecuta un trabajo de IA en nombre de un agente.
 * Si la IA está en su límite de uso, el agente se pone en rojo con el aviso; si va bien, el aviso se quita.
 */
export async function trabajarComoAgente<T>(agenteId: string, trabajo: () => Promise<T>): Promise<T> {
  try {
    const resultado = await trabajo();
    await supabase().from("agentes").update({ aviso_ia: null }).eq("id", agenteId).not("aviso_ia", "is", null);
    return resultado;
  } catch (e) {
    if (e instanceof LimiteIAError) {
      const { error } = await supabase().from("agentes").update({ aviso_ia: e.message }).eq("id", agenteId);
      if (error) console.error(`No se pudo guardar el aviso de la IA: ${error.message}`);
    }
    throw e;
  }
}

/** Guarda la ficha de un proyecto. */
export async function guardarFicha(edificioId: string, ficha: string): Promise<void> {
  const { error } = await supabase().from("edificios").update({ ficha }).eq("id", edificioId);
  if (error) throw new Error(`No se pudo guardar la ficha: ${error.message}`);
}

/** Guarda el perfil (instrucciones) de un agente. */
export async function guardarPerfil(agenteId: string, instrucciones: string): Promise<void> {
  const { error } = await supabase().from("agentes").update({ instrucciones }).eq("id", agenteId);
  if (error) throw new Error(`No se pudo guardar el perfil: ${error.message}`);
}

/** Guarda que se acaba de abrir la ficha del agente (apaga su luz verde). */
export async function marcarVisto(agenteId: string): Promise<void> {
  const { error } = await supabase()
    .from("agentes")
    .update({ visto_en: new Date().toISOString() })
    .eq("id", agenteId);
  // Si aún no se ha ejecutado la migración 0003 la columna no existe: no rompemos la página.
  if (error) console.error(`No se pudo marcar como visto: ${error.message}`);
}

export async function cargarPublicaciones(agenteId: string): Promise<Publicacion[]> {
  const { data, error } = await supabase()
    .from("publicaciones")
    .select("*")
    .eq("agente_id", agenteId)
    .order("creado_en", { ascending: false })
    .limit(50)
    .returns<Publicacion[]>();
  if (error) throw new Error(`No se pudieron leer las publicaciones: ${error.message}`);
  return data ?? [];
}
