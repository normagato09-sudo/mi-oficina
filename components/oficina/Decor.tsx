import type { CSSProperties, ReactNode } from "react";

/** Piezas de decoración del edificio, todas en CSS/SVG. Se colocan en px dentro de cada piso. */

type Pos = { x: number; y: number; className?: string; style?: CSSProperties };

function Pieza({ x, y, className, style, children }: Pos & { children?: ReactNode }) {
  return (
    <span className={className} style={{ left: x, top: y, ...style }} aria-hidden="true">
      {children}
    </span>
  );
}

/* ───────── Pared ───────── */

/** Ventana con el cielo de la hora real de España (lo pinta el CSS según data-cielo). */
export function Ventana({ x, y, ancho = 120, alto = 78, vista = "colinas" }: Pos & { ancho?: number; alto?: number; vista?: "colinas" | "ciudad" }) {
  return (
    <Pieza x={x} y={y} className="ventana" style={{ width: ancho, height: alto }}>
      <span className="cielo">
        <span className="estrellas" />
        <span className="astro" />
        <span className="nube n1" />
        <span className="nube n2" />
        <span className={vista === "ciudad" ? "ciudad" : "colinas-ventana"} />
      </span>
    </Pieza>
  );
}

export function Reloj({ x, y }: Pos) {
  return (
    <Pieza x={x} y={y} className="reloj">
      <span className="aguja h" />
      <span className="aguja m" />
      <span className="aguja s" />
    </Pieza>
  );
}

const LIBROS = [
  ["#c0392b", 30], ["#2f6db5", 34], ["#e0b23a", 26], ["#3c8d5a", 32], ["#8e5aa8", 28], ["#e07b39", 34],
  ["#34495e", 30], ["#d35d6e", 26], ["#1f8a8a", 33], ["#c9a227", 29], ["#298d3b", 31], ["#da1415", 27],
] as const;

/** Estantería de pared. Con "cursos", libros más gruesos con etiqueta, como manuales de curso. */
export function Estanteria({ x, y, baldas = 2, ancho = 104, trofeos = false, cursos = false }: Pos & { baldas?: number; ancho?: number; trofeos?: boolean; cursos?: boolean }) {
  return (
    <Pieza x={x} y={y} className={`estanteria${cursos ? " estanteria-cursos" : ""}`} style={{ width: ancho }}>
      {Array.from({ length: baldas }, (_, b) => (
        <span key={b} className="balda">
          {trofeos && b === 0 ? (
            <>
              <span className="trofeo" />
              <span className="trofeo plata" />
              <span className="marco-foto" />
            </>
          ) : (
            LIBROS.slice((b * 3) % 6, ((b * 3) % 6) + 7).map(([color, alto], i) => (
              <span
                key={i}
                className={`libro${i === 4 ? " tumbado" : ""}`}
                style={{ background: color, height: alto - 6 }}
              />
            ))
          )}
          {!trofeos && b === baldas - 1 && <span className="planta-mini" />}
        </span>
      ))}
    </Pieza>
  );
}

export function Cuadro({ x, y, tipo = "paisaje", ancho = 64, alto = 48 }: Pos & { tipo?: "paisaje" | "abstracto" | "retrato" | "molino"; ancho?: number; alto?: number }) {
  return <Pieza x={x} y={y} className={`cuadro cuadro-${tipo}`} style={{ width: ancho, height: alto }} />;
}

/** Cuadro enmarcado con el nombre del proyecto, en sus colores. */
export function CuadroNombre({ x, y, principal, secundario, color, colorSecundario }: Pos & { principal: string; secundario: string | null; color: string; colorSecundario: string }) {
  return (
    <Pieza x={x} y={y} className="cuadro-nombre">
      <span className="marca" style={{ color }}>
        {principal}
      </span>
      {secundario && (
        <span className="sub" style={{ color: colorSecundario }}>
          {secundario}
        </span>
      )}
      <span className="franja" style={{ background: `linear-gradient(90deg, ${color} 0 50%, ${colorSecundario} 50%)` }} />
    </Pieza>
  );
}

/** Pizarra verde de clase, con tiza. */
export function Pizarra({ x, y, ancho = 150 }: Pos & { ancho?: number }) {
  return (
    <Pieza x={x} y={y} className="pizarra-clase" style={{ width: ancho }}>
      <svg viewBox="0 0 140 80" preserveAspectRatio="none">
        <g fill="none" stroke="#eef3ea" strokeWidth="1.6" strokeLinecap="round" opacity="0.9">
          <path d="M10 14 h44 M10 24 h30" />
          <path d="M10 40 l8 8 l14 -18" />
          <path d="M44 44 h40 M44 54 h28" />
          <circle cx="112" cy="26" r="14" />
          <path d="M104 26 h16 M112 18 v16" />
          <path d="M92 62 q12 -10 30 0" />
        </g>
      </svg>
      <span className="repisa" />
    </Pieza>
  );
}

