import type { EncargoVista } from "@/lib/encargos";
import { TEXTO_ESTADO_ENCARGO } from "@/lib/encargos-reglas";

const FECHA = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Historial de encargos del Director: fecha, texto, adjuntos y estado. */
export default function HistorialEncargos({ encargos }: { encargos: EncargoVista[] }) {
  return (
    <section aria-labelledby="encargos-titulo" className="mt-8">
      <h3 id="encargos-titulo" className="font-display text-lg font-extrabold">
        Encargos
      </h3>
      {encargos.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
          Aún no hay encargos.
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
              {e.nombresDestinos.length > 0 && (
                <p className="mt-2 text-xs text-muted">Publicar en: {e.nombresDestinos.join(" y ")}</p>
              )}
              {e.adjuntos.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2" aria-label="Adjuntos">
                  {e.adjuntos.map((a, i) =>
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
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
