"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/** Dibuja la planta a tamaño fijo (px de diseño) y la escala al ancho disponible. */
export default function Lienzo({ ancho, alto, children }: { ancho: number; alto: number; children: ReactNode }) {
  const marco = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = marco.current;
    if (!el) return;
    const medir = () => setEscala(el.clientWidth / ancho);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ancho]);

  const estilo = {
    "--escala": escala ?? 1,
    "--ancho": `${ancho}px`,
    "--alto": `${alto}px`,
    aspectRatio: `${ancho} / ${alto}`,
  } as CSSProperties;

  return (
    <div ref={marco} className="escena" data-medida={escala !== null} style={estilo}>
      <div className="lienzo">{children}</div>
    </div>
  );
}
