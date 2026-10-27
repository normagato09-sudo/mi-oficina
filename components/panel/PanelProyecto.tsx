import Link from "next/link";
import { NOMBRE_DESPACHO, type AgenteConEstado } from "@/lib/datos";
import EditorTexto from "./EditorTexto";

/** Panel de la carpeta "Equipo" de la estantería del Director: el perfil de cada agente. */
export default function PanelProyecto({ agentes }: { agentes: AgenteConEstado[] }) {
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
            El perfil de cada agente. Son los mismos para todos los proyectos: en cada encargo leen además la ficha de su proyecto.
          </p>
        </div>
        <section aria-label="Perfiles de los agentes" className="flex flex-col gap-6">
          {agentes.map((agente) => (
            <EditorTexto
              key={agente.id}
              tipo="perfil"
              id={agente.id}
              etiqueta={`${agente.nombre} · ${NOMBRE_DESPACHO[agente.despacho]}`}
              inicial={agente.instrucciones}
              filas={7}
            />
          ))}
        </section>
      </div>
    </aside>
  );
}
