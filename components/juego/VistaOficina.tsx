"use client";

import { useState, type ReactNode } from "react";
import Juego from "./Juego";
import type { AgenteJuego } from "./escena";

export type Vista = "juego" | "clasica";

/** Elige entre la oficina como juego y la vista clásica, y recuerda la última elegida. */
export default function VistaOficina({
  inicial,
  titulo,
  clasica,
  agentes,
}: {
  inicial: Vista;
  /** Título y resumen de la oficina (a la izquierda del botón). */
  titulo: ReactNode;
  clasica: ReactNode;
  agentes: AgenteJuego[];
}) {
  const [vista, setVista] = useState<Vista>(inicial);
  const cambiar = () => {
    const nueva: Vista = vista === "juego" ? "clasica" : "juego";
    // La cookie "vista" la lee el servidor (app/page.tsx) para pintar la buena desde el principio.
    document.cookie = `vista=${nueva}; path=/; max-age=31536000; samesite=lax`;
    setVista(nueva);
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {titulo}
        <button type="button" onClick={cambiar} className="btn-secondary">
          {vista === "juego" ? "Vista clásica" : "Vista juego"}
        </button>
      </div>
      <div className="mt-3">{vista === "juego" ? <Juego agentes={agentes} /> : clasica}</div>
    </>
  );
}
