import "server-only";
import { MAX_PARA_EMPEZAR_MS } from "./pasos";
import { randomUUID } from "node:crypto";
import { arrancarProyectos, procesarPasoProyecto, tomarPasoProyecto } from "./ejecucion";
import { procesarProyecto, tomarProyectoListo } from "./plan";
import { procesarEncargo, tomarEncargoListo } from "./reparto";
import { supabase } from "./supabase";
import { procesarTarea, tomarTareaLista } from "./trabajo";

/**
 * Cola automática de la oficina, de un paso en un paso (urgentes primero):
 *   1. el Director reparte el encargo en curso (lib/reparto.ts) o hace el plan de un proyecto (lib/plan.ts),
 *   2. los agentes hacen sus tareas (de encargos y de proyectos en marcha) y el Director las revisa (lib/trabajo.ts),
 *      y en los proyectos el Director resume cada fase, decide qué rehacer y escribe el final (lib/ejecucion.ts),
 *   3. cuando el encargo está listo para revisar, se empieza el siguiente de la cola.
 *
 * Todo corre en segundo plano con after() (maxDuration = 60 s). Cada paso es una llamada corta a la IA;
 * lo que no cabe en una ejecución se queda preparado para la siguiente, que llega con el refresco
 * automático de la página (cada 4 s mientras hay algo en marcha) o al abrir la oficina.
 * Nunca lanza: los fallos se guardan en el encargo (rojo, "Reintentar").
 */
export async function avanzarCola(): Promise<void> {
  const inicio = Date.now();
  // Un solo trabajo de IA a la vez en toda la oficina (límite de Groq): si otra ejecución tiene el turno, nada.
  const dueno = randomUUID();
  const turno = await supabase().rpc("tomar_turno_ia", { p_dueno: dueno, p_segundos: TURNO_S });
  // Sin la migración 0016 no hay turno: se sigue como antes.
  if (!turno.error && turno.data !== true) return;
  try {
    // Los proyectos con el plan aprobado (y hueco) se ponen en marcha.
    await arrancarProyectos();
    while (true) {
      // Pasa el primero de la cola a "en curso" si no hay nada en marcha; si no da tiempo a
      // procesarlo, queda listo y lo coge la siguiente ejecución.
      const { error } = await supabase().rpc("empezar_siguiente_encargo");
      if (error) {
        console.error(`Cola: ${error.message}. ¿Has ejecutado las migraciones 0010 y 0011?`);
        return;
      }
      if (Date.now() - inicio > MAX_PARA_EMPEZAR_MS) return;

      const encargo = await tomarEncargoListo();
      if (encargo) {
        await procesarEncargo(encargo, inicio);
        continue;
      }
      // Los planes de los proyectos van aparte de la cola de encargos: no esperan a que acabe el encargo en curso.
      const proyecto = await tomarProyectoListo();
      if (proyecto) {
        await procesarProyecto(proyecto, inicio);
        continue;
      }
      // El Director resume una fase, decide qué rehacer o escribe el final de un proyecto.
      const paso = await tomarPasoProyecto();
      if (paso) {
        await procesarPasoProyecto(paso, inicio);
        continue;
      }
      const tarea = await tomarTareaLista();
      if (tarea) {
        await procesarTarea(tarea, inicio);
        continue;
      }
      return;
    }
  } catch (e) {
    console.error("Cola:", e);
  } finally {
    if (!turno.error) await supabase().rpc("soltar_turno_ia", { p_dueno: dueno });
  }
}

/** Lo que dura el turno de la IA: más que una ejecución (60 s), por si se corta sin soltarlo. */
const TURNO_S = 75;
