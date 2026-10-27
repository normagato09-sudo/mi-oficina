import "server-only";
import { LimiteIAError } from "./ia";
import { supabase } from "./supabase";
import type { Agente, Aviso, Despacho, Edificio, EstadoPublicacion, Publicacion } from "./tipos";
import type { IdiomaProyecto } from "./idiomas";

export type AgenteConEstado = Agente & {
  despacho: Despacho;
  estados: Record<EstadoPublicacion, number>;
  /** Publicaciones publicadas después de la última vez que se abrió su ficha. */
  sinVer: number;
};

export type DatosOficina = {
  /** Proyectos activos (los clientes de la oficina), en su orden. */
  proyectos: Edificio[];
  /** El equipo: agentes activos con despacho. */
  agentes: AgenteConEstado[];
};

export const NOMBRE_DESPACHO: Record<Despacho, string> = {
  direccion: "Dirección",
  redes: "Redes sociales",
  traduccion: "Traducción",
  redaccion: "Redacción",
  programacion: "Programación",
  ciberseguridad: "Ciberseguridad",
  secretaria: "Secretaría",
  diseno: "Diseño",
  informes: "Informes",
};

/** Orden de los despachos (fila de arriba y fila de abajo): también el de la carpeta "Equipo". */
export const ORDEN_DESPACHOS = Object.keys(NOMBRE_DESPACHO) as Despacho[];

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

/** La oficina: los proyectos activos y el equipo con el recuento de estados de cada agente. */
export async function cargarOficina(): Promise<DatosOficina> {
  const db = supabase();
  const proyectos = await cargarProyectos();

  const { data: agentes, error: e1 } = await db
    .from("agentes")
    .select("*")
    .not("despacho", "is", null)
    .order("creado_en")
    .returns<(Agente & { despacho: Despacho })[]>();
  if (e1) throw new Error(`No se pudieron leer los agentes: ${e1.message}. ¿Has ejecutado la migración 0007?`);
  const equipo = (agentes ?? [])
    .filter((a) => a.activo !== false && ORDEN_DESPACHOS.includes(a.despacho))
    .sort((a, b) => ORDEN_DESPACHOS.indexOf(a.despacho) - ORDEN_DESPACHOS.indexOf(b.despacho));

  const ids = equipo.map((a) => a.id);
  const { data: estados, error: e2 } = ids.length
    ? await db
        .from("publicaciones")
        .select("agente_id, estado, actualizado_en")
        .in("agente_id", ids)
        .returns<{ agente_id: string; estado: EstadoPublicacion; actualizado_en: string }[]>()
    : { data: [], error: null };
  if (e2) throw new Error(`No se pudieron leer las publicaciones: ${e2.message}`);

  return {
    proyectos,
    agentes: equipo.map((a) => {
      const suyas = (estados ?? []).filter((p) => p.agente_id === a.id);
      return {
        ...a,
        estados: contarEstados(suyas),
        sinVer: a.visto_en
          ? suyas.filter((p) => p.estado === "publicada" && Date.parse(p.actualizado_en) > Date.parse(a.visto_en!)).length
          : 0,
      };
    }),
  };
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
