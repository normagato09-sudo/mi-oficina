import type { EncargoVista } from "@/lib/encargos";
import { TEXTO_ESTADO_ENCARGO, TEXTO_ESTADO_TAREA } from "@/lib/encargos-reglas";

const FECHA = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Encargos que ya han salido de la cola: fecha, proyecto, texto, adjuntos y estado. */
export default function HistorialEncargos({ encargos }: { encargos: EncargoVista[] }) {
  return (
    <section aria-labelledby="encargos-titulo" className="mt-8">
      <h3 id="encargos-titulo" className="font-display text-lg font-extrabold">
        Historial
      </h3>
      {encargos.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
          Aún no ha salido ningún encargo de la cola.
        </p>
      ) : (
        <ol className="mt-3 flex flex-col gap-3">
          {encargos.map((e) => (
            <li key={e.id} className="rounded-xl border border-line bg-ink/40 p-4">
              <div className="flex items-center justify-between gap-2 text-sm">
                <time dateTime={e.creado_en} className="text-muted">
                  {FECHA.format(new Date(e.creado_en))}
                </time>
                <span className="rounded-full bg-panel-2 px-2.5 py-0.5 text-xs font-semibold">
                  {TEXTO_ESTADO_ENCARGO[e.estado] ?? e.estado}
                </span>
              </div>
              {e.texto && <p className="mt-2 line-clamp-4 whitespace-pre-line text-sm leading-relaxed">{e.texto}</p>}
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                <span aria-hidden="true" className="size-2 rounded-[2px]" style={{ background: e.proyecto.color }} />
                {e.proyecto.nombre}
              </p>
              {(e.preguntas ?? []).some((p) => p.respuesta !== null) && (
                <dl className="mt-3 flex flex-col gap-1 text-sm">
                  {(e.preguntas ?? []).map((p, i) => (
                    <div key={i}>
                      <dt className="text-muted">El Director preguntó: {p.pregunta}</dt>
                      <dd>Respondiste: {p.respuesta ?? "—"}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {e.tareas.length > 0 && (
                <div className="mt-3 rounded-lg border border-line bg-panel-2/60 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Repartido a</p>
                  {e.nota_director && <p className="mt-1 text-sm italic text-muted">{e.nota_director}</p>}
                  <ul className="mt-2 flex flex-col gap-2">
                    {e.tareas.map((t) => (
                      <li key={t.id} className="text-sm">
                        <span className="font-semibold">{t.agente}</span>
                        <span className="text-muted"> · {TEXTO_ESTADO_TAREA[t.estado] ?? t.estado}</span>
                        <p className="mt-0.5 whitespace-pre-line leading-relaxed">{t.instrucciones}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <ListaAdjuntos adjuntos={e.adjuntos} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Miniaturas de las imágenes y nombre de los PDF de un encargo. */
export function ListaAdjuntos({ adjuntos }: { adjuntos: EncargoVista["adjuntos"] }) {
  if (!adjuntos.length) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2" aria-label="Adjuntos">
      {adjuntos.map((a, i) =>
        a.tipo === "imagen" ? (
          <li key={i}>
            {a.url ? (
              <a href={a.url} target="_blank" rel="noreferrer" className="block rounded-md focus-visible:outline-2">
                {/* Miniatura firmada de Storage: no pasa por next/image */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.url}
                  alt={a.nombre}
                  width={a.ancho}
                  height={a.alto}
                  className="h-16 w-auto rounded-md border border-line object-cover"
                />
              </a>
            ) : (
              <span className="block rounded-md border border-line px-2 py-1 text-xs text-muted">{a.nombre}</span>
            )}
          </li>
        ) : (
          <li
            key={i}
            className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs"
            title={`${a.caracteres.toLocaleString("es-ES")} caracteres extraídos`}
          >
            <span aria-hidden="true">📄</span>
            <span className="max-w-40 truncate">{a.nombre}</span>
            <span className="text-muted">
              · {a.paginas} {a.paginas === 1 ? "pág." : "págs."}
              {a.caracteres === 0 && " · sin texto"}
            </span>
          </li>
        ),
      )}
    </ul>
  );
}
