"use client";

import { useId, useState, useTransition } from "react";
import {
  aprobarPlanAccion,
  cancelarProyectoAccion,
  pedirCambiosAccion,
  reintentarProyectoAccion,
  responderProyecto,
} from "@/app/actions/proyectos";
import type { ProyectoVista } from "@/lib/proyectos";
import { ESTADOS_CERRADOS, MAX_CARACTERES_PROYECTO, MAX_PROYECTOS_A_LA_VEZ, type Plan } from "@/lib/proyectos-reglas";
import { BarraProgreso, EtiquetaEstado, fechaCorta } from "./comun";
import ProyectoEnMarcha from "./ProyectoEnMarcha";

const CAMPO = "w-full resize-y rounded-lg border border-line bg-ink px-3 py-2 text-sm leading-relaxed text-text outline-none focus:border-accent";

/** Todo el proyecto: datos, estado, preguntas del Director, el plan por fases y lo que puedo hacer con él. */
export default function DetalleProyecto({ proyecto: p }: { proyecto: ProyectoVista }) {
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [respuesta, setRespuesta] = useState("");
  const [cambios, setCambios] = useState("");
  const [pidiendoCambios, setPidiendoCambios] = useState(false);
  const id = useId();

  function lanzar(accion: () => Promise<{ error?: string }>, alTerminar?: () => void) {
    setError(null);
    empezar(async () => {
      const r = await accion();
      if (r.error) setError(r.error);
      else alTerminar?.();
    });
  }

  const pregunta = p.estado === "esperando_respuesta" ? p.preguntas.at(-1) : undefined;
  const haciendoPlan = p.estado === "borrador" && !p.aviso && !p.atascado;
  const esperandoGroq = haciendoPlan && p.reintentar_en && Date.parse(p.reintentar_en) > Date.parse(p.actualizado_en) + 1000;
  // El equipo ya ha trabajado en él: se ven sus fases y entregas (también si lo cancelé a medias).
  const trabajando = ["en_marcha", "final_revision", "terminado"].includes(p.estado) || (p.estado === "cancelado" && p.entregas.length > 0);
  const fases = p.plan?.fases.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-panel-2 px-2 py-0.5 text-xs font-semibold">
            <span aria-hidden="true" className="size-2 rounded-[2px]" style={{ background: p.organizacion.color }} />
            {p.organizacion.nombre}
          </span>
          <EtiquetaEstado estado={p.estado} turno={p.turno} aviso={Boolean(p.aviso)} faseEstado={p.fase_estado} />
        </div>
        <h2 id="panel-titulo" className="font-display text-2xl font-extrabold">
          {p.nombre}
        </h2>
        <BarraProgreso valor={p.progreso} />
        {p.estado === "en_marcha" && fases > 0 && (
          <p className="text-sm text-muted">
            Fase {(p.fase_actual ?? 0) + 1} de {fases}
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm">
          {error}
        </p>
      )}

      {/* Lo que me toca hacer ahora (o lo que está haciendo el Director). */}
      {haciendoPlan && (
        <p role="status" className="flex items-center gap-2 rounded-xl border border-accent/50 bg-accent/5 p-3 text-sm font-semibold text-accent">
          <span aria-hidden="true" className="size-2.5 animate-pulse rounded-full bg-accent" />
          {esperandoGroq
            ? "Esperando a que Groq deje volver a llamar…"
            : p.cambios_pedidos
              ? "El Director está rehaciendo el plan con tus cambios…"
              : "El Director está haciendo el plan…"}
        </p>
      )}

      {p.estado === "borrador" && (p.aviso || p.atascado) && (
        <div className="flex flex-col gap-2 rounded-xl border border-red-500/60 bg-red-500/10 p-3">
          <p className="text-sm">{p.aviso || "El plan lleva más de 10 minutos sin avanzar (puede que se cortara la ejecución)."}</p>
          <button type="button" className="btn-primary self-start" disabled={pendiente} onClick={() => lanzar(() => reintentarProyectoAccion(p.id))}>
            {p.aviso ? "Reintentar" : "Reanudar"}
          </button>
        </div>
      )}

      {pregunta && (
        <form
          className="flex flex-col gap-2 rounded-xl border border-red-500/60 bg-red-500/10 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            lanzar(() => responderProyecto(p.id, respuesta), () => setRespuesta(""));
          }}
        >
          <p className="text-sm font-semibold">Antes de hacer el plan, el Director necesita saber:</p>
          <p className="whitespace-pre-line text-sm leading-relaxed">{pregunta.pregunta}</p>
          <label htmlFor={`${id}-respuesta`} className="sr-only">
            Tu respuesta
          </label>
          <textarea
            id={`${id}-respuesta`}
            rows={4}
            maxLength={MAX_CARACTERES_PROYECTO}
            value={respuesta}
            onChange={(e) => setRespuesta(e.target.value)}
            placeholder="Tu respuesta…"
            className={CAMPO}
          />
          <button type="submit" className="btn-primary self-start" disabled={pendiente || !respuesta.trim()}>
            {pendiente ? "Enviando…" : "Responder"}
          </button>
        </form>
      )}

      {p.estado === "en_espera" && (
        <p className="rounded-xl border border-line bg-panel-2 p-3 text-sm">
          Plan aprobado. Ya hay {MAX_PROYECTOS_A_LA_VEZ} proyectos a la vez: este espera su turno
          {p.turno ? ` (es el ${p.turno}.º)` : ""} y avanzará solo cuando se libere un hueco.
        </p>
      )}

      {/* En marcha (o terminado): el trabajo fase a fase; el plan queda plegado debajo. */}
      {trabajando && <ProyectoEnMarcha proyecto={p} />}
      {p.plan && trabajando && (
        <details className="rounded-xl border border-line p-3">
          <summary className="cursor-pointer text-sm font-semibold">Ver el plan del Director</summary>
          <div className="mt-3">
            <VistaPlan plan={p.plan} />
          </div>
        </details>
      )}

      {p.plan && !trabajando && (
        <section aria-labelledby={`${id}-plan`} className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-2">
            <h3 id={`${id}-plan`} className="font-display text-lg font-extrabold">
              El plan del Director
            </h3>
            {p.versiones.length > 0 && <span className="text-xs text-muted">Versión {p.versiones.length + 1}</span>}
          </div>
          <VistaPlan plan={p.plan} />

          {p.estado === "plan_revision" && (
            <div className="flex flex-col gap-3 rounded-xl border border-red-500/60 bg-red-500/10 p-3">
              <p className="text-sm font-semibold">¿Te parece bien el plan?</p>
              {!pidiendoCambios ? (
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-primary" disabled={pendiente} onClick={() => lanzar(() => aprobarPlanAccion(p.id))}>
                    Aprobar plan
                  </button>
                  <button type="button" className="btn-secondary" disabled={pendiente} onClick={() => setPidiendoCambios(true)}>
                    Pedir cambios
                  </button>
                </div>
              ) : (
                <form
                  className="flex flex-col gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    lanzar(
                      () => pedirCambiosAccion(p.id, cambios),
                      () => {
                        setCambios("");
                        setPidiendoCambios(false);
                      },
                    );
                  }}
                >
                  <label htmlFor={`${id}-cambios`} className="text-sm">
                    ¿Qué quieres cambiar? El Director rehará el plan y guardará esta versión.
                  </label>
                  <textarea
                    id={`${id}-cambios`}
                    rows={4}
                    maxLength={MAX_CARACTERES_PROYECTO}
                    value={cambios}
                    onChange={(e) => setCambios(e.target.value)}
                    className={CAMPO}
                    autoFocus
                  />
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" className="btn-primary" disabled={pendiente || !cambios.trim()}>
                      {pendiente ? "Enviando…" : "Enviar cambios"}
                    </button>
                    <button type="button" className="btn-secondary" disabled={pendiente} onClick={() => setPidiendoCambios(false)}>
                      Volver
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </section>
      )}

      <section aria-labelledby={`${id}-datos`} className="flex flex-col gap-3">
        <h3 id={`${id}-datos`} className="font-display text-lg font-extrabold">
          Lo que pediste
        </h3>
        <Dato titulo="Objetivo">{p.objetivo}</Dato>
        {p.fecha_limite && <Dato titulo="Fecha límite">{fechaCorta(p.fecha_limite)}</Dato>}
        {p.notas && <Dato titulo="Notas">{p.notas}</Dato>}
        {p.adjuntos.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Adjuntos</p>
            <ul className="mt-1 flex flex-wrap gap-2">
              {p.adjuntos.map((a, i) =>
                a.tipo === "imagen" ? (
                  <li key={i}>
                    {a.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.url} alt={a.nombre} className="h-16 w-16 rounded-lg object-cover" />
                    ) : (
                      <span className="text-sm">🖼️ {a.nombre}</span>
                    )}
                  </li>
                ) : (
                  <li key={i} className="rounded-lg bg-panel-2 px-2 py-1 text-sm">
                    📄 {a.nombre} <span className="text-muted">({a.paginas} págs.)</span>
                  </li>
                ),
              )}
            </ul>
          </div>
        )}
        {p.preguntas.some((q) => q.respuesta !== null) && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Preguntas del Director</p>
            <ul className="mt-1 flex flex-col gap-2 text-sm">
              {p.preguntas
                .filter((q) => q.respuesta !== null)
                .map((q, i) => (
                  <li key={i} className="leading-relaxed">
                    <p className="whitespace-pre-line text-muted">{q.pregunta}</p>
                    <p className="whitespace-pre-line">{q.respuesta}</p>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </section>

      {p.versiones.length > 0 && (
        <section aria-labelledby={`${id}-versiones`} className="flex flex-col gap-2">
          <h3 id={`${id}-versiones`} className="font-display text-lg font-extrabold">
            Versiones anteriores
          </h3>
          {[...p.versiones].reverse().map((v, i) => (
            <details key={v.guardado_en} className="rounded-xl border border-line p-3">
              <summary className="cursor-pointer text-sm">
                <span className="font-semibold">Versión {p.versiones.length - i}</span>
                <span className="text-muted"> · pediste: </span>
                {v.cambios.length > 80 ? `${v.cambios.slice(0, 80)}…` : v.cambios}
              </summary>
              <div className="mt-3 flex flex-col gap-3">
                <Dato titulo="Cambios que pediste">{v.cambios}</Dato>
                <VistaPlan plan={v.plan} />
              </div>
            </details>
          ))}
        </section>
      )}

      {!ESTADOS_CERRADOS.includes(p.estado) && (
        <div className="border-t border-line pt-5">
          <p className="mb-3 text-sm text-muted">Cancelar lo saca de la lista de proyectos en curso. No se borra nada.</p>
          <button
            type="button"
            className="btn-secondary"
            disabled={pendiente}
            onClick={() => {
              if (window.confirm(`¿Cancelar el proyecto "${p.nombre}"?`)) lanzar(() => cancelarProyectoAccion(p.id));
            }}
          >
            Cancelar proyecto
          </button>
        </div>
      )}
    </div>
  );
}

function Dato({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{titulo}</p>
      <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed">{children}</p>
    </div>
  );
}

/** El plan: resumen, qué quedará hecho y las fases con sus tareas (agente y dependencias). */
function VistaPlan({ plan }: { plan: Plan }) {
  const titulos = new Map(plan.fases.flatMap((f) => f.tareas.map((t) => [t.id, t.titulo] as const)));
  const paraCeo = plan.fases.flatMap((f) => f.tareas).filter((t) => !t.agente_id);
  return (
    <div className="flex flex-col gap-4">
      <Dato titulo="Resumen">{plan.resumen}</Dato>
      <Dato titulo="Qué quedará hecho al 100 %">{plan.resultado_final}</Dato>
      {paraCeo.length > 0 && (
        <p className="rounded-lg border border-amber-400/50 bg-amber-400/10 px-3 py-2 text-sm">
          {paraCeo.length === 1 ? "Hay 1 tarea para ti" : `Hay ${paraCeo.length} tareas para ti`}: el equipo prepara todo, pero no publica, no envía ni
          despliega nada.
        </p>
      )}
      <ol className="flex flex-col gap-3">
        {plan.fases.map((fase, i) => (
          <li key={i} className="rounded-xl border border-line p-3">
            <p className="font-display font-extrabold">
              Fase {i + 1} · {fase.nombre}
            </p>
            <p className="mt-0.5 text-sm text-muted">{fase.objetivo}</p>
            <ul className="mt-3 flex flex-col gap-2">
              {fase.tareas.map((t) => (
                <li key={t.id} className={`rounded-lg p-2.5 text-sm ${t.agente_id ? "bg-panel-2" : "border border-amber-400/50 bg-amber-400/10"}`}>
                  <p>
                    <span className="mr-1.5 rounded bg-ink px-1.5 py-0.5 text-xs font-bold text-muted">{t.id}</span>
                    <span className="font-semibold">{t.titulo}</span>
                  </p>
                  <p className="mt-1 text-xs font-semibold">{t.agente_id ? t.agente : "Tarea para la CEO"}</p>
                  <p className="mt-1 whitespace-pre-line leading-relaxed">{t.descripcion}</p>
                  {t.entrega && (
                    <p className="mt-1 text-muted">
                      <span className="font-semibold">Entrega:</span> {t.entrega}
                    </p>
                  )}
                  {!t.agente_id && t.motivo_ceo && (
                    <p className="mt-1">
                      <span className="font-semibold">Por qué te toca a ti:</span> {t.motivo_ceo}
                    </p>
                  )}
                  {t.depende_de.length > 0 && (
                    <p className="mt-1 text-muted">
                      <span className="font-semibold">Depende de:</span> {t.depende_de.map((d) => `${d} · ${titulos.get(d) ?? ""}`).join(", ")}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
