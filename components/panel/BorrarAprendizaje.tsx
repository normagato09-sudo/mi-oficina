"use client";

import { useState, useTransition } from "react";
import { borrarAprendizajeAccion } from "@/app/actions/trabajos";

/** Botón para borrar un aprendizaje de un agente (carpeta "Equipo"). */
export default function BorrarAprendizaje({ id, texto }: { id: string; texto: string }) {
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className="flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-md text-lg leading-none text-muted hover:bg-red-500/15 hover:text-red-300 disabled:opacity-40"
        aria-label={`Borrar el aprendizaje: ${texto}`}
        title="Borrar"
        disabled={pendiente}
        onClick={() => {
          if (!window.confirm("¿Borrar este aprendizaje? El agente dejará de tenerlo en cuenta.")) return;
          setError(null);
          empezar(async () => {
            const r = await borrarAprendizajeAccion(id);
            if (r.error) setError(r.error);
          });
        }}
      >
        ×
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-300">
          {error}
        </span>
      )}
    </>
  );
}
