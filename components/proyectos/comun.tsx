import { TEXTO_ESTADO_PROYECTO, type EstadoProyecto } from "@/lib/proyectos-reglas";

/** Color de la etiqueta de cada estado: rojo si me necesita, ámbar si el Director trabaja, verde si va bien. */
const TONO: Record<EstadoProyecto, string> = {
  borrador: "bg-amber-400/20 text-amber-200",
  esperando_respuesta: "bg-red-500/20 text-red-300",
  plan_revision: "bg-red-500/20 text-red-300",
  aprobado: "bg-emerald-500/20 text-emerald-300",
  en_espera: "bg-panel-2 text-muted",
  en_marcha: "bg-sky-500/20 text-sky-300",
  terminado: "bg-emerald-500/20 text-emerald-300",
  cancelado: "bg-panel-2 text-muted",
};

export function EtiquetaEstado({ estado, turno, aviso }: { estado: EstadoProyecto; turno: number | null; aviso?: boolean }) {
  if (aviso && estado === "borrador") {
    return <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-300">Error en el plan</span>;
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TONO[estado]}`}>
      {TEXTO_ESTADO_PROYECTO[estado]}
      {estado === "en_espera" && turno ? ` · turno ${turno}` : ""}
    </span>
  );
}

export function BarraProgreso({ valor }: { valor: number }) {
  const v = Math.max(0, Math.min(100, Math.round(valor)));
  return (
    <div className="flex items-center gap-2">
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} aria-label="Progreso" className="h-2 flex-1 overflow-hidden rounded-full bg-panel-2">
        <div className="h-full rounded-full bg-accent" style={{ width: `${v}%` }} />
      </div>
      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted">{v} %</span>
    </div>
  );
}

/** "AAAA-MM-DD" → "15 nov 2026". */
export function fechaCorta(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a!, m! - 1, d!)).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
