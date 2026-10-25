"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Luz } from "@/lib/estado";

const ANCHO = 1200;
/** Línea del suelo en la ciudad (px de diseño, dentro de un paisaje de 900 de alto). */
const SUELO = 704;
const MARGEN_CIUDAD = 140;
const ANCHO_PARCELA = 350;
const ANCHO_SOLAR = 240;

/** Un piso de la fachada (un departamento) con una ventana por agente. */
export type PisoFachada = {
  id: string;
  ventanas: { id: string; nombre: string; texto: string; luz: Luz }[];
};

/** Lo que la ciudad necesita de cada proyecto para dibujar su edificio. */
export type ProyectoCiudad = {
  id: string;
  nombre: string;
  letrero: { principal: string; secundario: string | null; color: string; colorSecundario: string };
  resumen: string;
  estado: string;
  /** "⚠ X agentes te necesitan", si alguno está en rojo. */
  aviso?: string;
  fachada: PisoFachada[];
};

type Props = {
  proyectos: ProyectoCiudad[];
  /** Interior (edificio en corte) de cada proyecto, por id. */
  interiores: Record<string, ReactNode>;
  /** Altura del lienzo (px de diseño): depende del edificio con más pisos. */
  alto: number;
  dentroInicial: boolean;
  actualInicial: string;
  hayFicha: boolean;
};

/** Centro horizontal de la parcela del edificio i en la ciudad. */
function centroParcela(i: number): number {
  return MARGEN_CIUDAD + ANCHO_PARCELA / 2 + i * ANCHO_PARCELA;
}

/** Alto del edificio en la ciudad: letrero + un piso por departamento + planta baja con la puerta. */
function altoFachada(pisos: number): number {
  return 72 + 22 + Math.max(pisos, 1) * 84 + 108;
}

/** Línea de una colina ondulada a lo ancho de toda la ciudad (siempre continua). */
function colina(ancho: number, base: number, amp: number, periodo: number, fase: number): string {
  const y = (x: number) =>
    base + amp * Math.sin((x / periodo) * 2 * Math.PI + fase) + amp * 0.45 * Math.sin((x / (periodo * 0.41)) * 2 * Math.PI + fase * 1.7);
  let d = `M0 ${y(0).toFixed(1)}`;
  for (let x = 30; x <= ancho + 30; x += 30) d += ` L${x} ${y(x).toFixed(1)}`;
  return `${d} L${ancho + 30} 900 L0 900 Z`;
}

