"use client";

import { useSearchParams } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";

/**
 * Abrir y cerrar la ficha de un agente solo cambia la URL (history.pushState): Next.js lo sincroniza
 * con useSearchParams sin volver a pedir la página, así que la oficina no se recarga.
 */
export function abrirFicha(agenteId: string | null, nuevoEncargo = false) {
  window.history.pushState(null, "", agenteId ? `/?agente=${agenteId}${nuevoEncargo ? "&nuevo=1" : ""}` : "/");
}

/** El agente cuya ficha está abierta (o null). */
export function useFichaAbierta(): string | null {
  return useSearchParams().get("agente");
}

/** Puesto de un agente: abre su ficha o, si ya está abierta, la cierra. */
export function EnlaceFicha({
  agenteId,
  etiqueta,
  className,
  style,
  children,
}: {
  agenteId: string;
  /** Texto para lectores de pantalla (se le añade "Abrir/Cerrar ficha"). */
  etiqueta: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const abierta = useFichaAbierta() === agenteId;
  return (
    <a
      href={abierta ? "/" : `/?agente=${agenteId}`}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        abrirFicha(abierta ? null : agenteId);
      }}
      aria-current={abierta ? "true" : undefined}
      aria-label={`${etiqueta}. ${abierta ? "Cerrar" : "Abrir"} ficha`}
      className={className}
      style={style}
    >
      {children}
    </a>
  );
}

/** Botón "+ Nuevo encargo" de la cabecera: abre la ficha del Director con el formulario abierto. */
export function BotonNuevoEncargo({ directorId }: { directorId: string }) {
  return (
    <a
      href={`/?agente=${directorId}&nuevo=1`}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        abrirFicha(directorId, true);
      }}
      className="btn-primary"
    >
      + Nuevo encargo
    </a>
  );
}

/** Botón × de la ficha. */
export function CerrarFicha() {
  return (
    <button
      type="button"
      onClick={() => abrirFicha(null)}
      className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-2xl leading-none text-muted hover:text-text"
      aria-label="Cerrar ficha"
    >
      ×
    </button>
  );
}

/** Los paneles de la cabecera y de la estantería se ocultan mientras haya una ficha abierta. */
export function SinFicha({ children }: { children: ReactNode }) {
  return useFichaAbierta() ? null : <>{children}</>;
}
