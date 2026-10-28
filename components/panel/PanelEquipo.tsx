import Link from "next/link";
import type { AgenteConEstado } from "@/lib/datos";
import { NOMBRE_DESPACHO } from "@/lib/despachos";
import type { Aprendizaje } from "@/lib/aprendizajes";
import BorrarAprendizaje from "./BorrarAprendizaje";
import EditorTexto from "./EditorTexto";

type Props = {
  agentes: AgenteConEstado[];
  /** Aprendizajes de cada agente (por id), con el nombre del proyecto o null si valen para todos. */
  aprendizajes: Record<string, (Aprendizaje & { proyecto: string | null })[]>;
};

/** Panel de la carpeta "Equipo" de la estantería del Director: el perfil de cada agente y lo que ha aprendido. */
export default function PanelEquipo({ agentes, aprendizajes }: Props) {
  return (
    <aside
      aria-labelledby="panel-titulo"
      className="sticky top-20 max-h-[calc(100vh-7rem)] w-[460px] shrink-0 overflow-y-auto rounded-2xl border border-line bg-panel"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-panel/95 px-4 py-2 backdrop-blur">
        <span className="text-sm text-muted">Estantería del Director</span>
        <Link
          href="/"
          scroll={false}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-2xl leading-none text-muted hover:text-text"
          aria-label="Cerrar panel"
        >
          ×
        </Link>
      </div>

      <div className="flex flex-col gap-8 p-5">
        <div>
          <h2 id="panel-titulo" className="font-display text-2xl font-extrabold">
            Equipo
          </h2>
          <p className="mt-1 text-sm text-muted">
            El perfil de cada agente. Son los mismos para todas las organizaciones: en cada encargo leen además la ficha de su organización.
          </p>
        </div>
        <section aria-label="Perfiles de los agentes" className="flex flex-col gap-6">
          {agentes.map((agente) => {
            const suyos = aprendizajes[agente.id] ?? [];
            return (
              <div key={agente.id} className="flex flex-col gap-2">
                <EditorTexto
                  tipo="perfil"
                  id={agente.id}
                  etiqueta={`${agente.nombre} · ${NOMBRE_DESPACHO[agente.despacho]}`}
                  inicial={agente.instrucciones}
                  filas={7}
                />
                <div className="rounded-lg border border-line bg-ink/40 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Aprendizajes{suyos.length ? ` (${suyos.length})` : ""}
                  </p>
                  {suyos.length ? (
                    <ul className="mt-2 flex flex-col gap-1">
                      {suyos.map((a) => (
                        <li key={a.id} className="flex items-start gap-2 text-sm">
                          <span className="min-w-0 flex-1 pt-1.5 leading-snug">
                            {a.texto}{" "}
                            <span className="text-xs text-muted">· {a.proyecto ?? "todas las organizaciones"}</span>
                          </span>
                          <BorrarAprendizaje id={a.id} texto={a.texto} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-sm text-muted">Aún ninguno. Aprende cuando editas sus trabajos o le pides cambios.</p>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </aside>
  );
}
