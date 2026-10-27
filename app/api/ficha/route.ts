import { after, type NextRequest } from "next/server";
import { marcarVisto } from "@/lib/datos";
import { cargarFicha } from "@/lib/ficha";

// La sesión la comprueba proxy.ts (las rutas /api sin sesión reciben 401).

/** Datos de la ficha de un agente (se piden al abrirla, sin recargar la oficina). */
export async function GET(request: NextRequest) {
  const agenteId = request.nextUrl.searchParams.get("agente");
  const tipo = request.nextUrl.searchParams.get("tipo");
  if (!agenteId) return Response.json({ error: "Falta el agente." }, { status: 400 });
  if (tipo !== "director" && tipo !== "diseno" && tipo !== "agente") return Response.json({ error: "Tipo de ficha no válido." }, { status: 400 });
  try {
    const datos = await cargarFicha(agenteId, tipo);
    // Abrir la ficha cuenta como "visto" (su luz verde se apaga): no hace esperar a la respuesta.
    after(() => marcarVisto(agenteId));
    return Response.json(datos, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
