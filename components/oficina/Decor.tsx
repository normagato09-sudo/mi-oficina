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

/** Archivador metálico de tres cajones. Con "candidaturas", el de arriba abierto y lleno de carpetas de CV. */
export function Archivador({ x, y, candidaturas = false }: Pos & { candidaturas?: boolean }) {
  return (
    <Pieza x={x} y={y} className={`archivador${candidaturas ? " archivador-candidaturas" : ""}`}>
      {candidaturas && (
        <span className="carpetas-cv">
          <span />
          <span />
          <span />
          <span />
        </span>
      )}
      <span className="cajon" />
      <span className="cajon" />
      <span className="cajon" />
    </Pieza>
  );
}

const CARAS = [
  { piel: "#f1c7a1", pelo: "#3b2a20", fondo: "#bfe3c4" },
  { piel: "#a8744f", pelo: "#1c1714", fondo: "#fde68a" },
  { piel: "#e8b894", pelo: "#a0522d", fondo: "#c9dcf5" },
  { piel: "#d9a27a", pelo: "#8a8a8a", fondo: "#f9c6cf" },
  { piel: "#f1c7a1", pelo: "#c9a227", fondo: "#e2d4f5" },
  { piel: "#8d5a3b", pelo: "#1c1714", fondo: "#bfe3c4" },
];

/** Tablón de corcho con las fotos del equipo. */
export function TablonEquipo({ x, y, ancho = 160 }: Pos & { ancho?: number }) {
  return (
    <Pieza x={x} y={y} className="tablon-equipo" style={{ width: ancho }}>
      {CARAS.map((c, i) => (
        <span
          key={i}
          className="foto-equipo"
          style={{ "--piel": c.piel, "--pelo": c.pelo, "--fondo": c.fondo, transform: `rotate(${[-6, 4, -2, 5, -4, 3][i]}deg)` } as CSSProperties}
        />
      ))}
      <span className="titulo-tablon">Nuestro equipo</span>
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

/* ───────── Planta de la oficina ───────── */

/** Alfombra vista desde arriba (bajo la mesa del Director o a lo largo del pasillo). */
export function AlfombraPlanta({ x, y, ancho, alto, tipo = "persa" }: Pos & { ancho: number; alto: number; tipo?: "persa" | "pasillo" | "descanso" }) {
  return <Pieza x={x} y={y} className={`alfombra-planta alfombra-planta-${tipo}`} style={{ width: ancho, height: alto }} />;
}

/** Bandeja de entrada sobre la mesa del Director: un papel por encargo en cola (hasta 12). */
export function Bandeja({ papeles }: { papeles: number }) {
  const n = Math.min(papeles, 12);
  return (
    <span className="bandeja" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          className="papel-bandeja"
          style={{ bottom: 6 + i * 3, transform: `rotate(${[-3, 2, -1, 3, -2, 1][i % 6]}deg)` }}
        />
      ))}
      <span className="borde-bandeja" />
    </span>
  );
}

const BANDERAS = {
  es: { nombre: "España", fondo: "linear-gradient(#aa151b 0 25%, #f1bf00 25% 75%, #aa151b 75%)" },
  ca: { nombre: "Cataluña", fondo: "repeating-linear-gradient(#fcdd09 0 11.1%, #da121a 11.1% 22.2%)" },
  gb: {
    nombre: "Reino Unido",
    fondo: [
      "linear-gradient(90deg, transparent 43%, #c8102e 43% 57%, transparent 57%)",
      "linear-gradient(transparent 40%, #c8102e 40% 60%, transparent 60%)",
      "linear-gradient(90deg, transparent 38%, #fff 38% 62%, transparent 62%)",
      "linear-gradient(transparent 33%, #fff 33% 67%, transparent 67%)",
      "linear-gradient(33.7deg, transparent 46%, #fff 46% 54%, transparent 54%)",
      "linear-gradient(-33.7deg, transparent 46%, #fff 46% 54%, transparent 54%)",
      "#012169",
    ].join(", "),
  },
} as const;

/** Banderita en su mástil, colgada de la pared. */
export function Bandera({ x, y, pais }: Pos & { pais: keyof typeof BANDERAS }) {
  return (
    <Pieza x={x} y={y} className="bandera">
      <span className="mastil" />
      <span className="tela" style={{ background: BANDERAS[pais].fondo }} title={BANDERAS[pais].nombre} />
    </Pieza>
  );
}

/** Globo terráqueo sobre su pie. */
export function GloboTerraqueo({ x, y }: Pos) {
  return (
    <Pieza x={x} y={y} className="globo-terraqueo">
      <span className="esfera" />
      <span className="meridiano" />
      <span className="pie-globo" />
    </Pieza>
  );
}

/** Mesita baja de la zona de descanso, con revistas y una taza. */
export function Mesita({ x, y }: Pos) {
  return (
    <Pieza x={x} y={y} className="mesita">
      <span className="revista" />
      <span className="revista r2" />
    </Pieza>
  );
}

/** Montones de papeles en el suelo (Redacción). */
export function MontonPapeles({ x, y, montones = 2 }: Pos & { montones?: number }) {
  return (
    <Pieza x={x} y={y} className="monton-papeles">
      {Array.from({ length: montones }, (_, i) => (
        <span key={i} className="monton" style={{ height: [46, 30, 38][i % 3], left: i * 16, zIndex: montones - i }} />
      ))}
    </Pieza>
  );
}

/** Armario de servidores con luces que parpadean (Ciberseguridad). */
export function RackServidor({ x, y }: Pos) {
  return (
    <Pieza x={x} y={y} className="rack-servidor">
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} className="bandeja-rack">
          <span className="led" style={{ animationDelay: `${-i * 0.37}s` }} />
          <span className="led l2" style={{ animationDelay: `${-i * 0.61}s` }} />
        </span>
      ))}
    </Pieza>
  );
}

/** Escudo con candado colgado en la pared (Ciberseguridad). */
export function Escudo({ x, y }: Pos) {
  return (
    <Pieza x={x} y={y} className="escudo-pared">
      <span className="candado" />
    </Pieza>
  );
}

/** Carteles colgados en la pared (Diseño). */
export function Carteles({ x, y }: Pos) {
  return (
    <Pieza x={x} y={y} className="carteles-pared">
      <span className="cartel c1" />
      <span className="cartel c2" />
      <span className="cartel c3" />
    </Pieza>
  );
}

/** Tablero de dibujo inclinado sobre su caballete (Diseño). */
export function TableroDibujo({ x, y }: Pos) {
  return (
    <Pieza x={x} y={y} className="tablero-dibujo">
      <span className="tablero" />
      <span className="patas" />
    </Pieza>
  );
}

/** Pizarra blanca con gráficos de barras y una línea (Informes). */
export function PizarraGraficos({ x, y }: Pos) {
  return (
    <Pieza x={x} y={y} className="pizarra-graficos">
      <svg viewBox="0 0 160 90" preserveAspectRatio="none">
        <path d="M10 80 H150 M10 80 V10" stroke="#5b6378" strokeWidth="2" fill="none" />
        <rect x="20" y="52" width="14" height="28" fill="#4c9aff" />
        <rect x="42" y="38" width="14" height="42" fill="#f5b841" />
        <rect x="64" y="46" width="14" height="34" fill="#4c9aff" />
        <rect x="86" y="26" width="14" height="54" fill="#5fd08a" />
        <path d="M108 64 L122 50 L134 56 L148 22" stroke="#e5484d" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="148" cy="22" r="3.5" fill="#e5484d" />
      </svg>
      <span className="repisa" />
    </Pieza>
  );
}
