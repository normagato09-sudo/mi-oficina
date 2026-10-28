import "server-only";
import { MAX_PARA_EMPEZAR_MS } from "./pasos";
import { procesarProyecto, tomarProyectoListo } from "./plan";
import { procesarEncargo, tomarEncargoListo } from "./reparto";
import { supabase } from "./supabase";
import { procesarTarea, tomarTareaLista } from "./trabajo";

/**
 * Cola automática de la oficina, de un paso en un paso (urgentes primero):
 *   1. el Director reparte el encargo en curso (lib/reparto.ts) o hace el plan de un proyecto (lib/plan.ts),
 *   2. los agentes hacen sus tareas y el Director las revisa (lib/trabajo.ts),
 *   3. cuando el encargo está listo para revisar, se empieza el siguiente de la cola.
 *
 * Todo corre en segundo plano con after() (maxDuration = 60 s). Cada paso es una llamada corta a la IA;
 * lo que no cabe en una ejecución se queda preparado para la siguiente, que llega con el refresco
 * automático de la página (cada 4 s mientras hay algo en marcha) o al abrir la oficina.
 * Nunca lanza: los fallos se guardan en el encargo (rojo, "Reintentar").
 */
export async function avanzarCola(): Promise<void> {
  const inicio = Date.now();
  try {
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
      const tarea = await tomarTareaLista();
      if (tarea) {
        await procesarTarea(tarea, inicio);
        continue;
      }
      return;
    }
  } catch (e) {
    console.error("Cola:", e);
  }
}
