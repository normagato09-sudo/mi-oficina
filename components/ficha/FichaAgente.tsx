"use client";

import { useEffect, useRef } from "react";
import type { AgenteConEstado } from "@/lib/datos";
import { NOMBRE_DESPACHO } from "@/lib/despachos";
import { COLOR_LUZ, estadoAgente } from "@/lib/estado";
import { CerrarFicha, abrirFicha } from "./navegacion";

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

/**
 * Ficha del agente: un panel que se superpone a la oficina por la derecha (sin encogerla),
 * con un fondo semitransparente detrás. Se cierra con la X, con Esc o pulsando fuera.
 */
export default function FichaAgente({ agente, color, enCola = 0, children }: Props) {
  const estado = estadoAgente(agente, enCola);
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      // Esc cierra la ficha, salvo que haya una ventana encima (p. ej. "Publicar"): esa se cierra primero.
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) abrirFicha(null);
    };
    window.addEventListener("keydown", alPulsar);
    panel.current?.focus();
    return () => window.removeEventListener("keydown", alPulsar);
  }, []);

  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 z-40 bg-ink/55 backdrop-blur-[1px]" onClick={() => abrirFicha(null)} />
      <aside
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ficha-titulo"
        className="fixed bottom-3 right-3 top-3 z-50 w-[min(460px,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-line bg-panel shadow-[0_20px_60px_rgba(0,0,0,0.55)] outline-none"
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
    </>
  );
}
