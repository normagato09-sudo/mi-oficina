"use client";

import { useId, useState, useTransition } from "react";
import { reanudarEncargoAccion, responderEncargo } from "@/app/actions/encargos";
import type { EncargoVista } from "@/lib/encargos";
import { MAX_CARACTERES_ENCARGO } from "@/lib/encargos-reglas";

type Props = {
  /** Encargos en curso, en error o esperando mi respuesta (con `atascado` si lleva demasiado sin avanzar). */
  activos: (EncargoVista & { atascado: boolean })[];
};

function Proyecto({ e }: { e: EncargoVista }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-panel-2 px-2 py-0.5 text-xs font-semibold">
      <span aria-hidden="true" className="size-2 rounded-[2px]" style={{ background: e.proyecto.color }} />
      {e.proyecto.nombre}
    </span>
  );
}

/** Lo que el Director tiene entre manos: el encargo en curso (o en error) y sus preguntas para mí. */
export default function RepartoDirector({ activos }: Props) {
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const idBase = useId();

  if (!activos.length) return null;

  function lanzar(accion: () => Promise<{ error?: string }>, alTerminar?: () => void) {
    setError(null);
    empezar(async () => {
      const r = await accion();
      if (r.error) setError(r.error);
      else alTerminar?.();
    });
  }

  return (
    <section aria-labelledby={`${idBase}-titulo`} className="mt-8">
      <h3 id={`${idBase}-titulo`} className="font-display text-lg font-extrabold">
        Ahora mismo
      </h3>
      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm">
          {error}
        </p>
      )}
      <ul className="mt-3 flex flex-col gap-3">
        {activos.map((e) => {
          const pregunta = e.estado === "esperando_respuesta" ? e.preguntas?.at(-1)?.pregunta : undefined;
          const enRojo = e.estado === "error" || e.atascado || pregunta !== undefined;
          return (
            <li key={e.id} className={`rounded-xl border p-3 ${enRojo ? "border-red-500/60 bg-red-500/10" : "border-accent/50 bg-accent/5"}`}>
              <div className="flex flex-wrap items-center gap-1.5">
                <Proyecto e={e} />
                {e.urgente && <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-300">Urgente</span>}
              </div>
              <p className="mt-1.5 line-clamp-3 whitespace-pre-line text-sm leading-relaxed">{e.texto || <span className="text-muted">(sin texto)</span>}</p>

              {e.estado === "en_curso" && !e.atascado && (
                <p role="status" className="mt-2 flex items-center gap-2 text-sm font-semibold text-accent">
                  <span aria-hidden="true" className="size-2.5 animate-pulse rounded-full bg-accent" />
                  {e.reintentar_en && Date.parse(e.reintentar_en) > Date.parse(e.actualizado_en) + 1000
                    ? "Esperando a que Groq deje volver a llamar…"
                    : "El Director está leyendo el encargo y repartiéndolo…"}
                </p>
              )}

              {(e.estado === "error" || e.atascado) && (
                <div className="mt-2 flex flex-col gap-2">
                  <p className="text-sm">
                    {e.estado === "error"
                      ? e.aviso || "Algo ha fallado al repartir este encargo."
                      : "Este encargo lleva más de 10 minutos sin avanzar (puede que se cortara la ejecución)."}
                  </p>
                  <button
                    type="button"
                    className="btn-primary self-start"
                    disabled={pendiente}
                    onClick={() => lanzar(() => reanudarEncargoAccion(e.id))}
                  >
                    {e.estado === "error" ? "Reintentar" : "Reanudar"}
                  </button>
                </div>
              )}

              {pregunta !== undefined && (
                <form
                  className="mt-2 flex flex-col gap-2"
                  onSubmit={(ev) => {
                    ev.preventDefault();
                    lanzar(
                      () => responderEncargo(e.id, respuestas[e.id] ?? ""),
                      () => setRespuestas((r) => ({ ...r, [e.id]: "" })),
                    );
                  }}
                >
                  <p className="text-sm">
                    <span className="font-semibold">El Director pregunta:</span> {pregunta}
                  </p>
                  <label htmlFor={`${idBase}-${e.id}`} className="sr-only">
                    Tu respuesta
                  </label>
                  <textarea
                    id={`${idBase}-${e.id}`}
                    rows={3}
                    maxLength={MAX_CARACTERES_ENCARGO}
                    value={respuestas[e.id] ?? ""}
                    onChange={(ev) => setRespuestas((r) => ({ ...r, [e.id]: ev.target.value }))}
                    placeholder="Tu respuesta…"
                    className="w-full resize-y rounded-lg border border-line bg-ink px-3 py-2 text-sm text-text outline-none focus:border-accent"
                  />
                  <button type="submit" className="btn-primary self-start" disabled={pendiente || !(respuestas[e.id] ?? "").trim()}>
                    {pendiente ? "Enviando…" : "Responder"}
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
