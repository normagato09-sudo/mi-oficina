import Link from "next/link";
import type { AgenteConEstado } from "@/lib/datos";
import { COLOR_TONO, estadoAgente } from "@/lib/estado";

type Props = {
  agente: AgenteConEstado;
  edificioNombre: string;
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

/** Ficha del agente: panel a la derecha en escritorio y a pantalla completa en móvil. */
export default function FichaAgente({ agente, edificioNombre, children }: Props) {
  const estado = estadoAgente(agente.estados);
  return (
    <aside
      aria-labelledby="ficha-titulo"
      className="fixed inset-0 z-40 overflow-y-auto bg-ink lg:sticky lg:inset-auto lg:top-20 lg:z-auto lg:max-h-[calc(100vh-6rem)] lg:w-[420px] lg:shrink-0 lg:rounded-2xl lg:border lg:border-line lg:bg-panel"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-ink/95 px-4 py-2 backdrop-blur lg:bg-panel/95">
        <span className="text-sm text-muted">Ficha del agente</span>
        <Link
          href="/?vista=edificio"
          scroll={false}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-2xl leading-none text-muted hover:text-text"
          aria-label="Cerrar ficha"
        >
          ×
        </Link>
      </div>

      <div className="p-5">
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-[#DA1415] font-display text-2xl font-extrabold text-white shadow-[0_3px_0_#9c0e0f]"
          >
            {iniciales(agente.nombre)}
          </span>
          <div className="min-w-0">
            <h2 id="ficha-titulo" className="font-display text-2xl font-extrabold">
              {agente.nombre}
            </h2>
            <p className="truncate text-sm text-muted">
              {edificioNombre} · {agente.departamento.nombre}
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm">
              <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: COLOR_TONO[estado.tono] }} />
              {estado.texto}
            </p>
          </div>
        </div>

        {children}
      </div>
    </aside>
  );
}
