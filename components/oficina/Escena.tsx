"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";

const ANCHO = 1200;

type Props = {
  nombre: string;
  resumen: string;
  estado: string;
  /** Altura del lienzo (px de diseño): depende del número de pisos. */
  alto: number;
  dentroInicial: boolean;
  hayFicha: boolean;
  interior: ReactNode;
};

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

/** Paisaje del Empordanet al atardecer (fijo, dibujado en SVG). */
function Paisaje({ id }: { id: string }) {
  return (
    <svg className="paisaje" viewBox="0 0 1200 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
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

      <rect width="1200" height="900" fill={`url(#${id}-cielo)`} />
      <circle cx="870" cy="405" r="170" fill={`url(#${id}-sol)`} />
      <circle cx="870" cy="405" r="40" fill="#ffd27a" />

      {/* Colinas lejanas, medias y cercanas */}
      <path d="M0 500 C 120 450, 240 470, 340 440 C 460 405, 560 470, 680 455 C 800 440, 900 410, 1020 440 C 1100 460, 1160 450, 1200 445 L1200 900 L0 900 Z" fill="#7d8f6a" opacity="0.85" />
      <path d="M0 560 C 140 510, 260 540, 380 515 C 520 485, 620 545, 760 530 C 900 515, 1000 490, 1200 520 L1200 900 L0 900 Z" fill="#5f8a4a" />
      <path d="M0 640 C 160 600, 320 625, 470 610 C 620 595, 760 640, 920 620 C 1040 605, 1120 600, 1200 610 L1200 900 L0 900 Z" fill="#4f7d3c" />
      <path d="M0 700 C 200 680, 420 690, 600 685 C 800 680, 1000 700, 1200 690 L1200 900 L0 900 Z" fill="#6a9a48" />

      {/* Campos */}
      <path d="M0 760 L380 720 L420 900 L0 900 Z" fill="#7aa452" opacity="0.6" />
      <path d="M820 720 L1200 740 L1200 900 L790 900 Z" fill="#c9a24f" opacity="0.45" />
      <path d="M830 750 L1200 770 M835 780 L1200 800 M840 810 L1200 830" stroke="#a9853a" strokeWidth="2" opacity="0.5" />

      {/* Molinos */}
      <Molino x={150} y={520} escala={0.9} />
      <Molino x={268} y={500} escala={0.7} retraso={-1.3} />
      <Molino x={1010} y={500} escala={0.85} retraso={-0.6} />
      <Molino x={1110} y={512} escala={0.65} retraso={-2.1} />

      {/* Carretera hasta la puerta */}
      <path d="M520 900 C 560 820, 590 760, 588 704 L612 704 C 614 760, 650 820, 700 900 Z" fill={`url(#${id}-carretera)`} />
      <path d="M610 900 C 606 830, 600 760, 600 708" stroke="#f5e9c8" strokeWidth="3" strokeDasharray="14 12" fill="none" />
      <path d="M0 790 C 200 770, 400 760, 560 790" stroke="#5a5862" strokeWidth="16" fill="none" opacity="0.8" />

      {/* Árboles */}
      <Cipres x={540} y={760} alto={60} />
      <Cipres x={668} y={760} alto={58} />
      <Cipres x={504} y={830} alto={70} />
      <Cipres x={720} y={840} alto={70} />
      <Arbol x={380} y={690} r={20} />
      <Arbol x={430} y={710} r={15} />
      <Arbol x={80} y={730} r={22} />
      <Arbol x={230} y={760} r={18} />
      <Arbol x={800} y={690} r={18} />
      <Arbol x={1160} y={770} r={22} />
      <Cipres x={330} y={640} alto={40} />
      <Cipres x={350} y={645} alto={34} />
      <Cipres x={860} y={640} alto={38} />
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

/** Pantallas 1 y 2: la ciudad y, al entrar, el edificio en corte. */
export default function Escena({ nombre, resumen, estado, alto, dentroInicial, hayFicha, interior }: Props) {
  const router = useRouter();
  const [dentro, setDentro] = useState(dentroInicial);
  const [escala, setEscala] = useState<number | null>(null);
  const marco = useRef<HTMLDivElement>(null);
  const botonEdificio = useRef<HTMLButtonElement>(null);
  const botonVolver = useRef<HTMLButtonElement>(null);
  const primeraVez = useRef(true);

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

  // Al terminar la animación, el foco pasa al control visible.
  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false;
      return;
    }
    const id = setTimeout(() => (dentro ? botonVolver : botonEdificio).current?.focus({ preventScroll: true }), 900);
    return () => clearTimeout(id);
  }, [dentro]);

  function entrar() {
    setDentro(true);
    window.history.replaceState(null, "", "/?vista=edificio");
  }

  function volver() {
    setDentro(false);
    if (hayFicha) router.replace("/", { scroll: false });
    else window.history.replaceState(null, "", "/");
  }

  const estilo = {
    "--escala": escala ?? 1,
    "--alto": `${alto}px`,
    aspectRatio: `${ANCHO} / ${alto}`,
  } as CSSProperties;

  return (
    <div ref={marco} className="escena" data-dentro={dentro} data-medida={escala !== null} style={estilo}>
      <div className="lienzo">
        {/* Pantalla 1 · la ciudad */}
        <div className="capa-ciudad" inert={dentro}>
          <Paisaje id="ciudad" />
          <Nubes />

          <div className="edificio-ciudad">
            <button
              ref={botonEdificio}
              type="button"
              className="fachada"
              onClick={entrar}
              aria-label={`Entrar al edificio ${nombre}`}
            >
              <span className="fachada-letrero" aria-hidden="true">
                <span className="verde">DEFENSEM</span>
                <span className="rojo">L&apos;EMPORDANET</span>
              </span>
              <span className="fachada-cuerpo" aria-hidden="true">
                {[0, 1, 2].map((p) => (
                  <span key={p} className="fachada-planta">
                    {[0, 1, 2, 3].map((v) => (
                      <span key={v} className={`fachada-ventana${(p + v) % 3 === 0 ? " tenue" : ""}`} />
                    ))}
                  </span>
                ))}
                <span className="fachada-puerta" />
                <span className="fachada-farol izq" />
                <span className="fachada-farol der" />
              </span>
            </button>

            <div className="tarjeta-edificio" role="group" aria-label={`Proyecto ${nombre}`}>
              <p className="tarjeta-nombre">{nombre}</p>
              <p className="tarjeta-dato">{resumen}</p>
              <p className="tarjeta-dato">
                <span className="tarjeta-punto" aria-hidden="true" /> {estado}
              </p>
              <button type="button" className="btn-primary mt-3 w-full" onClick={entrar}>
                Entrar al edificio
              </button>
            </div>
          </div>

          <button type="button" className="solar" disabled title="Próximamente">
            <span aria-hidden="true">+</span> Nuevo proyecto
          </button>
        </div>

        {/* Pantalla 2 · dentro del edificio */}
        <div className="capa-interior" inert={!dentro}>
          <div className="fondo-interior" aria-hidden="true">
            <Paisaje id="fondo" />
          </div>
          <button ref={botonVolver} type="button" className="btn-secondary volver" onClick={volver}>
            ← Volver a la ciudad
          </button>
          {interior}
        </div>
      </div>
    </div>
  );
}
