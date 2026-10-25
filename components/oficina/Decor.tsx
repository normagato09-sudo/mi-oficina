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

export function Estanteria({ x, y, baldas = 2, ancho = 104, trofeos = false }: Pos & { baldas?: number; ancho?: number; trofeos?: boolean }) {
  return (
    <Pieza x={x} y={y} className="estanteria" style={{ width: ancho }}>
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

/** Cuadro enmarcado con el nombre DEFENSEM. */
export function CuadroDefensem({ x, y }: Pos) {
  return (
    <Pieza x={x} y={y} className="cuadro-defensem">
      <span className="marca">DEFENSEM</span>
      <span className="sub">L&apos;EMPORDANET</span>
      <span className="franja" />
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