/** Molino de viento: torre y aspas que giran. */
function Molino({ x, y, escala = 1, retraso = 0 }: { x: number; y: number; escala?: number; retraso?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${escala})`}>
      <path d="M-2.5 0 L-1.2 -70 L1.2 -70 L2.5 0 Z" fill="#eef1f5" />
      <path d="M0 0 L2.5 0 L1.2 -70 L0 -70 Z" fill="#c9cfd8" />
      <g transform="translate(0 -70)">
        <g className="aspas" style={{ animationDelay: `${retraso}s` }}>
          <path d="M0 0 L-1.6 -2 L-1 -36 L1 -36 L1.6 -2 Z" fill="#fbfcfe" />
          <path d="M0 0 L-1.6 -2 L-1 -36 L1 -36 L1.6 -2 Z" fill="#fbfcfe" transform="rotate(120)" />
          <path d="M0 0 L-1.6 -2 L-1 -36 L1 -36 L1.6 -2 Z" fill="#fbfcfe" transform="rotate(240)" />
        </g>
        <circle r="2.6" fill="#c9cfd8" />
      </g>
    </g>
  );
}

function Cipres({ x, y, alto = 46 }: { x: number; y: number; alto?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="0" rx={alto * 0.22} ry="3" fill="rgba(30,40,20,0.3)" />
      <path d={`M0 ${-alto} C ${alto * 0.18} ${-alto * 0.7}, ${alto * 0.2} ${-alto * 0.2}, 0 0 C ${-alto * 0.2} ${-alto * 0.2}, ${-alto * 0.18} ${-alto * 0.7}, 0 ${-alto} Z`} fill="#2f5d36" />
      <path d={`M0 ${-alto} C ${alto * 0.18} ${-alto * 0.7}, ${alto * 0.2} ${-alto * 0.2}, 0 0 Z`} fill="#264d2c" />
    </g>
  );
}

function Arbol({ x, y, r = 16 }: { x: number; y: number; r?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="0" rx={r * 0.9} ry="3.5" fill="rgba(30,40,20,0.3)" />
      <rect x="-2" y={-r * 0.9} width="4" height={r * 0.9} fill="#6b4427" />
      <circle cx="0" cy={-r * 1.4} r={r} fill="#4f8a3c" />
      <circle cx={r * 0.35} cy={-r * 1.55} r={r * 0.6} fill="#5f9d48" />
    </g>
  );
}

/**
 * Paisaje del Empordanet al atardecer, del ancho que haga falta.
 * Con `parcelas`, dibuja una carretera hasta la puerta de cada edificio.
 */
function Paisaje({ id, ancho, parcelas = [] }: { id: string; ancho: number; parcelas?: number[] }) {
  const tramos = Math.ceil(ancho / ANCHO);
  return (
    <svg className="paisaje" viewBox={`0 0 ${ancho} 900`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-cielo`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f5fa8" />
          <stop offset="0.38" stopColor="#7c9fd4" />
          <stop offset="0.62" stopColor="#f2b27a" />
          <stop offset="0.8" stopColor="#f08a4b" />
        </linearGradient>
        <radialGradient id={`${id}-sol`}>
          <stop offset="0" stopColor="#fff2c4" stopOpacity="0.95" />
          <stop offset="0.35" stopColor="#ffc97a" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ff9a50" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-carretera`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6d6a73" />
          <stop offset="1" stopColor="#4a4850" />
        </linearGradient>
      </defs>

      <rect width={ancho} height="900" fill={`url(#${id}-cielo)`} />
      <circle cx={ancho - 330} cy="405" r="170" fill={`url(#${id}-sol)`} />
      <circle cx={ancho - 330} cy="405" r="40" fill="#ffd27a" />

      {/* Colinas lejanas, medias y cercanas */}
      <path d={colina(ancho, 455, 22, 640, 0.6)} fill="#7d8f6a" opacity="0.85" />
      <path d={colina(ancho, 525, 18, 560, 2.1)} fill="#5f8a4a" />
      <path d={colina(ancho, 615, 14, 700, 4)} fill="#4f7d3c" />
      <path d={colina(ancho, 690, 7, 900, 1)} fill="#6a9a48" />

      {/* Campos y molinos, repetidos cada 1200 px */}
      {Array.from({ length: tramos }, (_, t) => {
        const o = t * ANCHO;
        return (
          <g key={t}>
            <path d={`M${o} 790 L${o + 300} 760 L${o + 340} 900 L${o} 900 Z`} fill="#7aa452" opacity="0.5" />
            <path d={`M${o + 860} 770 L${o + 1180} 780 L${o + 1200} 900 L${o + 830} 900 Z`} fill="#c9a24f" opacity="0.4" />
            <Molino x={o + 150} y={520} escala={0.9} retraso={-t * 0.7} />
            <Molino x={o + 268} y={500} escala={0.7} retraso={-1.3 - t} />
            <Molino x={o + 1010} y={500} escala={0.85} retraso={-0.6 - t} />
            <Molino x={o + 1110} y={512} escala={0.65} retraso={-2.1 - t} />
            <Arbol x={o + 60} y={760} r={22} />
            <Arbol x={o + 1160} y={770} r={22} />
          </g>
        );
      })}

      {/* Carretera principal y un ramal hasta la puerta de cada edificio */}
      <rect x="0" y="825" width={ancho} height="34" fill="#5a5862" />
      <path d={`M0 842 L${ancho} 842`} stroke="#f5e9c8" strokeWidth="3" strokeDasharray="18 16" opacity="0.8" />
      {parcelas.map((cx) => (
        <g key={cx}>
          <path d={`M${cx - 44} 828 C ${cx - 30} 790, ${cx - 14} 740, ${cx - 12} ${SUELO} L${cx + 12} ${SUELO} C ${cx + 14} 740, ${cx + 30} 790, ${cx + 44} 828 Z`} fill={`url(#${id}-carretera)`} />
          <Cipres x={cx - 78} y={760} alto={60} />
          <Cipres x={cx + 78} y={760} alto={58} />
          <Arbol x={cx - 140} y={720} r={18} />
          <Arbol x={cx + 140} y={730} r={15} />
        </g>
      ))}
    </svg>
  );
}

