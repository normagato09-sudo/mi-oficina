import "server-only";
import { cargarActivos, cargarCola, cargarHistorial, cargarTareasPendientes, estaAtascado, type EncargoVista, type TareaVista } from "./encargos";
import type { FotoEncargo } from "@/components/carteles/PlantillasCartel";


/** Lo que muestra la ficha de un agente (se carga aparte de la oficina, al abrirla). */
export type DatosFicha =
  | {
      tipo: "director";
      activos: (EncargoVista & { atascado: boolean })[];
      cola: EncargoVista[];
      historial: EncargoVista[];
    }
  | {
      tipo: "agente";
      tareas: TareaVista[];
      /** Solo el Diseñador: fotos de los encargos para sus plantillas. */
      fotos: FotoEncargo[];
    };

function fotosDe(encargos: EncargoVista[]): FotoEncargo[] {
  return encargos.flatMap((e) =>
    e.adjuntos.flatMap((a) => (a.tipo === "imagen" && a.url ? [{ url: a.url, nombre: a.nombre, proyecto: e.proyecto.nombre }] : [])),
  );
}

/** Qué ficha es: la del Director, la del Diseñador (con plantillas) o la de otro agente. */
export type TipoFicha = "director" | "diseno" | "agente";

/** Datos de la ficha de un agente. Todas las consultas van a la vez (una sola ronda, más las miniaturas). */
export async function cargarFicha(agenteId: string, tipo: TipoFicha): Promise<DatosFicha> {
  if (tipo === "director") {
    const [activos, cola, historial] = await Promise.all([cargarActivos(), cargarCola(), cargarHistorial()]);
    return { tipo: "director", activos: activos.map((e) => ({ ...e, atascado: estaAtascado(e) })), cola, historial };
  }

  const esDisenador = tipo === "diseno";
  const [tareas, cola, historial] = await Promise.all([
    cargarTareasPendientes(agenteId),
    esDisenador ? cargarCola() : Promise.resolve([]),
    esDisenador ? cargarHistorial() : Promise.resolve([]),
  ]);
  return { tipo: "agente", tareas, fotos: esDisenador ? fotosDe([...tareas.map((t) => t.encargo), ...cola, ...historial]) : [] };
}
