"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { abrirFicha } from "@/components/ficha/navegacion";
import type { AgenteJuego, Juego as JuegoPhaser } from "./escena";

/** Margen bajo el juego (px), para que no toque el borde de la ventana. */
const MARGEN_INFERIOR = 16;

/** Hay una ficha o una ventana abierta encima del juego. */
function hayVentana() {
  return document.querySelector('[aria-modal="true"], dialog[open]') !== null;
}

/**
 * La oficina como videojuego (Phaser). Phaser solo se descarga en el navegador y al abrir esta vista,
 * así que no frena la carga de la página. Ocupa el alto que queda en la ventana.
 */
export default function Juego({ agentes }: { agentes: AgenteJuego[] }) {
  const marco = useRef<HTMLDivElement>(null);
  const juego = useRef<JuegoPhaser | null>(null);
  const ultimos = useRef(agentes);
  const [alto, setAlto] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    const el = marco.current;
    if (!el) return;
    const medir = () => setAlto(Math.max(320, window.innerHeight - (el.getBoundingClientRect().top + window.scrollY) - MARGEN_INFERIOR));
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  // Arranca una sola vez, cuando ya se sabe el alto; los datos nuevos llegan por actualizar().
  const listo = alto !== null;
  useEffect(() => {
    if (!listo) return;
    let vivo = true;
    import("./escena")
      .then(({ crearJuego }) => {
        if (!vivo || !marco.current) return;
        juego.current = crearJuego(marco.current, {
          agentes: ultimos.current,
          abrirFicha: (id) => abrirFicha(id),
          bloqueado: hayVentana,
        });
        setCargando(false);
      })
      .catch((e: unknown) => vivo && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      vivo = false;
      juego.current?.destruir();
      juego.current = null;
    };
  }, [listo]);

  useEffect(() => {
    ultimos.current = agentes;
    juego.current?.actualizar(agentes);
  }, [agentes]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-[#1b1f2a]" style={{ height: alto ?? "70vh" }}>
      <div ref={marco} className="absolute inset-0" aria-label="Oficina en modo juego" role="application" />
      {cargando && !error && (
        <p role="status" className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted">
          <span aria-hidden="true" className="size-2.5 animate-pulse rounded-full bg-accent" />
          Abriendo la oficina…
        </p>
      )}
      {error && (
        <p role="alert" className="absolute inset-x-4 top-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
          No se pudo abrir el juego: {error}
        </p>
      )}
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-xl border border-white/10 bg-ink/80 px-3 py-2 text-xs leading-relaxed text-muted backdrop-blur">
        <p>
          <Tecla>←↑↓→</Tecla> o <Tecla>WASD</Tecla> andar
        </p>
        <p>
          <Tecla>E</Tecla> o clic: ficha del agente · <Tecla>Esc</Tecla> cerrar
        </p>
        <p>
          Rueda o <Tecla>+</Tecla> <Tecla>−</Tecla> acercar y alejar
        </p>
      </div>
    </div>
  );
}

function Tecla({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-white/20 bg-white/10 px-1 font-sans text-[11px] text-text">{children}</kbd>;
}
