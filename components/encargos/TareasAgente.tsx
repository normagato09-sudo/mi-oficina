import type { TareaVista } from "@/lib/encargos";
import { ListaAdjuntos } from "./HistorialEncargos";

const FECHA = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Sección "Tareas" de la ficha de un agente: lo que le ha repartido el Director y aún tiene pendiente. */
export default function TareasAgente({ tareas, error }: { tareas: TareaVista[]; error?: string | null }) {
  return (
    <section aria-labelledby="tareas-titulo" className="mt-8">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="tareas-titulo" className="font-display text-lg font-extrabold">
          Tareas
        </h3>
        {tareas.length > 0 && <span className="text-sm text-muted">{tareas.length === 1 ? "1 pendiente" : `${tareas.length} pendientes`}</span>}
      </div>
      {error ? (
        <p role="alert" className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
          {error}
        </p>
      ) : tareas.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
          No tiene tareas pendientes. Le llegarán del Director cuando reparta los encargos.
        </p>
      ) : (
        <ol className="mt-3 flex flex-col gap-3">
          {tareas.map((t) => (
            <li key={t.id} className="rounded-xl border border-accent/50 bg-ink/40 p-4">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-1.5 rounded-full bg-panel-2 px-2 py-0.5 text-xs font-semibold">
                  <span aria-hidden="true" className="size-2 rounded-[2px]" style={{ background: t.encargo.proyecto.color }} />
                  {t.encargo.proyecto.nombre}
                </span>
                <time dateTime={t.creado_en} className="text-muted">
                  {FECHA.format(new Date(t.creado_en))}
                </time>
              </div>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">Instrucciones del Director</p>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{t.instrucciones}</p>
              <ListaAdjuntos adjuntos={t.encargo.adjuntos} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
