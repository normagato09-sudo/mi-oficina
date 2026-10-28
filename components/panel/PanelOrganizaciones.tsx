import Link from "next/link";
import { cambiarActivoOrganizacion } from "@/app/actions/organizacion";
import { IDIOMAS_PROYECTO, type IdiomaProyecto } from "@/lib/idiomas";
import type { Edificio } from "@/lib/tipos";
import FormOrganizacion from "./FormOrganizacion";

type Props = {
  /** Todas las organizaciones (tabla edificios), también las archivadas. */
  organizaciones: Edificio[];
  /** Organización que se está editando, o "nueva". */
  seleccionado?: string;
};

/** Panel "Organizaciones" de la cabecera: lista, crear, editar, archivar y volver a activar. */
export default function PanelOrganizaciones({ organizaciones: proyectos, seleccionado }: Props) {
  const editando = proyectos.find((p) => p.id === seleccionado);
  const nuevo = seleccionado === "nueva";
  const activos = proyectos.filter((p) => p.activo !== false);
  const archivados = proyectos.filter((p) => p.activo === false);

  return (
    <aside
      aria-labelledby="panel-titulo"
      className="sticky top-20 max-h-[calc(100vh-7rem)] w-[460px] shrink-0 overflow-y-auto rounded-2xl border border-line bg-panel"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-panel/95 px-4 py-2 backdrop-blur">
        {editando || nuevo ? (
          <Link href="/?panel=organizaciones" scroll={false} className="flex min-h-11 items-center text-sm text-muted hover:text-text">
            ← Todas las organizaciones
          </Link>
        ) : (
          <span className="text-sm text-muted">Organizaciones</span>
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
            {editando ? editando.nombre : "Nueva organización"}
            {editando?.activo === false && <span className="text-sm font-normal text-muted">(archivada)</span>}
          </h2>
          <FormOrganizacion key={editando?.id ?? "nueva"} organizacion={editando} />
          {editando && <BotonActivo proyecto={editando} />}
        </div>
      ) : (
        <div className="flex flex-col gap-6 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 id="panel-titulo" className="font-display text-2xl font-extrabold">
              Organizaciones
            </h2>
            <Link href="/?panel=organizaciones&organizacion=nueva" scroll={false} className="btn-primary">
              + Nueva organización
            </Link>
          </div>
          <Lista titulo="Activas" proyectos={activos} vacio="No hay ninguna organización activa." />
          {archivados.length > 0 && <Lista titulo="Archivadas" proyectos={archivados} />}
        </div>
      )}
    </aside>
  );
}

function Lista({ titulo, proyectos, vacio }: { titulo: string; proyectos: Edificio[]; vacio?: string }) {
  return (
    <section aria-label={`Organizaciones ${titulo.toLowerCase()}`}>
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
                href={`/?panel=organizaciones&organizacion=${p.id}`}
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
    <form action={cambiarActivoOrganizacion} className="border-t border-line pt-5">
      <input type="hidden" name="id" value={proyecto.id} />
      <input type="hidden" name="activo" value={archivado ? "true" : "false"} />
      <p className="mb-3 text-sm text-muted">
        {archivado
          ? "Esta organización está archivada: no aparece en la oficina, en los encargos ni en los proyectos."
          : "Archivarla la oculta de la oficina, de los encargos y de los proyectos. No se borra nada y puedes volver a activarla."}
      </p>
      <button type="submit" className="btn-secondary">
        {archivado ? "Volver a activar" : "Archivar organización"}
      </button>
    </form>
  );
}
