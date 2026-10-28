"use client";

import { useId, useState, useTransition } from "react";
import {
  aprobarFaseAccion,
  aprobarFinalAccion,
  editarEntregaAccion,
  marcarTareaCeoAccion,
  pedirCambiosFaseAccion,
  reintentarProyectoAccion,
} from "@/app/actions/proyectos";
import ResultadoTrabajo from "@/components/trabajos/ResultadoTrabajo";
import { Editor, textoParaCopiar } from "@/components/trabajos/TrabajoListo";
import type { ProyectoVista } from "@/lib/proyectos";
import { MAX_CARACTERES_PROYECTO, TAREA_TERMINADA, type EntregaProyecto, type TareaPlan } from "@/lib/proyectos-reglas";

const CAMPO = "w-full resize-y rounded-lg border border-line bg-ink px-3 py-2 text-sm leading-relaxed text-text outline-none focus:border-accent";
const BOTON = "min-h-9 rounded-md border border-line px-3 text-xs font-semibold hover:border-muted disabled:opacity-50";

type Lanzar = (accion: () => Promise<{ error?: string }>, alTerminar?: () => void) => void;

const terminada = (e: EntregaProyecto | undefined) => Boolean(e && (TAREA_TERMINADA as readonly string[]).includes(e.estado));

/**
 * Un proyecto en marcha (o con el final para revisar, o terminado): la fase actual con sus tareas,
 * mis tareas con "Hecho", la revisión de la fase, las fases ya aprobadas y el final con "Descargar todo".
 */
export default function ProyectoEnMarcha({ proyecto: p }: { proyecto: ProyectoVista }) {
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const lanzar: Lanzar = (accion, alTerminar) => {
    setError(null);
    empezar(async () => {
      const r = await accion();
      if (r.error) setError(r.error);
      else alTerminar?.();
    });
  };

  const fases = p.plan?.fases ?? [];
  const n = p.fase_actual ?? 0;
  const enMarcha = p.estado === "en_marcha";
  const final = p.estado === "final_revision" || p.estado === "terminado";
  const conAviso = p.entregas.filter((e) => e.aviso);
  const haciendo =
    enMarcha && !p.aviso
      ? p.fase_estado === "resumiendo"
        ? "El Director está escribiendo el resumen de la fase…"
        : p.fase_estado === "cambios"
          ? "El Director está decidiendo qué hay que rehacer…"
          : p.fase_estado === "final"
            ? "El Director está escribiendo el resumen final…"
            : null
      : null;

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm">
          {error}
        </p>
      )}

      {enMarcha && (p.aviso || conAviso.length > 0) && (
        <div className="flex flex-col gap-2 rounded-xl border border-red-500/60 bg-red-500/10 p-3">
          {p.aviso && <p className="text-sm">El Director: {p.aviso}</p>}
          {conAviso.map((e) => (
            <p key={e.id} className="text-sm">
              {e.clave} · {e.agente}: {e.aviso}
            </p>
          ))}
          <button type="button" className="btn-primary self-start" disabled={pendiente} onClick={() => lanzar(() => reintentarProyectoAccion(p.id))}>
            Reintentar
          </button>
        </div>
      )}

      {haciendo && (
        <p role="status" className="flex items-center gap-2 rounded-xl border border-accent/50 bg-accent/5 p-3 text-sm font-semibold text-accent">
          <span aria-hidden="true" className="size-2.5 animate-pulse rounded-full bg-accent" />
          {haciendo}
        </p>
      )}

      {final && <Final proyecto={p} pendiente={pendiente} lanzar={lanzar} />}

      {enMarcha && fases[n] && <FaseActual proyecto={p} pendiente={pendiente} lanzar={lanzar} />}

      {/* Las fases ya aprobadas (en el final se ven todas arriba). */}
      {!final &&
        fases.slice(0, n).map((f, i) => (
          <details key={i} className="rounded-xl border border-line p-3">
            <summary className="cursor-pointer text-sm">
              <span className="font-semibold">
                Fase {i + 1} · {f.nombre}
              </span>
              <span className="text-muted"> · aprobada</span>
            </summary>
            <div className="mt-3">
              <EntregasDeFase proyecto={p} fase={i} editables={false} pendiente={pendiente} lanzar={lanzar} />
            </div>
          </details>
        ))}
    </div>
  );
}

/* ───────────── La fase actual ───────────── */

