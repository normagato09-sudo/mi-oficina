import "server-only";
import { contextoAgente, sistemaDeAgente } from "./datos";
import { generarEstructurado } from "./ia";
import { supabase } from "./supabase";

/**
 * Aprendizajes de los agentes: cuando la CEO edita un resultado o pide cambios, el Director compara
 * su versión (o su comentario) con la del agente y escribe uno o dos aprendizajes cortos y concretos.
 * Cada agente los recibe al trabajar (los suyos y los del proyecto del encargo, 15 como mucho).
 */

export type Aprendizaje = {
  id: string;
  agente_id: string;
  /** null = vale para todos los proyectos. */
  edificio_id: string | null;
  texto: string;
  origen: "edicion" | "cambios";
  creado_en: string;
};

/** Los que recibe un agente al trabajar: los generales y los del proyecto del encargo. */
const MAX_EN_TRABAJO = 15;
const MAX_POR_VEZ = 2;
const MAX_CARACTERES_VERSION = 3_500;

/** Los aprendizajes de un agente para un proyecto (más los generales), los más recientes primero. */
export async function aprendizajesPara(agenteId: string, proyectoId: string): Promise<Aprendizaje[]> {
  const { data, error } = await supabase()
    .from("aprendizajes")
    .select("*")
    .eq("agente_id", agenteId)
    .or(`edificio_id.is.null,edificio_id.eq.${proyectoId}`)
    .order("creado_en", { ascending: false })
    .limit(MAX_EN_TRABAJO)
    .returns<Aprendizaje[]>();
  // Sin la migración 0012 la tabla no existe: el agente trabaja sin aprendizajes.
  if (error) return [];
  return data ?? [];
}

/** Las instrucciones de sistema con los aprendizajes al final (si los hay). */
export function conAprendizajes(sistema: string, aprendizajes: Aprendizaje[]): string {
  if (!aprendizajes.length) return sistema;
  return `${sistema}\n\nLo que has aprendido de las correcciones de la CEO (síguelo siempre):\n${aprendizajes.map((a) => `- ${a.texto}`).join("\n")}`;
}

/** Todos los aprendizajes, por agente y con el nombre de la organización (carpeta "Equipo"). */
export async function cargarAprendizajesEquipo(): Promise<Record<string, (Aprendizaje & { proyecto: string | null })[]>> {
  const { data, error } = await supabase()
    .from("aprendizajes")
    .select("*, edificios(nombre)")
    .order("creado_en", { ascending: false })
    .returns<(Aprendizaje & { edificios: { nombre: string } | null })[]>();
  if (error) return {};
  const porAgente: Record<string, (Aprendizaje & { proyecto: string | null })[]> = {};
  for (const { edificios, ...a } of data ?? []) (porAgente[a.agente_id] ??= []).push({ ...a, proyecto: edificios?.nombre ?? null });
  return porAgente;
}

export async function borrarAprendizaje(id: string): Promise<void> {
  const { error } = await supabase().from("aprendizajes").delete().eq("id", id);
  if (error) throw new Error(`No se pudo borrar el aprendizaje: ${error.message}`);
}

const INSTRUCCIONES_APRENDER = `Ahora ayudas a que un agente del equipo aprenda de las correcciones de la CEO.
Compara lo que entregó el agente con lo que ha cambiado o pedido la CEO y escribe 1 o 2 aprendizajes:
- Cortos (una frase) y concretos, en forma de regla que el agente pueda seguir la próxima vez. Ejemplo: "En CIFA, no poner 'inscríbete ahora' si el encargo no habla de inscripciones."
- Solo lo que se pueda generalizar a otros encargos; no repitas datos sueltos de este encargo (fechas, horas…).
- "alcance": "organizacion" si solo vale para esta organización (tono, estilo, expresiones de la organización…) o "todos" si vale para cualquier organización.
- No repitas aprendizajes que el agente ya tiene. Si no hay nada que aprender, devuelve la lista vacía.
Escribe en español.`;

const ESQUEMA_APRENDER = {
  type: "object",
  additionalProperties: false,
  required: ["aprendizajes"],
  properties: {
    aprendizajes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["texto", "alcance"],
        properties: { texto: { type: "string" }, alcance: { type: "string", enum: ["organizacion", "todos"] } },
      },
    },
  },
};

/**
 * El Director escribe 1 o 2 aprendizajes para el agente a partir de mi edición (versión del agente
 * frente a la mía) o de mi petición de cambios (su versión y mi comentario). Los guarda y los devuelve.
 */
export async function aprenderDe(datos: {
  tareaId: string;
  agente: { id: string; nombre: string };
  directorId: string;
  proyectoId: string;
  encargo: string;
  versionAgente: string;
  origen: "edicion" | "cambios";
  /** Mi versión editada (edición) o mi comentario (cambios). */
  cambioCeo: string;
}): Promise<Aprendizaje[]> {
  const [contexto, existentes] = await Promise.all([contextoAgente(datos.directorId, datos.proyectoId), aprendizajesPara(datos.agente.id, datos.proyectoId)]);
  const mensaje = [
    `Agente: ${datos.agente.nombre}. Organización: "${contexto.organizacion.nombre}".`,
    `Encargo:\n${datos.encargo.slice(0, 1_500)}`,
    `Lo que entregó ${datos.agente.nombre}:\n${datos.versionAgente.slice(0, MAX_CARACTERES_VERSION)}`,
    datos.origen === "edicion"
      ? `La versión que ha dejado la CEO después de editarla:\n${datos.cambioCeo.slice(0, MAX_CARACTERES_VERSION)}`
      : `La CEO ha pedido cambios con este comentario:\n${datos.cambioCeo}`,
    existentes.length ? `Aprendizajes que ${datos.agente.nombre} ya tiene (no los repitas):\n${existentes.map((a) => `- ${a.texto}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const r = await generarEstructurado<{ aprendizajes: { texto: string; alcance: "organizacion" | "todos" }[] }>({
    sistema: `${sistemaDeAgente(contexto)}\n\n${INSTRUCCIONES_APRENDER}`,
    mensaje,
    nombre: "aprendizajes",
    esquema: ESQUEMA_APRENDER,
    maxTokens: 1_200,
  });
  const nuevos = (Array.isArray(r.aprendizajes) ? r.aprendizajes : [])
    .map((a) => ({ texto: String(a?.texto ?? "").trim(), alcance: a?.alcance === "todos" ? "todos" : "organizacion" }))
    .filter((a) => a.texto && !existentes.some((e) => e.texto.toLowerCase() === a.texto.toLowerCase()))
    .slice(0, MAX_POR_VEZ);
  if (!nuevos.length) return [];

  const { data, error } = await supabase()
    .from("aprendizajes")
    .insert(
      nuevos.map((a) => ({
        agente_id: datos.agente.id,
        edificio_id: a.alcance === "todos" ? null : datos.proyectoId,
        texto: a.texto,
        origen: datos.origen,
        tarea_id: datos.tareaId,
      })),
    )
    .select("*")
    .returns<Aprendizaje[]>();
  if (error) throw new Error(`No se pudieron guardar los aprendizajes: ${error.message}`);
  return data ?? [];
}
