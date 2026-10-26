import Link from "next/link";
import { NOMBRE_DESPACHO, type AgenteConEstado } from "@/lib/datos";
import type { Edificio } from "@/lib/tipos";
import EditorTexto from "./EditorTexto";

const IDIOMAS: Record<string, string> = { es: "Español", ca: "Catalán", en: "Inglés" };

type Props =
  /** Carpeta de un proyecto: su ficha. */
  | { tipo: "proyecto"; proyecto: Edificio }
  /** Carpeta "Equipo": el perfil de cada agente de la oficina. */
  | { tipo: "equipo"; agentes: AgenteConEstado[] };

/** Panel que se abre desde una carpeta de la estantería del Director. */
export default function PanelProyecto(props: Props) {
  return (
    <aside
      aria-labelledby="panel-titulo"
      className="sticky top-20 max-h-[calc(100vh-6rem)] w-[460px] shrink-0 overflow-y-auto rounded-2xl border border-line bg-panel"
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

      {props.tipo === "proyecto" ? (
        <div className="flex flex-col gap-8 p-5">
          <div>
            <h2 id="panel-titulo" className="flex items-center gap-2.5 font-display text-2xl font-extrabold">
              <span aria-hidden="true" className="size-4 shrink-0 rounded-[4px]" style={{ background: props.proyecto.color }} />
              {props.proyecto.nombre}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Idioma: {IDIOMAS[props.proyecto.idioma ?? "es"] ?? props.proyecto.idioma}. Los agentes leen esta ficha cuando trabajan en
              un encargo de este proyecto.
            </p>
          </div>
          <section aria-label="Ficha del proyecto">
            <EditorTexto
              key={props.proyecto.id}
              tipo="ficha"
              id={props.proyecto.id}
              etiqueta="Ficha del proyecto"
              ayuda="Qué es, idioma, tono, reglas y lo que hay que poner siempre."
              inicial={props.proyecto.ficha ?? ""}
              filas={14}
            />
          </section>
        </div>
      ) : (
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
            {props.agentes.map((agente) => (
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
      )}
    </aside>
  );
}
