import type { TareaVista } from "@/lib/encargos";
import { TEXTO_ESTADO_TAREA } from "@/lib/encargos-reglas";
import ResultadoTrabajo from "@/components/trabajos/ResultadoTrabajo";
import TrabajoListo from "@/components/trabajos/TrabajoListo";
import { ListaAdjuntos } from "./HistorialEncargos";

const FECHA = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function Cabecera({ t }: { t: TareaVista }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="flex items-center gap-1.5 rounded-full bg-panel-2 px-2 py-0.5 text-xs font-semibold">
        <span aria-hidden="true" className="size-2 rounded-[2px]" style={{ background: t.encargo.proyecto.color }} />
        {t.encargo.proyecto.nombre}
      </span>
      <time dateTime={t.creado_en} className="text-muted">
        {FECHA.format(new Date(t.creado_en))}
      </time>
    </div>
  );
}

function Instrucciones({ t }: { t: TareaVista }) {
  return (
    <>
      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">Instrucciones del Director</p>
      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{t.instrucciones}</p>
    </>
  );
}

/**
 * Ficha de un agente: "Tareas" (lo que tiene entre manos, con su paso) y "Trabajos listos"
 * (revisados por el Director: el resultado bien presentado, con la nota del agente y la del Director).
 */
export default function TareasAgente({ tareas, error }: { tareas: TareaVista[]; error?: string | null }) {
  const enMarcha = tareas.filter((t) => t.estado !== "lista" && t.estado !== "aprobada");
  const listas = tareas.filter((t) => t.estado === "lista" && t.resultado_json).reverse();
  const aprobadas = tareas.filter((t) => t.estado === "aprobada" && t.resultado_json);

  return (
    <>
      {listas.length > 0 && (
        <section aria-labelledby="listos-titulo" className="mt-8">
          <div className="flex items-baseline justify-between gap-2">
            <h3 id="listos-titulo" className="font-display text-lg font-extrabold">
              Trabajos listos
            </h3>
            <span className="text-sm text-muted">{listas.length === 1 ? "1 para revisar" : `${listas.length} para revisar`}</span>
          </div>
          <ol className="mt-3 flex flex-col gap-4">
            {listas.map((t) => (
              <li key={t.id} data-tarea={t.id} className="rounded-xl border border-red-500/50 bg-ink/40 p-4">
                <Cabecera t={t} />
                <div className="mt-3">
                  <TrabajoListo tarea={t} />
                </div>
                {t.nota_agente && (
                  <p className="mt-3 rounded-lg bg-panel-2/70 px-3 py-2 text-sm">
                    <span className="font-semibold">Nota del agente:</span> {t.nota_agente}
                  </p>
                )}
                {t.nota_director && (
                  <p className="mt-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
                    <span className="font-semibold">Nota del Director:</span> {t.nota_director}
                  </p>
                )}
                {t.comentario_ceo && (
                  <p className="mt-2 rounded-lg bg-panel-2/70 px-3 py-2 text-sm">
                    <span className="font-semibold">Le pediste:</span> {t.comentario_ceo}
                  </p>
                )}
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-muted hover:text-text">
                    Instrucciones del Director{t.vueltas ? ` · corregido ${t.vueltas} ${t.vueltas === 1 ? "vez" : "veces"}` : ""}
                  </summary>
                  <p className="mt-1 whitespace-pre-line leading-relaxed">{t.instrucciones}</p>
                </details>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section aria-labelledby="tareas-titulo" className="mt-8">
        <div className="flex items-baseline justify-between gap-2">
          <h3 id="tareas-titulo" className="font-display text-lg font-extrabold">
            Tareas
          </h3>
          {enMarcha.length > 0 && <span className="text-sm text-muted">{enMarcha.length === 1 ? "1 en marcha" : `${enMarcha.length} en marcha`}</span>}
        </div>
        {error ? (
          <p role="alert" className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
            {error}
          </p>
        ) : enMarcha.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
            No tiene tareas en marcha. Le llegarán del Director cuando reparta los encargos.
          </p>
        ) : (
          <ol className="mt-3 flex flex-col gap-3">
            {enMarcha.map((t) => (
              <li key={t.id} className="rounded-xl border border-accent/50 bg-ink/40 p-4">
                <Cabecera t={t} />
                <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-accent">
                  {(t.estado === "en_curso" || t.estado === "revisando") && (
                    <span aria-hidden="true" className="size-2.5 animate-pulse rounded-full bg-accent" />
                  )}
                  {t.estado === "revisada" ? "Revisada · esperando al resto del equipo" : TEXTO_ESTADO_TAREA[t.estado]}
                  {t.vueltas ? <span className="font-normal text-muted">· corrección {t.vueltas}</span> : null}
                </p>
                <Instrucciones t={t} />
                <ListaAdjuntos adjuntos={t.encargo.adjuntos} />
              </li>
            ))}
          </ol>
        )}
      </section>

      {aprobadas.length > 0 && (
        <details className="group mt-8">
          <summary className="flex cursor-pointer items-baseline justify-between gap-2">
            <span className="font-display text-lg font-extrabold">Trabajos aprobados</span>
            <span className="text-sm text-muted">últimos {aprobadas.length}</span>
          </summary>
          <ol className="mt-3 flex flex-col gap-3">
            {aprobadas.map((t) => (
              <li key={t.id} className="rounded-xl border border-emerald-400/40 bg-ink/40 p-4">
                <Cabecera t={t} />
                <p className="mt-1 text-xs text-emerald-300">Aprobado {t.aprobada_en ? FECHA.format(new Date(t.aprobada_en)) : ""}</p>
                <div className="mt-3">
                  <ResultadoTrabajo resultado={t.resultado_json!} encargo={t.encargo} textoEditado={t.texto_editado} />
                </div>
              </li>
            ))}
          </ol>
        </details>
      )}
    </>
  );
}