/** Calendario de pared con días marcados. */
export function Calendario({ x, y }: Pos) {
  return (
    <Pieza x={x} y={y} className="calendario">
      <span className="anillas" />
      <span className="mes" />
      <span className="dias" />
    </Pieza>
  );
}

/** Archivador metálico de tres cajones. */
export function Archivador({ x, y }: Pos) {
  return (
    <Pieza x={x} y={y} className="archivador">
      <span className="cajon" />
      <span className="cajon" />
      <span className="cajon" />
    </Pieza>
  );
}

/** Micrófono de doblaje: pie alto, araña y filtro antipop. */
export function MicroDoblaje({ x, y }: Pos) {
  return (
    <Pieza x={x} y={y} className="micro-doblaje">
      <span className="antipop" />
      <span className="capsula" />
      <span className="pie-micro" />
    </Pieza>
  );
}

/** Panel de espuma acústica en la pared. */
export function PanelAcustico({ x, y, ancho = 360 }: Pos & { ancho?: number }) {
  return <Pieza x={x} y={y} className="panel-acustico" style={{ width: ancho }} />;
}

/** Cartel luminoso (se enciende cuando alguien de la sala trabaja). */
export function Rotulo({ x, y, texto }: Pos & { texto: string }) {
  return (
    <Pieza x={x} y={y} className="rotulo">
      {texto}
    </Pieza>
  );
}

/* ───────── Suelo ───────── */

export function Planta({ x, y, tipo = "frondosa" }: Pos & { tipo?: "frondosa" | "cactus" | "sanseviera" | "ficus" }) {
  return (
    <Pieza x={x} y={y} className={`planta planta-${tipo}`}>
      {tipo === "cactus" ? (
        <>
          <span className="tallo" />
          <span className="brazo-cactus izq" />
          <span className="brazo-cactus der" />
          <span className="flor" />
        </>
      ) : (
        Array.from({ length: tipo === "ficus" ? 7 : 5 }, (_, i) => <span key={i} className="hoja" />)
      )}
      <span className="maceta" />
    </Pieza>
  );
}

export function Papelera({ x, y }: Pos) {
  return (
    <Pieza x={x} y={y} className="papelera">
      <span className="bola" />
    </Pieza>
  );
}

/** Lámpara de pie, vista de lado, con su charco de luz. */
export function Lampara({ x, y }: Pos) {
  return (
    <Pieza x={x} y={y} className="lampara">
      <span className="halo" />
      <span className="pantalla-lampara" />
      <span className="pie" />
    </Pieza>
  );
}

/** Lámpara colgante del techo. */
export function LamparaColgante({ x, cable = 40 }: { x: number; cable?: number }) {
  return (
    <Pieza x={x} y={0} className="lampara-colgante" style={{ "--cable": `${cable}px` } as CSSProperties}>
      <span className="cable" />
      <span className="campana" />
      <span className="halo" />
    </Pieza>
  );
}

export function Cafetera({ x, y }: Pos) {
  return (
    <Pieza x={x} y={y} className="encimera">
      <span className="cafetera">
        <span className="piloto" />
        <span className="vaso" />
        <span className="vapor" />
        <span className="vapor v2" />
      </span>
      <span className="tazas" />
    </Pieza>
  );
}

export function Sofa({ x, y, color = "#4f6db8" }: Pos & { color?: string }) {
  return (
    <Pieza x={x} y={y} className="sofa" style={{ "--sofa": color } as CSSProperties}>
      <span className="respaldo" />
      <span className="cojin c1" />
      <span className="cojin c2" />
      <span className="cojin-deco" />
    </Pieza>
  );
}

export function Alfombra({ x, y, ancho, tipo = "persa" }: Pos & { ancho: number; tipo?: "persa" | "rayas" | "verde" }) {
  return <Pieza x={x} y={y} className={`alfombra alfombra-${tipo}`} style={{ width: ancho }} />;
}

/** Puerta de entrada en arco, de dos hojas acristaladas. */
export function PuertaEntrada({ x, y }: Pos) {
  return (
    <Pieza x={x} y={y} className="puerta-entrada">
      <span className="hoja-puerta izq" />
      <span className="hoja-puerta der" />
      <span className="felpudo" />
    </Pieza>
  );
}