function Nubes() {
  return (
    <div className="nubes-ciudad" aria-hidden="true">
      <span className="nube-c" style={{ "--x": "120px", top: 80, animationDuration: "140s", animationDelay: "-20s" } as CSSProperties} />
      <span className="nube-c grande" style={{ "--x": "760px", top: 150, animationDuration: "190s", animationDelay: "-110s" } as CSSProperties} />
      <span className="nube-c" style={{ "--x": "340px", top: 230, animationDuration: "160s", animationDelay: "-70s" } as CSSProperties} />
      <span className="nube-c pequena" style={{ "--x": "1000px", top: 40, animationDuration: "220s", animationDelay: "-160s" } as CSSProperties} />
    </div>
  );
}

/** Edificio de un proyecto en la ciudad, con su tarjeta al pasar el ratón. */
function EdificioCiudad({ proyecto, cx, elegido, onEntrar, refBoton }: { proyecto: ProyectoCiudad; cx: number; elegido: boolean; onEntrar: () => void; refBoton: (el: HTMLButtonElement | null) => void }) {
  const alto = altoFachada(proyecto.fachada.length);
  const { letrero } = proyecto;
  return (
    <div
      className={`edificio-ciudad${elegido ? " elegido" : ""}`}
      style={{ left: cx - 120, top: SUELO - alto, height: alto, "--edificio": letrero.color } as CSSProperties}
    >
      <button
        ref={refBoton}
        type="button"
        className="fachada"
        onClick={onEntrar}
        aria-label={`Entrar al edificio ${proyecto.nombre}. ${proyecto.fachada
          .flatMap((p) => p.ventanas)
          .map((v) => `${v.nombre}: ${v.texto}`)
          .join(". ")}`}
      >
        <span className="fachada-letrero" aria-hidden="true">
          <span className="principal" style={{ color: letrero.color }}>
            {letrero.principal}
          </span>
          {letrero.secundario && (
            <span className="secundario" style={{ color: letrero.colorSecundario }}>
              {letrero.secundario}
            </span>
          )}
        </span>
        <span className="fachada-cuerpo" aria-hidden="true">
          {proyecto.fachada.map((piso) => (
            <span key={piso.id} className={`fachada-planta ventanas-${Math.min(piso.ventanas.length, 3)}`}>
              {piso.ventanas.map((v) => (
                <span key={v.id} className={`fachada-ventana luz-${v.luz}`}>
                  <span className="globo">
                    {v.nombre} · {v.texto}
                  </span>
                </span>
              ))}
            </span>
          ))}
          <span className="fachada-puerta" />
          <span className="fachada-farol izq" />
          <span className="fachada-farol der" />
        </span>
      </button>

      <div className="tarjeta-edificio" role="group" aria-label={`Proyecto ${proyecto.nombre}`}>
        <p className="tarjeta-nombre">{proyecto.nombre}</p>
        <p className="tarjeta-dato">{proyecto.resumen}</p>
        <p className="tarjeta-dato">
          <span className="tarjeta-punto" aria-hidden="true" /> {proyecto.estado}
        </p>
        {proyecto.aviso && <p className="tarjeta-aviso">{proyecto.aviso}</p>}
        <button type="button" className="btn-primary mt-3 w-full" onClick={onEntrar}>
          Entrar al edificio
        </button>
      </div>
    </div>
  );
}

