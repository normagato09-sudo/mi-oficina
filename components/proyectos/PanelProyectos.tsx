import Link from "next/link";
import type { ProyectoResumen, ProyectoVista } from "@/lib/proyectos";
import { ESTADOS_CERRADOS, MAX_PROYECTOS_A_LA_VEZ } from "@/lib/proyectos-reglas";
import DetalleProyecto from "./DetalleProyecto";
import NuevoProyecto from "./NuevoProyecto";
import { BarraProgreso, EtiquetaEstado, fechaCorta } from "./comun";

type Props =
  | { vista: "lista"; proyectos: ProyectoResumen[] }
  | { vista: "nuevo"; organizaciones: { id: string; nombre: string }[] }
  | { vista: "detalle"; proyecto: ProyectoVista | null }
  | { vista: "error"; error: string };

/** Panel "Proyectos" de la cabecera: la lista, "Nuevo proyecto" y el detalle de cada uno. */
export default function PanelProyectos(props: Props) {
  return (
    <aside
      aria-labelledby="panel-titulo"
      className="sticky top-20 max-h-[calc(100vh-7rem)] w-[520px] shrink-0 overflow-y-auto rounded-2xl border border-line bg-panel"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-panel/95 px-4 py-2 backdrop-blur">
        {props.vista === "lista" ? (
          <span className="text-sm text-muted">Proyectos</span>
        ) : (
          <Link href="/?panel=proyectos" scroll={false} className="flex min-h-11 items-center text-sm text-muted hover:text-text">
            ← Todos los proyectos
          </Link>
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

      <div className="flex flex-col gap-6 p-5">
        {props.vista === "lista" && <Lista proyectos={props.proyectos} />}
        {props.vista === "nuevo" && (
          <>
            <div>
              <h2 id="panel-titulo" className="font-display text-2xl font-extrabold">
                Nuevo proyecto
              </h2>
              <p className="mt-1 text-sm text-muted">
                Un trabajo grande que el equipo hace hasta el 100 %. Al crearlo, el Director prepara un plan por fases para que lo revises.
              </p>
            </div>
            <NuevoProyecto organizaciones={props.organizaciones} />
          </>
        )}
        {props.vista === "detalle" &&
          (props.proyecto ? (
            <DetalleProyecto key={props.proyecto.id} proyecto={props.proyecto} />
          ) : (
            <p id="panel-titulo" className="text-sm text-muted">
              Este proyecto no existe.
            </p>
          ))}
        {props.vista === "error" && (
          <p id="panel-titulo" role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
            {props.error}
          </p>
        )}
      </div>
    </aside>
  );
}

function Lista({ proyectos }: { proyectos: ProyectoResumen[] }) {
  const vivos = proyectos.filter((p) => !ESTADOS_CERRADOS.includes(p.estado));
  const cerrados = proyectos.filter((p) => ESTADOS_CERRADOS.includes(p.estado));
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h2 id="panel-titulo" className="font-display text-2xl font-extrabold">
          Proyectos
        </h2>
        <Link href="/?panel=proyectos&proyecto=nuevo" scroll={false} className="btn-primary">
          + Nuevo proyecto
        </Link>
      </div>
      <p className="-mt-3 text-sm text-muted">
        Trabajos grandes, por fases. Como mucho {MAX_PROYECTOS_A_LA_VEZ} a la vez; los demás esperan su turno. Para cosas pequeñas, usa los encargos.
      </p>
      <Grupo titulo="En curso" proyectos={vivos} vacio="Todavía no hay ningún proyecto." />
      {cerrados.length > 0 && <Grupo titulo="Terminados y cancelados" proyectos={cerrados} />}
    </>
  );
}

function Grupo({ titulo, proyectos, vacio }: { titulo: string; proyectos: ProyectoResumen[]; vacio?: string }) {
  return (
    <section aria-label={titulo}>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{titulo}</h3>
      {proyectos.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{vacio}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {proyectos.map((p) => (
            <li key={p.id}>
              <Link
                href={`/?panel=proyectos&proyecto=${p.id}`}
                scroll={false}
                className="flex flex-col gap-2 rounded-xl border border-line px-3 py-2.5 hover:border-accent/60"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                    <span aria-hidden="true" className="size-2 rounded-[2px]" style={{ background: p.organizacion.color }} />
                    {p.organizacion.nombre}
                  </span>
                  <EtiquetaEstado estado={p.estado} turno={p.turno} aviso={Boolean(p.aviso)} faseEstado={p.fase_estado} />
                  {p.fase && (
                    <span className="text-xs text-muted">
                      Fase {p.fase.numero} de {p.fase.total}
                    </span>
                  )}
                  {p.fecha_limite && <span className="text-xs text-muted">· hasta el {fechaCorta(p.fecha_limite)}</span>}
                </span>
                <span className="font-semibold">{p.nombre}</span>
                <BarraProgreso valor={p.progreso} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
