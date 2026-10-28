import Link from "next/link";
import type { ProyectoResumen } from "@/lib/proyectos";
import { EtiquetaEstado } from "./comun";

/** En la ficha del Director: los proyectos sin terminar y cómo va su plan. Cada uno abre su detalle. */
export default function ProyectosDirector({ proyectos }: { proyectos: ProyectoResumen[] }) {
  if (!proyectos.length) return null;
  return (
    <section aria-labelledby="proyectos-director" className="mt-8">
      <h3 id="proyectos-director" className="font-display text-lg font-extrabold">
        Proyectos
      </h3>
      <ul className="mt-3 flex flex-col gap-2">
        {proyectos.map((p) => (
          <li key={p.id}>
            <Link
              href={`/?panel=proyectos&proyecto=${p.id}`}
              scroll={false}
              className="flex flex-col gap-1 rounded-xl border border-line px-3 py-2 hover:border-accent/60"
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                  <span aria-hidden="true" className="size-2 rounded-[2px]" style={{ background: p.organizacion.color }} />
                  {p.organizacion.nombre}
                </span>
                <EtiquetaEstado estado={p.estado} turno={p.turno} aviso={Boolean(p.aviso)} />
              </span>
              <span className="text-sm font-semibold">{p.nombre}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