function FaseActual({ proyecto: p, pendiente, lanzar }: { proyecto: ProyectoVista; pendiente: boolean; lanzar: Lanzar }) {
  const n = p.fase_actual ?? 0;
  const fase = p.plan!.fases[n]!;
  const paraRevisar = p.fase_estado === "para_revisar";
  const [pidiendo, setPidiendo] = useState(false);
  const [comentario, setComentario] = useState("");
  const id = useId();

  return (
    <section aria-labelledby={`${id}-fase`} className={`flex flex-col gap-3 rounded-xl border p-3 ${paraRevisar ? "border-red-500/60" : "border-line"}`}>
      <div>
        <h3 id={`${id}-fase`} className="font-display text-lg font-extrabold">
          Fase {n + 1} de {p.plan!.fases.length} · {fase.nombre}
        </h3>
        <p className="text-sm text-muted">{fase.objetivo}</p>
      </div>

      <ul className="flex flex-col gap-2">
        {fase.tareas.map((t) => (t.agente_id ? <FilaTarea key={t.id} tarea={t} proyecto={p} /> : <TareaMia key={t.id} tarea={t} proyecto={p} pendiente={pendiente} lanzar={lanzar} />))}
      </ul>

      {paraRevisar && (
        <div className="flex flex-col gap-3 border-t border-line pt-3">
          {p.fases?.[n]?.resumen && (
            <div className="rounded-lg bg-panel-2 p-3 text-sm leading-relaxed">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Resumen del Director</p>
              <p className="mt-1 whitespace-pre-line">{p.fases[n]!.resumen}</p>
            </div>
          )}
          <EntregasDeFase proyecto={p} fase={n} editables completa={false} pendiente={pendiente} lanzar={lanzar} />
          <div className="flex flex-col gap-3 rounded-xl border border-red-500/60 bg-red-500/10 p-3">
            <p className="text-sm font-semibold">¿Das la fase por buena?</p>
            {!pidiendo ? (
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary" disabled={pendiente} onClick={() => lanzar(() => aprobarFaseAccion(p.id))}>
                  Aprobar fase
                </button>
                <button type="button" className="btn-secondary" disabled={pendiente} onClick={() => setPidiendo(true)}>
                  Pedir cambios
                </button>
              </div>
            ) : (
              <form
                className="flex flex-col gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  lanzar(
                    () => pedirCambiosFaseAccion(p.id, comentario),
                    () => {
                      setComentario("");
                      setPidiendo(false);
                    },
                  );
                }}
              >
                <label htmlFor={`${id}-cambios`} className="text-sm">
                  ¿Qué quieres cambiar? El Director decidirá qué tareas hay que rehacer y solo esas se repetirán.
                </label>
                <textarea id={`${id}-cambios`} rows={4} maxLength={MAX_CARACTERES_PROYECTO} value={comentario} onChange={(e) => setComentario(e.target.value)} className={CAMPO} autoFocus />
                <div className="flex flex-wrap gap-2">
                  <button type="submit" className="btn-primary" disabled={pendiente || !comentario.trim()}>
                    {pendiente ? "Enviando…" : "Enviar cambios"}
                  </button>
                  <button type="button" className="btn-secondary" disabled={pendiente} onClick={() => setPidiendo(false)}>
                    Volver
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/** Cómo va una tarea de agente de la fase actual. */
function FilaTarea({ tarea: t, proyecto: p }: { tarea: TareaPlan; proyecto: ProyectoVista }) {
  const e = p.entregas.find((x) => x.clave === t.id);
  const hecha = (clave: string) => terminada(p.entregas.find((x) => x.clave === clave)) || Boolean(p.tareas_ceo?.[clave]);
  const faltan = t.depende_de.filter((d) => !hecha(d));
  let estado: string;
  let tono = "text-muted";
  if (e?.aviso) [estado, tono] = ["Ha fallado", "text-red-300"];
  else if (!e || e.estado === "pendiente") estado = faltan.length ? `Esperando a ${faltan.join(", ")}` : e?.vueltas ? "Corrigiendo…" : "En cola";
  else if (e.estado === "en_curso") [estado, tono] = ["Trabajando…", "text-accent"];
  else if (e.estado === "revision") estado = "Esperando revisión";
  else if (e.estado === "revisando") [estado, tono] = ["El Director lo revisa…", "text-accent"];
  else if (e.estado === "aprobada") [estado, tono] = ["Aprobada", "text-emerald-300"];
  else [estado, tono] = ["Terminada", "text-emerald-300"];
  return (
    <li className="rounded-lg bg-panel-2 px-3 py-2 text-sm">
      <p className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span>
          <span className="mr-1.5 text-xs font-bold text-muted">{t.id}</span>
          <span className="font-semibold">{t.titulo}</span>
        </span>
        <span className={`text-xs font-semibold ${tono}`}>{estado}</span>
      </p>
      <p className="text-xs text-muted">{e?.agente ?? t.agente}</p>
    </li>
  );
}

/** Una tarea para mí: qué hay que hacer, por qué me toca y el botón "Hecho" con una nota opcional. */
function TareaMia({ tarea: t, proyecto: p, pendiente, lanzar }: { tarea: TareaPlan; proyecto: ProyectoVista; pendiente: boolean; lanzar: Lanzar }) {
  const hecha = p.tareas_ceo?.[t.id];
  const [nota, setNota] = useState("");
  const id = useId();
  return (
    <li className={`rounded-lg p-3 text-sm ${hecha ? "bg-panel-2" : "border border-amber-400/60 bg-amber-400/10"}`}>
      <p className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span>
          <span className="mr-1.5 text-xs font-bold text-muted">{t.id}</span>
          <span className="font-semibold">{t.titulo}</span>
        </span>
        <span className={`text-xs font-semibold ${hecha ? "text-emerald-300" : "text-amber-200"}`}>{hecha ? "Hecha" : "Tarea para ti"}</span>
      </p>
      {t.descripcion && <p className="mt-1 whitespace-pre-line leading-relaxed">{t.descripcion}</p>}
      {t.motivo_ceo && <p className="mt-1 text-muted">{t.motivo_ceo}</p>}
      {hecha ? (
        hecha.nota && <p className="mt-1 whitespace-pre-line text-muted">Tu nota: {hecha.nota}</p>
      ) : (
        p.estado === "en_marcha" && (
          <form
            className="mt-2 flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              lanzar(() => marcarTareaCeoAccion(p.id, t.id, nota), () => setNota(""));
            }}
          >
            <label htmlFor={id} className="sr-only">
              Nota (opcional)
            </label>
            <textarea id={id} rows={2} maxLength={2000} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (opcional): cómo ha ido, enlaces…" className={CAMPO} />
            <button type="submit" className="btn-primary self-start" disabled={pendiente}>
              Hecho
            </button>
          </form>
        )
      )}
    </li>
  );
}

/* ───────────── Entregas ───────────── */

function EntregasDeFase({
  proyecto: p,
  fase,
  editables,
  completa = true,
  pendiente,
  lanzar,
}: {
  proyecto: ProyectoVista;
  fase: number;
  editables: boolean;
  /** Con el resumen del Director y mis tareas (en la fase actual ya se ven arriba). */
  completa?: boolean;
  pendiente: boolean;
  lanzar: Lanzar;
}) {
  const info = p.fases?.[fase];
  const entregas = p.entregas.filter((e) => e.fase === fase && e.resultado_json);
  const mias = (p.plan?.fases[fase]?.tareas ?? []).filter((t) => !t.agente_id);
  return (
    <div className="flex flex-col gap-3">
      {completa && info?.resumen && <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{info.resumen}</p>}
      {entregas.map((e) => (
        <Entrega key={e.id} entrega={e} proyecto={p} editable={editables} pendiente={pendiente} lanzar={lanzar} />
      ))}
      {completa &&
        mias.map((t) => (
          <p key={t.id} className="text-sm">
            <span className="font-semibold">
              {t.id} · {t.titulo}
            </span>{" "}
            <span className="text-muted">(tuya): {p.tareas_ceo?.[t.id] ? `hecha${p.tareas_ceo[t.id]!.nota ? ` · ${p.tareas_ceo[t.id]!.nota}` : ""}` : "pendiente"}</span>
          </p>
        ))}
      {info?.cambios?.length ? <p className="text-xs text-muted">Cambios que pediste en esta fase: {info.cambios.join(" · ")}</p> : null}
    </div>
  );
}

/** Una entrega con su resultado (copiar, descargar el cartel…) y, si se puede, "Editar". */
function Entrega({ entrega: e, proyecto: p, editable, pendiente, lanzar }: { entrega: EntregaProyecto; proyecto: ProyectoVista; editable: boolean; pendiente: boolean; lanzar: Lanzar }) {
  const [editando, setEditando] = useState(false);
  const trabajo = { resultado_json: e.resultado_json, resultado: e.resultado, texto_editado: e.texto_editado, encargo: p.medios };
  return (
    <article className="flex flex-col gap-2 rounded-xl border border-line bg-ink/40 p-3">
      <header>
        <p className="text-sm">
          <span className="mr-1.5 text-xs font-bold text-muted">{e.clave}</span>
          <span className="font-semibold">{e.titulo}</span>
        </p>
        <p className="text-xs text-muted">{e.agente}</p>
      </header>
      {e.nota_agente && <p className="text-xs text-muted">Nota de {e.agente}: {e.nota_agente}</p>}
      {e.nota_director && <p className="text-xs text-amber-200">El Director: {e.nota_director}</p>}
      {editando ? (
        <Editor
          tarea={trabajo}
          pendiente={pendiente}
          alCancelar={() => setEditando(false)}
          alGuardar={(edicion) => lanzar(() => editarEntregaAccion(e.id, edicion), () => setEditando(false))}
        />
      ) : (
        <ResultadoTrabajo resultado={e.resultado_json!} encargo={p.medios} textoEditado={e.texto_editado} />
      )}
      {editable && !editando && (
        <div className="flex gap-2 border-t border-line pt-2">
          <button type="button" className={BOTON} disabled={pendiente} onClick={() => setEditando(true)}>
            Editar
          </button>
        </div>
      )}
    </article>
  );
}

/* ───────────── El final ───────────── */

/** Todo el proyecto en un archivo de texto: resumen final y, fase a fase, cada entrega y mis tareas. */
function textoCompleto(p: ProyectoVista): string {
  const linea = "=".repeat(60);
  const r = p.resumen_final;
  const partes = [`${p.nombre.toUpperCase()}\n${p.organizacion.nombre}\n${linea}`];
  if (r) {
    partes.push(`RESUMEN FINAL\n${r.hecho}`);
    if (r.entregas.length) partes.push(`ENTREGAS\n${r.entregas.map((x) => `- ${x}`).join("\n")}`);
    if (r.pendiente_ceo.length) partes.push(`LO QUE QUEDA POR TU PARTE\n${r.pendiente_ceo.map((x) => `- ${x}`).join("\n")}`);
  }
  (p.plan?.fases ?? []).forEach((f, i) => {
    partes.push(`${linea}\nFASE ${i + 1} · ${f.nombre.toUpperCase()}\n${p.fases?.[i]?.resumen ?? ""}`);
    for (const t of f.tareas) {
      if (!t.agente_id) {
        const hecha = p.tareas_ceo?.[t.id];
        partes.push(`--- ${t.id} · ${t.titulo} (tuya): ${hecha ? `hecha${hecha.nota ? `. Nota: ${hecha.nota}` : ""}` : "pendiente"}`);
        continue;
      }
      const e = p.entregas.find((x) => x.clave === t.id);
      partes.push(`--- ${t.id} · ${t.titulo} (${e?.agente ?? t.agente})\n\n${e ? textoParaCopiar(e) : "(sin entrega)"}`);
    }
  });
  return `${partes.join("\n\n")}\n`;
}

function descargarTodo(p: ProyectoVista) {
  const blob = new Blob([textoCompleto(p)], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `${p.nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "proyecto"}.txt`;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Final({ proyecto: p, pendiente, lanzar }: { proyecto: ProyectoVista; pendiente: boolean; lanzar: Lanzar }) {
  const r = p.resumen_final;
  const revisar = p.estado === "final_revision";
  const id = useId();
  return (
    <section aria-labelledby={`${id}-final`} className="flex flex-col gap-4">
      <h3 id={`${id}-final`} className="font-display text-lg font-extrabold">
        {revisar ? "Final para revisar" : "Proyecto terminado"}
      </h3>
      {r && (
        <div className="flex flex-col gap-3 rounded-xl bg-panel-2 p-3 text-sm leading-relaxed">
          <p className="whitespace-pre-line">{r.hecho}</p>
          {r.entregas.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Entregas</p>
              <ul className="mt-1 list-disc pl-5">
                {r.entregas.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          )}
          {r.pendiente_ceo.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Lo que queda por tu parte</p>
              <ul className="mt-1 list-disc pl-5">
                {r.pendiente_ceo.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {revisar && (
          <button type="button" className="btn-primary" disabled={pendiente} onClick={() => lanzar(() => aprobarFinalAccion(p.id))}>
            Aprobar final
          </button>
        )}
        <button type="button" className="btn-secondary" onClick={() => descargarTodo(p)}>
          Descargar todo
        </button>
      </div>
      <p className="-mt-2 text-xs text-muted">«Descargar todo» baja un archivo de texto con todas las entregas. Los carteles se descargan en PNG desde cada uno.</p>

      {(p.plan?.fases ?? []).map((f, i) => (
        <details key={i} open={revisar} className="rounded-xl border border-line p-3">
          <summary className="cursor-pointer text-sm font-semibold">
            Fase {i + 1} · {f.nombre}
          </summary>
          <div className="mt-3">
            <EntregasDeFase proyecto={p} fase={i} editables={revisar} pendiente={pendiente} lanzar={lanzar} />
          </div>
        </details>
      ))}
    </section>
  );
}
