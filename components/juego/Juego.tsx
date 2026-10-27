"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { abrirFicha } from "@/components/ficha/navegacion";
import { PLANTAS, nombrePlanta } from "@/lib/plantas";
import type { AgenteJuego, Juego as JuegoPhaser } from "./escena";

/** Margen bajo el juego (px), para que no toque el borde de la ventana. */
const MARGEN_INFERIOR = 16;
/** Lo que tardan las puertas del ascensor en cerrarse (y en abrirse), en ms. */
const PUERTAS_MS = 420;

/** Hay una ficha, el menú del ascensor u otra ventana encima del juego: el personaje no se mueve. */
function hayVentana() {
  return document.querySelector('[aria-modal="true"], dialog[open], [data-juego-ocupado]') !== null;
}

type Puertas = "nada" | "cerrando" | "abriendo";

/**
 * La oficina como videojuego (Phaser): un edificio de varias plantas. Phaser solo se descarga en el navegador
 * y al abrir esta vista, así que no frena la carga de la página. Ocupa el alto que queda en la ventana.
 */
export default function Juego({ agentes }: { agentes: AgenteJuego[] }) {
  const marco = useRef<HTMLDivElement>(null);
  const juego = useRef<JuegoPhaser | null>(null);
  const ultimos = useRef(agentes);
  const [alto, setAlto] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [planta, setPlanta] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
  const [puertas, setPuertas] = useState<Puertas>("nada");

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
          abrirAscensor: () => setMenu(true),
          alCambiarPlanta: setPlanta,
        });
        // Solo en desarrollo: para probar el juego con datos simulados desde la consola.
        if (process.env.NODE_ENV === "development") Object.assign(window, { __juego: juego.current, __agentes: () => ultimos.current });
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

  /** Las puertas se cierran, cambio de planta y se abren. */
  const viajar = (n: number) => {
    setMenu(false);
    if (n === planta) return;
    setPuertas("cerrando");
    setTimeout(() => {
      juego.current?.irAPlanta(n);
      setPuertas("abriendo");
      setTimeout(() => setPuertas("nada"), PUERTAS_MS);
    }, PUERTAS_MS + 120);
  };

  // Plantas donde alguien me necesita (luz roja).
  const rojas = new Set(agentes.filter((a) => a.luz === "rojo").map((a) => a.planta));

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-[#1b1f2a]" style={{ height: alto ?? "70vh" }}>
      <div ref={marco} className="absolute inset-0" aria-label="Oficina en modo juego" role="application" />

      {/* Puertas del ascensor */}
      {puertas !== "nada" && (
        <div data-juego-ocupado="" aria-hidden="true" className="pointer-events-none absolute inset-0 z-10">
          <div className={`puerta-ascensor izquierda ${puertas}`} style={{ animationDuration: `${PUERTAS_MS}ms` }} />
          <div className={`puerta-ascensor derecha ${puertas}`} style={{ animationDuration: `${PUERTAS_MS}ms` }} />
        </div>
      )}

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

      {/* En qué planta estoy */}
      {planta !== null && (
        <div className="pointer-events-none absolute right-3 top-3 z-20 flex items-center gap-2 rounded-xl border border-white/10 bg-ink/85 px-3 py-2 backdrop-blur">
          <span className="flex size-8 items-center justify-center rounded-lg bg-accent font-display text-lg font-extrabold text-ink">{planta}</span>
          <span className="text-sm">
            <span className="block text-xs text-muted">Planta</span>
            <span className="font-semibold text-text">{nombrePlanta(planta)}</span>
          </span>
        </div>
      )}

      {menu && planta !== null && <MenuAscensor actual={planta} rojas={rojas} alElegir={viajar} alCerrar={() => setMenu(false)} />}

      <div className="pointer-events-none absolute bottom-3 left-3 rounded-xl border border-white/10 bg-ink/80 px-3 py-2 text-xs leading-relaxed text-muted backdrop-blur">
        <p>
          <Tecla>←↑↓→</Tecla> o <Tecla>WASD</Tecla> andar
        </p>
        <p>
          <Tecla>E</Tecla> o clic: ficha del agente · <Tecla>Esc</Tecla> cerrar
        </p>
        <p>
          <Tecla>E</Tecla> en el ascensor o la escalera: cambiar de planta
        </p>
        <p>
          Rueda o <Tecla>+</Tecla> <Tecla>−</Tecla> acercar y alejar
        </p>
      </div>
    </div>
  );
}

/** Menú pequeño del ascensor: las plantas de arriba abajo, con un punto rojo donde me necesitan. */
function MenuAscensor({ actual, rojas, alElegir, alCerrar }: { actual: number; rojas: Set<number>; alElegir: (n: number) => void; alCerrar: () => void }) {
  const lista = useRef<HTMLDivElement>(null);
  useEffect(() => {
    lista.current?.querySelector<HTMLButtonElement>(`[data-planta="${actual}"]`)?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        alCerrar();
      } else if (/^[0-9]$/.test(e.key) && PLANTAS.some((p) => p.n === Number(e.key))) alElegir(Number(e.key));
      else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const botones = [...(lista.current?.querySelectorAll<HTMLButtonElement>("button[data-planta]") ?? [])];
        const i = botones.indexOf(document.activeElement as HTMLButtonElement);
        botones[(i + (e.key === "ArrowDown" ? 1 : -1) + botones.length) % botones.length]?.focus();
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [actual, alCerrar, alElegir]);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink/40" onClick={alCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ascensor-titulo"
        className="w-64 rounded-2xl border border-line bg-panel p-3 shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="ascensor-titulo" className="px-2 pb-2 font-display font-extrabold">
          Ascensor
        </p>
        <div ref={lista} className="flex flex-col gap-1">
          {[...PLANTAS].reverse().map((p) => (
            <button
              key={p.n}
              type="button"
              data-planta={p.n}
              onClick={() => alElegir(p.n)}
              aria-current={p.n === actual ? "true" : undefined}
              className="flex min-h-11 items-center gap-3 rounded-xl px-2 text-left hover:bg-white/5 focus-visible:bg-white/10 aria-[current=true]:bg-white/5"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line font-display font-extrabold">{p.n}</span>
              <span className="flex-1 text-sm">
                {p.nombre}
                {p.n === actual && <span className="block text-xs text-muted">Estás aquí</span>}
              </span>
              {rojas.has(p.n) && (
                <span className="flex items-center gap-1 text-xs text-red-300">
                  <span aria-hidden="true" className="size-2.5 rounded-full bg-[#DA1415]" />
                  Te necesitan
                </span>
              )}
            </button>
          ))}
        </div>
        <p className="px-2 pt-2 text-xs text-muted">Pulsa el número de la planta o Esc para cerrar.</p>
      </div>
    </div>
  );
}

function Tecla({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-white/20 bg-white/10 px-1 font-sans text-[11px] text-text">{children}</kbd>;
}
