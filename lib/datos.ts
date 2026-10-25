import "server-only";
import { supabase } from "./supabase";
import type { Agente, Departamento, Edificio, EstadoPublicacion, Publicacion } from "./tipos";

export type AgenteConEstado = Agente & {
  departamento: Departamento;
  estados: Record<EstadoPublicacion, number>;
  /** Publicaciones publicadas después de la última vez que se abrió su ficha. */
  sinVer: number;
};

export type DatosOficina = {
  edificio: Edificio;
  departamentos: (Departamento & { agentes: AgenteConEstado[] })[];
  agentes: AgenteConEstado[];
};

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

/** Carga el (de momento único) edificio con sus departamentos, agentes y recuento de estados. */
export async function cargarOficina(): Promise<DatosOficina> {
  const db = supabase();

  const { data: edificio, error: e1 } = await db
    .from("edificios")
    .select("*")
    .order("creado_en")
    .limit(1)
    .maybeSingle<Edificio>();
  if (e1) throw new Error(`No se pudo leer el edificio: ${e1.message}`);
  if (!edificio) throw new Error("No hay ningún edificio. ¿Has ejecutado el SQL de la migración?");

  const { data: deps, error: e2 } = await db
    .from("departamentos")
    .select("*")
    .eq("edificio_id", edificio.id)
    .order("orden")
    .returns<Departamento[]>();
  if (e2) throw new Error(`No se pudieron leer los departamentos: ${e2.message}`);

  const depIds = (deps ?? []).map((d) => d.id);
  const { data: agentes, error: e3 } = depIds.length
    ? await db.from("agentes").select("*").in("departamento_id", depIds).order("creado_en").returns<Agente[]>()
    : { data: [] as Agente[], error: null };
  if (e3) throw new Error(`No se pudieron leer los agentes: ${e3.message}`);

  const agenteIds = (agentes ?? []).map((a) => a.id);
  const { data: estados, error: e4 } = agenteIds.length
    ? await db
        .from("publicaciones")
        .select("agente_id, estado, actualizado_en")
        .in("agente_id", agenteIds)
        .returns<{ agente_id: string; estado: EstadoPublicacion; actualizado_en: string }[]>()
    : { data: [], error: null };
  if (e4) throw new Error(`No se pudieron leer las publicaciones: ${e4.message}`);

  const conEstado: AgenteConEstado[] = (agentes ?? []).map((a) => {
    const suyas = (estados ?? []).filter((p) => p.agente_id === a.id);
    return {
      ...a,
      departamento: deps!.find((d) => d.id === a.departamento_id)!,
      estados: contarEstados(suyas),
      // Sin la migración 0003 no hay visto_en: no se marca nada como pendiente de ver.
      sinVer: a.visto_en
        ? suyas.filter((p) => p.estado === "publicada" && Date.parse(p.actualizado_en) > Date.parse(a.visto_en!)).length
        : 0,
    };
  });

  return {
    edificio,
    departamentos: (deps ?? []).map((d) => ({
      ...d,
      agentes: conEstado.filter((a) => a.departamento_id === d.id),
    })),
    agentes: conEstado,
  };
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
