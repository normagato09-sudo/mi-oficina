"use client";

import { useState, useTransition } from "react";
import { cambiarCola } from "@/app/actions/encargos";
import type { EncargoVista } from "@/lib/encargos";
import { TEXTO_ESTADO_ENCARGO } from "@/lib/encargos-reglas";

type Cambio = Parameters<typeof cambiarCola>[1];

/**
 * La cola del Director, en el orden en que la atenderá (urgentes primero).
 * Se puede subir y bajar cada encargo dentro de su grupo, marcarlo urgente o cancelarlo.
 */
export default function ColaDirector({ cola }: { cola: EncargoVista[] }) {
  const [pendiente, empezar] = useTransition();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function cambiar(id: string, cambio: Cambio) {
    setError(null);
    setOcupado(id);
    empezar(async () => {
      const r = await cambiarCola(id, cambio);
      if (r.error) setError(r.error);
      setOcupado(null);
    });
  }

  return (
    <section aria-labelledby="cola-titulo" className="mt-8">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="cola-titulo" className="font-display text-lg font-extrabold">
          Cola
        </h3>
        <span className="text-sm text-muted">{cola.length === 1 ? "1 encargo" : `${cola.length} encargos`}</span>
      </div>
      <p className="mt-1 text-sm text-muted">Se atienden de uno en uno, por orden y los urgentes primero.</p>

      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm">
          {error}
        </p>
      )}

      {cola.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
          No hay encargos en cola.
        </p>
      ) : (
        <ol className="mt-3 flex flex-col gap-3">
          {cola.map((e, i) => {
            const anterior = cola[i - 1];
            const siguiente = cola[i + 1];
            // Solo se mueve dentro de su grupo: un normal no puede adelantar a un urgente.
            const puedeSubir = anterior?.urgente === e.urgente;
            const puedeBajar = siguiente?.urgente === e.urgente;
            const bloqueado = pendiente && ocupado === e.id;
            return (
              <li
                key={e.id}
                className={`rounded-xl border bg-ink/40 p-3 ${e.urgente ? "border-red-500/50" : "border-line"} ${bloqueado ? "opacity-60" : ""}`}
                aria-busy={bloqueado || undefined}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-panel-2 font-display text-base font-extrabold"
                    aria-label={`Posición ${i + 1}`}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="flex items-center gap-1.5 rounded-full bg-panel-2 px-2 py-0.5 font-semibold">
                        <span aria-hidden="true" className="size-2 rounded-[2px]" style={{ background: e.proyecto.color }} />
                        {e.proyecto.nombre}
                      </span>
                      {e.urgente && <span className="rounded-full bg-red-500/20 px-2 py-0.5 font-semibold text-red-300">Urgente</span>}
                      <span className="rounded-full bg-panel-2 px-2 py-0.5 text-muted">{TEXTO_ESTADO_ENCARGO[e.estado] ?? e.estado}</span>
                    </div>
                    <p className="mt-1.5 line-clamp-3 whitespace-pre-line text-sm leading-relaxed">
                      {e.texto || <span className="text-muted">(sin texto)</span>}
                    </p>
                    {e.adjuntos.length > 0 && (
                      <p className="mt-1 text-xs text-muted">
                        {e.adjuntos.length === 1 ? "1 adjunto" : `${e.adjuntos.length} adjuntos`}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      type="button"
                      className="flex size-9 items-center justify-center rounded-md border border-line text-muted hover:text-text disabled:opacity-30"
                      disabled={!puedeSubir || pendiente}
                      onClick={() => cambiar(e.id, { tipo: "mover", arriba: true })}
                      aria-label="Subir en la cola"
                      title="Subir"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      className="flex size-9 items-center justify-center rounded-md border border-line text-muted hover:text-text disabled:opacity-30"
                      disabled={!puedeBajar || pendiente}
                      onClick={() => cambiar(e.id, { tipo: "mover", arriba: false })}
                      aria-label="Bajar en la cola"
                      title="Bajar"
                    >
                      ▼
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex gap-2 pl-12">
                  <button
                    type="button"
                    className="min-h-9 rounded-md border border-line px-3 text-xs font-semibold hover:border-muted disabled:opacity-50"
                    disabled={pendiente}
                    aria-pressed={e.urgente}
                    onClick={() => cambiar(e.id, { tipo: "urgente", valor: !e.urgente })}
                  >
                    {e.urgente ? "Quitar urgente" : "Marcar urgente"}
                  </button>
                  <button
                    type="button"
                    className="min-h-9 rounded-md border border-line px-3 text-xs font-semibold text-red-300 hover:border-red-400 disabled:opacity-50"
                    disabled={pendiente}
                    onClick={() => {
                      if (window.confirm("¿Cancelar este encargo? Saldrá de la cola (no se borra).")) cambiar(e.id, { tipo: "cancelar" });
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
