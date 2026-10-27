import { after } from "next/server";
import { cargarEstadoOficina } from "@/lib/datos";
import { avanzarCola } from "@/lib/reparto";

// La sesión la comprueba proxy.ts (las rutas /api sin sesión reciben 401).

/** La cola corre en segundo plano (after) tras cada consulta del refresco: hasta 60 s. */
export const maxDuration = 60;

/**
 * Refresco automático: solo la huella de lo que se ve (luces, cola, avisos y último cambio).
 * El navegador recarga la página únicamente si la huella ha cambiado.
 */
export async function GET() {
  // Cada vistazo también hace avanzar la cola (sin hacer esperar a la respuesta).
  after(avanzarCola);
  try {
    return Response.json(await cargarEstadoOficina(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
