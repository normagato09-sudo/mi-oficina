import Link from "next/link";
import type { DatosOficina } from "@/lib/datos";
import EditorTexto from "./EditorTexto";

/** Panel de la estantería del Director: ficha del proyecto y perfil de cada agente del edificio. */
export default function PanelProyecto({ datos }: { datos: DatosOficina }) {
  const { edificio } = datos;
  return (
    <aside
      aria-labelledby="panel-titulo"
      className="fixed inset-0 z-40 overflow-y-auto bg-ink lg:sticky lg:inset-auto lg:top-20 lg:z-auto lg:max-h-[calc(100vh-6rem)] lg:w-[460px] lg:shrink-0 lg:rounded-2xl lg:border lg:border-line lg:bg-panel"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-ink/95 px-4 py-2 backdrop-blur lg:bg-panel/95">
        <span className="text-sm text-muted">Estantería del Director</span>
        <Link
          href={`/?vista=edificio&proyecto=${edificio.id}`}
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
            {edificio.nombre}
          </h2>
          <p className="mt-1 text-sm text-muted">
            Lo que saben los agentes de este edificio. Cada agente solo lee la ficha de su proyecto.
          </p>
        </div>

        <section aria-label="Ficha del proyecto">
          <EditorTexto
            tipo="ficha"
            id={edificio.id}
            etiqueta="Ficha del proyecto"
            ayuda="Qué es, idioma, tono, reglas y lo que hay que poner siempre."
            inicial={edificio.ficha ?? ""}
            filas={12}
          />
        </section>

        <section aria-labelledby="perfiles-titulo" className="flex flex-col gap-6">
          <h3 id="perfiles-titulo" className="font-display text-lg font-extrabold">
            Perfiles de los agentes
          </h3>
          {datos.departamentos.flatMap((dep) =>
            dep.agentes.map((agente) => (
              <EditorTexto
                key={agente.id}
                tipo="perfil"
                id={agente.id}
                etiqueta={`${agente.nombre} · ${dep.nombre}${agente.activo === false ? " (aún no trabaja)" : ""}`}
                inicial={agente.instrucciones}
                filas={6}
              />
            )),
          )}
        </section>
      </div>
    </aside>
  );
}