/** Pantallas 1 y 2: la ciudad con todos los proyectos y, al entrar, el edificio elegido en corte. */
export default function Escena({ proyectos, interiores, alto, dentroInicial, actualInicial, hayFicha }: Props) {
  const router = useRouter();
  const [dentro, setDentro] = useState(dentroInicial);
  const [actual, setActual] = useState(actualInicial);
  const [origen, setOrigen] = useState(() => centroParcela(Math.max(0, proyectos.findIndex((p) => p.id === actualInicial))));
  const [escala, setEscala] = useState<number | null>(null);
  // Si la página llega con otra vista (enlace de la cabecera, ficha…), la escena la sigue.
  const [vistaPrevia, setVistaPrevia] = useState(`${dentroInicial}|${actualInicial}`);
  if (vistaPrevia !== `${dentroInicial}|${actualInicial}`) {
    setVistaPrevia(`${dentroInicial}|${actualInicial}`);
    setDentro(dentroInicial);
    setActual(actualInicial);
  }

  const marco = useRef<HTMLDivElement>(null);
  const ciudad = useRef<HTMLDivElement>(null);
  const botones = useRef<Record<string, HTMLButtonElement | null>>({});
  const botonVolver = useRef<HTMLButtonElement>(null);
  const dentroAntes = useRef(dentro);

  const anchoCiudad = Math.max(ANCHO, MARGEN_CIUDAD + proyectos.length * ANCHO_PARCELA + ANCHO_SOLAR + 100);
  const parcelas = proyectos.map((_, i) => centroParcela(i));

  // El lienzo se dibuja a 1200 px y se escala al ancho disponible.
  useLayoutEffect(() => {
    const el = marco.current;
    if (!el) return;
    const medir = () => setEscala(el.clientWidth / ANCHO);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Al entrar o salir, cuando acaba la animación, el foco pasa al control visible.
  useEffect(() => {
    if (dentroAntes.current === dentro) return;
    dentroAntes.current = dentro;
    const id = setTimeout(() => (dentro ? botonVolver.current : botones.current[actual])?.focus({ preventScroll: true }), 900);
    return () => clearTimeout(id);
  }, [dentro, actual]);

  function entrar(id: string, i: number) {
    // El zoom sale del edificio elegido, tal como se ve ahora (con el desplazamiento de la ciudad).
    setOrigen(centroParcela(i) - (ciudad.current?.scrollLeft ?? 0));
    setActual(id);
    setDentro(true);
    window.history.replaceState(null, "", `/?vista=edificio&proyecto=${id}`);
  }

  function volver() {
    setDentro(false);
    if (hayFicha) router.replace("/", { scroll: false });
    else window.history.replaceState(null, "", "/");
  }

  const estilo = {
    "--escala": escala ?? 1,
    "--alto": `${alto}px`,
    "--origen-x": `${origen}px`,
    "--ancho-ciudad": `${anchoCiudad}px`,
    aspectRatio: `${ANCHO} / ${alto}`,
  } as CSSProperties;

  return (
    <div ref={marco} className="escena" data-dentro={dentro} data-medida={escala !== null} style={estilo}>
      <div className="lienzo">
        {/* Pantalla 1 · la ciudad (se desliza en horizontal si no caben todos los edificios) */}
        <div ref={ciudad} className="capa-ciudad" inert={dentro} tabIndex={-1}>
          <div className="ciudad" style={{ width: anchoCiudad }}>
            <div className="ciudad-suelo">
              <Paisaje id="ciudad" ancho={anchoCiudad} parcelas={parcelas} />
              <Nubes />
              {proyectos.map((p, i) => (
                <EdificioCiudad
                  key={p.id}
                  proyecto={p}
                  cx={parcelas[i]}
                  elegido={p.id === actual}
                  onEntrar={() => entrar(p.id, i)}
                  refBoton={(el) => {
                    botones.current[p.id] = el;
                  }}
                />
              ))}
              <button
                type="button"
                className="solar"
                style={{ left: MARGEN_CIUDAD + proyectos.length * ANCHO_PARCELA + 30 }}
                disabled
                title="Próximamente"
              >
                <span aria-hidden="true">+</span> Nuevo proyecto
              </button>
            </div>
          </div>
        </div>

        {/* Pantalla 2 · dentro del edificio elegido */}
        <div className="capa-interior" inert={!dentro}>
          <div className="fondo-interior" aria-hidden="true">
            <Paisaje id="fondo" ancho={ANCHO} />
          </div>
          <button ref={botonVolver} type="button" className="btn-secondary volver" onClick={volver}>
            ← Volver a la ciudad
          </button>
          {interiores[actual]}
        </div>
      </div>
    </div>
  );
}
