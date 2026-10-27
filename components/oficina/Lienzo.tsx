"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/** Margen que se deja bajo la planta (px reales), para que no toque el borde de la ventana. */
const MARGEN_INFERIOR = 16;

/**
 * Dibuja la planta a tamaño fijo (px de diseño) y la escala para que quepa entera en la ventana:
 * la escala es la menor entre la del ancho disponible y la del alto que queda bajo la cabecera y el título.
 * Se recalcula al cambiar el tamaño de la ventana y al abrir o cerrar un panel lateral (cambia el ancho).
 * Si sobra espacio a los lados, queda centrada.
 */
export default function Lienzo({ ancho, alto, children }: { ancho: number; alto: number; children: ReactNode }) {
  const marco = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = marco.current;
    if (!el) return;
    const medir = () => {
      // Distancia desde el principio de la página (no cambia al desplazarse).
      const arriba = el.getBoundingClientRect().top + window.scrollY;
      const altoLibre = window.innerHeight - arriba - MARGEN_INFERIOR;
      setEscala(Math.max(0.1, Math.min(el.clientWidth / ancho, altoLibre / alto)));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    window.addEventListener("resize", medir);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", medir);
    };
  }, [ancho, alto]);

  const estilo = {
    "--escala": escala ?? 1,
    "--ancho": `${ancho}px`,
    "--alto": `${alto}px`,
    // Hasta medir, ocupa el ancho con la proporción de la planta; después, su tamaño escalado exacto.
    aspectRatio: `${ancho} / ${alto}`,
    width: escala === null ? undefined : ancho * escala,
  } as CSSProperties;

  return (
    <div ref={marco} className="w-full">
      <div className="escena" data-medida={escala !== null} style={estilo}>
        <div className="lienzo">{children}</div>
      </div>
    </div>
  );
}
