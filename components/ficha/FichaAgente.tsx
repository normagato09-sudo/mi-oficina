import type { AgenteConEstado } from "@/lib/datos";
import { NOMBRE_DESPACHO } from "@/lib/despachos";
import { COLOR_LUZ, estadoAgente } from "@/lib/estado";
import { CerrarFicha } from "./navegacion";

type Props = {
  agente: AgenteConEstado;
  /** Color de la ficha (el de su camiseta). */
  color: string;
  /** Encargos en cola (solo el Director). */
  enCola?: number;
  children?: React.ReactNode;
};

function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** Ficha del agente: panel a la derecha de la oficina. */
export default function FichaAgente({ agente, color, enCola = 0, children }: Props) {
  const estado = estadoAgente(agente, enCola);
  return (
    <aside
      aria-labelledby="ficha-titulo"
      className="sticky top-20 max-h-[calc(100vh-7rem)] w-[420px] shrink-0 overflow-y-auto rounded-2xl border border-line bg-panel"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-panel/95 px-4 py-2 backdrop-blur">
        <span className="text-sm text-muted">Ficha del agente</span>
        <CerrarFicha />
      </div>

      <div className="p-5">
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="flex size-16 shrink-0 items-center justify-center rounded-2xl font-display text-2xl font-extrabold text-white shadow-[0_3px_0_rgba(0,0,0,0.35)]"
            style={{ background: color }}
          >
            {iniciales(agente.nombre)}
          </span>
          <div className="min-w-0">
            <h2 id="ficha-titulo" className="font-display text-2xl font-extrabold">
              {agente.nombre}
            </h2>
            <p className="truncate text-sm text-muted">Mi Oficina · {NOMBRE_DESPACHO[agente.despacho]}</p>
            <p className="mt-1 flex items-center gap-2 text-sm">
              <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: COLOR_LUZ[estado.luz] }} />
              {estado.texto}
            </p>
          </div>
        </div>

        {children}
      </div>
    </aside>
  );
}
