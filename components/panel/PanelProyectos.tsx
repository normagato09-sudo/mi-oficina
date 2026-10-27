import Link from "next/link";
import { cambiarActivoProyecto } from "@/app/actions/proyecto";
import { IDIOMAS_PROYECTO, type IdiomaProyecto } from "@/lib/idiomas";
import type { Edificio } from "@/lib/tipos";
import FormProyecto from "./FormProyecto";

type Props = {
  /** Todos los proyectos, también los archivados. */
  proyectos: Edificio[];
  /** Proyecto que se está editando, o "nuevo". */
  seleccionado?: string;
};

/** Panel "Proyectos" de la cabecera: lista, crear, editar, archivar y volver a activar. */
export default function PanelProyectos({ proyectos, seleccionado }: Props) {
  const editando = proyectos.find((p) => p.id === seleccionado);
  const nuevo = seleccionado === "nuevo";
  const activos = proyectos.filter((p) => p.activo !== false);
  const archivados = proyectos.filter((p) => p.activo === false);

  return (
    <aside
      aria-labelledby="panel-titulo"
      className="sticky top-20 max-h-[calc(100vh-7rem)] w-[460px] shrink-0 overflow-y-auto rounded-2xl border border-line bg-panel"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-panel/95 px-4 py-2 backdrop-blur">
        {editando || nuevo ? (
          <Link href="/?panel=proyectos" scroll={false} className="flex min-h-11 items-center text-sm text-muted hover:text-text">
            ← Todos los proyectos
          </Link>
        ) : (
          <span className="text-sm text-muted">Proyectos</span>
        )}
        <Link
          href="/"
          scroll={false}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-2xl leading-none text-muted hover:text-text"
          aria-label="Cerrar panel"
        >
          ×
        </Link>
      </div>

      {editando || nuevo ? (
        <div className="flex flex-col gap-6 p-5">
          <h2 id="panel-titulo" className="flex items-center gap-2.5 font-display text-2xl font-extrabold">
            {editando && <span aria-hidden="true" className="size-4 shrink-0 rounded-[4px]" style={{ background: editando.color }} />}
            {editando ? editando.nombre : "Nuevo proyecto"}
            {editando?.activo === false && <span className="text-sm font-normal text-muted">(archivado)</span>}
          </h2>
          <FormProyecto key={editando?.id ?? "nuevo"} proyecto={editando} />
          {editando && <BotonActivo proyecto={editando} />}
        </div>
      ) : (
        <div className="flex flex-col gap-6 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 id="panel-titulo" className="font-display text-2xl font-extrabold">
              Proyectos
            </h2>
            <Link href="/?panel=proyectos&proyecto=nuevo" scroll={false} className="btn-primary">
              + Nuevo proyecto
            </Link>
          </div>
          <Lista titulo="Activos" proyectos={activos} vacio="No hay ningún proyecto activo." />
          {archivados.length > 0 && <Lista titulo="Archivados" proyectos={archivados} />}
        </div>
      )}
    </aside>
  );
}

function Lista({ titulo, proyectos, vacio }: { titulo: string; proyectos: Edificio[]; vacio?: string }) {
  return (
    <section aria-label={`Proyectos ${titulo.toLowerCase()}`}>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{titulo}</h3>
      {proyectos.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{vacio}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {proyectos.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2">
              <span aria-hidden="true" className="size-4 shrink-0 rounded-[4px]" style={{ background: p.color }} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.nombre}</p>
                <p className="truncate text-sm text-muted">
                  {IDIOMAS_PROYECTO[p.idioma as IdiomaProyecto] ?? p.idioma}
                  {p.instagram ? ` · @${p.instagram}` : ""}
                </p>
              </div>
              <Link
                href={`/?panel=proyectos&proyecto=${p.id}`}
                scroll={false}
                className="flex min-h-11 items-center rounded-lg px-2 text-sm text-muted hover:text-text"
                aria-label={`Editar ${p.nombre}`}
              >
                Editar
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BotonActivo({ proyecto }: { proyecto: Edificio }) {
  const archivado = proyecto.activo === false;
  return (
    <form action={cambiarActivoProyecto} className="border-t border-line pt-5">
      <input type="hidden" name="id" value={proyecto.id} />
      <input type="hidden" name="activo" value={archivado ? "true" : "false"} />
      <p className="mb-3 text-sm text-muted">
        {archivado
          ? "Este proyecto está archivado: no aparece en la oficina ni en los encargos."
          : "Archivar lo oculta de la oficina y de los encargos. No se borra nada y puedes volver a activarlo."}
      </p>
      <button type="submit" className="btn-secondary">
        {archivado ? "Volver a activar" : "Archivar proyecto"}
      </button>
    </form>
  );
}
