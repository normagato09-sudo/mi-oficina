import { P } from "./dibujos/comun";
import type { TipoSuelo } from "./dibujos/suelo";

/**
 * El edificio, planta a planta, en casillas de 32 px. Solo datos (sin Phaser).
 * Todas las plantas miden lo mismo y tienen el ascensor y la escalera en el mismo sitio (arriba a la izquierda):
 *
 *   ┌─ascensor─escalera─┬──────── ventanales ────────┬─ despacho del jefe ─┐
 *   │  núcleo           │   mesas de trabajo          │   (cristal)          │
 *   │                   │                             ├─ sala de reuniones ──┤
 *   ├─ zona común ──────┤                             │   (cristal)          │
 *   └───────────────────┴─────────────────────────────┴──────────────────────┘
 */

export const ANCHO = 40;
export const ALTO = 26;
/** Filas del muro de arriba (con los ventanales). */
export const MURO_ARRIBA = 2;

/** Ascensor (en el muro de arriba) y escalera. */
export const ASCENSOR = { x: 2, ancho: 2 };
export const ESCALERA = { x: 6, y: 2, ancho: 3, alto: 3 };
/** Donde aparezco al llegar a una planta: delante del ascensor. */
export const LLEGADA = { x: 3, y: 3 };
/** Puntos para usar el ascensor o la escalera (casillas, pueden ser fraccionarias). */
export const PUNTOS_ASCENSOR = [
  { x: 3, y: 2.6 },
  { x: 7.5, y: 5.6 },
];

export type Rect = { x1: number; y1: number; x2: number; y2: number };
export type Zona = Rect & { suelo: TipoSuelo; color: string };
export type Mira = "abajo" | "arriba";

export type Mueble =
  /** Mesa de trabajo de 2 casillas que no es de nadie (las de los puestos se ponen solas). */
  | { tipo: "escritorio"; x: number; y: number; madera?: boolean; monitores?: 1 | 2; extra?: "taza" | "papeles" | "planta" | "nada" }
  | { tipo: "mesaReunion"; x: number; y: number; casillas: number }
  | { tipo: "mesaDireccion"; x: number; y: number }
  | { tipo: "sillon"; x: number; y: number }
  | { tipo: "sofa"; x: number; y: number; casillas: number; color: string; mira: Mira }
  | { tipo: "estanteria"; x: number; y: number; casillas: number }
  | { tipo: "planta"; x: number; y: number; alta?: boolean }
  | { tipo: "encimeraCafe"; x: number; y: number; casillas: number }
  | { tipo: "impresora"; x: number; y: number }
  | { tipo: "mostrador"; x: number; y: number; casillas: number }
  | { tipo: "mesaRedonda"; x: number; y: number }
  | { tipo: "taburete"; x: number; y: number; color?: string }
  | { tipo: "mesita"; x: number; y: number };

/** Puesto de trabajo: la silla en (x, y) y la mesa de 2 casillas delante (x…x+1, y+1). */
export type Puesto = { x: number; y: number; madera?: boolean; sinMesa?: boolean };
/** Asiento de la mesa de reunión: casilla de la silla y hacia dónde mira quien se sienta. */
export type Asiento = { x: number; y: number; mira: Mira };

export type Planta = {
  n: number;
  zonas: Zona[];
  alfombras: (Rect & { color: string })[];
  /** Paredes de cristal (en casillas, inclusive). Las puertas son huecos entre tramos. */
  cristalesH: { y: number; x1: number; x2: number }[];
  cristalesV: { x: number; y1: number; y2: number }[];
  muebles: Mueble[];
  /** Mesas de trabajo en orden: el primer agente de la planta va a la primera, etc. */
  puestos: Puesto[];
  /** Despacho del jefe de la planta (en Dirección, el del Director). */
  jefe?: Puesto;
  reunion: Asiento[];
  /** Nombres pintados en el suelo. */
  rotulos: { texto: string; x: number; y: number }[];
  /** Mi sillón (solo en Dirección). */
  sillon?: { x: number; y: number };
  logo?: number;
};

/* ───────────── Piezas comunes ───────────── */

const COLOR_MOQUETA: Record<number, string> = {
  0: "#d9d1c3",
  1: "#7f8f7c",
  2: "#6f8199",
  3: "#9c8088",
  4: "#7d7066",
};

function nucleo(): Zona {
  return { x1: 1, y1: MURO_ARRIBA, x2: 9, y2: 5, suelo: "baldosa", color: "#cfc8bb" };
}

/** Zona común abajo a la izquierda: café, impresora, sofá, mesita y plantas. */
function zonaComun(): Mueble[] {
  return [
    { tipo: "encimeraCafe", x: 1, y: 15, casillas: 4 },
    { tipo: "impresora", x: 7, y: 15 },
    { tipo: "planta", x: 9, y: 15, alta: true },
    { tipo: "sofa", x: 2, y: 20, casillas: 3, color: "#c98d5b", mira: "abajo" },
    { tipo: "mesita", x: 3, y: 22 },
    { tipo: "planta", x: 1, y: 22 },
    { tipo: "planta", x: 8, y: 22 },
  ];
}

/** Mesas de trabajo en filas, de 2 casillas y con pasillos entre ellas. */
function mesasEnFilas(filas: number[], columnas: number[]): Puesto[] {
  return filas.flatMap((y) => columnas.map((x) => ({ x, y })));
}

/** Asientos alrededor de una mesa de reunión de `casillas` × 2 en (x, y). */
function asientosMesa(x: number, y: number, casillas: number): Asiento[] {
  const arriba = Array.from({ length: casillas }, (_, i) => ({ x: x + i, y: y - 1, mira: "abajo" as const }));
  const abajo = Array.from({ length: casillas }, (_, i) => ({ x: x + i, y: y + 2, mira: "arriba" as const }));
  // Primero los de arriba (de cara), del centro hacia fuera.
  const centro = (a: Asiento) => Math.abs(a.x - (x + (casillas - 1) / 2));
  return [...arriba.sort((a, b) => centro(a) - centro(b)), ...abajo.sort((a, b) => centro(a) - centro(b))];
}

/** Planta de departamento (1, 2 y 3): mesas en filas, despacho del jefe y sala de reuniones acristalados. */
function plantaDepartamento(n: number, nombre: string): Planta {
  const moqueta = COLOR_MOQUETA[n]!;
  return {
    n,
    zonas: [
      { x1: 1, y1: MURO_ARRIBA, x2: ANCHO - 2, y2: ALTO - 2, suelo: "moqueta", color: moqueta },
      nucleo(),
      { x1: 30, y1: MURO_ARRIBA, x2: 38, y2: 8, suelo: "madera", color: P.maderaClara },
    ],
    alfombras: [{ x1: 2, y1: 19, x2: 6, y2: 23, color: "#b9a88f" }],
    cristalesV: [
      { x: 29, y1: MURO_ARRIBA, y2: 9 },
      { x: 29, y1: 12, y2: 16 },
      { x: 29, y1: 19, y2: ALTO - 2 },
    ],
    cristalesH: [
      { y: 9, x1: 29, x2: 32 },
      { y: 9, x1: 35, x2: 38 },
      { y: 12, x1: 29, x2: 38 },
    ],
    muebles: [
      ...zonaComun(),
      { tipo: "estanteria", x: 11, y: 2, casillas: 2 },
      { tipo: "estanteria", x: 25, y: 2, casillas: 2 },
      { tipo: "planta", x: 27, y: 2, alta: true },
      { tipo: "planta", x: 10, y: 6 },
      { tipo: "planta", x: 27, y: 24 },
      // Despacho del jefe.
      { tipo: "estanteria", x: 36, y: 2, casillas: 2 },
      { tipo: "planta", x: 30, y: 8 },
      { tipo: "planta", x: 38, y: 8, alta: true },
      // Sala de reuniones.
      { tipo: "mesaReunion", x: 32, y: 17, casillas: 5 },
      { tipo: "planta", x: 38, y: 13 },
      { tipo: "planta", x: 38, y: 24, alta: true },
      { tipo: "planta", x: 30, y: 24 },
    ],
    puestos: mesasEnFilas([7, 12, 17], [12, 16, 20, 24]),
    jefe: { x: 33, y: 4, madera: true },
    reunion: asientosMesa(32, 17, 5),
    rotulos: [
      { texto: `PLANTA ${n} · ${nombre.toUpperCase()}`, x: 5, y: 7.2 },
      { texto: "JEFATURA", x: 34, y: 8.5 },
      { texto: "SALA DE REUNIONES", x: 34, y: 24.4 },
    ],
  };
}

/* ───────────── Las cinco plantas ───────────── */

const recepcion: Planta = {
  n: 0,
  zonas: [
    { x1: 1, y1: MURO_ARRIBA, x2: ANCHO - 2, y2: ALTO - 2, suelo: "marmol", color: COLOR_MOQUETA[0]! },
    nucleo(),
    { x1: 27, y1: MURO_ARRIBA, x2: 38, y2: 12, suelo: "madera", color: P.maderaClara },
  ],
  alfombras: [
    { x1: 17, y1: 21, x2: 22, y2: 24, color: "#8a3b3b" },
    { x1: 3, y1: 15, x2: 8, y2: 22, color: "#5b6a8f" },
  ],
  cristalesH: [],
  cristalesV: [],
  muebles: [
    { tipo: "mostrador", x: 16, y: 13, casillas: 8 },
    { tipo: "planta", x: 14, y: 14, alta: true },
    { tipo: "planta", x: 25, y: 14, alta: true },
    // Sofás de espera.
    { tipo: "sofa", x: 4, y: 16, casillas: 3, color: "#5b6a8f", mira: "abajo" },
    { tipo: "mesita", x: 4, y: 18 },
    { tipo: "sofa", x: 4, y: 21, casillas: 3, color: "#5b6a8f", mira: "arriba" },
    { tipo: "planta", x: 2, y: 16 },
    { tipo: "planta", x: 8, y: 21 },
    // Cafetería.
    { tipo: "encimeraCafe", x: 29, y: 3, casillas: 5 },
    { tipo: "planta", x: 35, y: 3, alta: true },
    ...[
      [29, 7],
      [33, 7],
      [37, 7],
      [31, 10],
      [35, 10],
    ].flatMap(([x, y]) => [
      { tipo: "mesaRedonda" as const, x: x!, y: y! },
      { tipo: "taburete" as const, x: x! - 1, y: y!, color: "#e07b39" },
      { tipo: "taburete" as const, x: x! + 1, y: y!, color: "#4f9a5a" },
    ]),
    { tipo: "planta", x: 11, y: 2 },
    { tipo: "planta", x: 26, y: 2 },
    { tipo: "planta", x: 1, y: 24, alta: true },
    { tipo: "planta", x: 38, y: 24, alta: true },
  ],
  puestos: [
    { x: 17, y: 12, sinMesa: true },
    { x: 21, y: 12, sinMesa: true },
  ],
  reunion: [],
  rotulos: [
    { texto: "PLANTA 0 · RECEPCIÓN", x: 5, y: 7.2 },
    { texto: "RECEPCIÓN", x: 20, y: 16.2 },
    { texto: "CAFETERÍA", x: 33, y: 12.4 },
    { texto: "ENTRADA", x: 20, y: 24.4 },
  ],
  logo: 20,
};

const direccion: Planta = {
  n: 4,
  zonas: [
    { x1: 1, y1: MURO_ARRIBA, x2: ANCHO - 2, y2: ALTO - 2, suelo: "moqueta", color: COLOR_MOQUETA[4]! },
    nucleo(),
    { x1: 22, y1: MURO_ARRIBA, x2: 38, y2: 13, suelo: "madera", color: P.madera },
    { x1: 12, y1: MURO_ARRIBA, x2: 20, y2: 9, suelo: "madera", color: P.maderaClara },
  ],
  alfombras: [
    { x1: 26, y1: 3, x2: 32, y2: 8, color: "#6d4f6e" },
    { x1: 32, y1: 9, x2: 37, y2: 12, color: "#3f5f86" },
  ],
  cristalesV: [
    // Mi despacho y la sala de reuniones; la puerta de mi despacho al pasillo, en 11-12.
    { x: 21, y1: MURO_ARRIBA, y2: 10 },
    { x: 21, y1: 13, y2: ALTO - 2 },
    { x: 11, y1: MURO_ARRIBA, y2: 10 },
    { x: 11, y1: 14, y2: ALTO - 2 },
  ],
  cristalesH: [
    // Mi despacho (puerta en 29-30).
    { y: 14, x1: 22, x2: 28 },
    { y: 14, x1: 31, x2: 38 },
    // Despacho del Director (puerta en 15-16).
    { y: 10, x1: 11, x2: 14 },
    { y: 10, x1: 17, x2: 20 },
    // Sala de reuniones de dirección (puerta en 15-16).
    { y: 14, x1: 11, x2: 14 },
    { y: 14, x1: 17, x2: 20 },
  ],
  muebles: [
    ...zonaComun(),
    // Mi despacho: mesa de dirección, sillón, estanterías, sofá, mesita y plantas.
    { tipo: "mesaDireccion", x: 28, y: 5 },
    { tipo: "sillon", x: 29, y: 4 },
    { tipo: "estanteria", x: 22, y: 2, casillas: 3 },
    { tipo: "estanteria", x: 36, y: 2, casillas: 3 },
    { tipo: "sofa", x: 33, y: 12, casillas: 3, color: "#8a5a44", mira: "arriba" },
    { tipo: "mesita", x: 33, y: 10 },
    { tipo: "planta", x: 22, y: 13, alta: true },
    { tipo: "planta", x: 38, y: 13 },
    { tipo: "planta", x: 25, y: 2 },
    // Despacho del Director.
    { tipo: "estanteria", x: 18, y: 2, casillas: 2 },
    { tipo: "planta", x: 12, y: 9 },
    { tipo: "planta", x: 20, y: 9, alta: true },
    // Sala de reuniones.
    { tipo: "mesaReunion", x: 14, y: 19, casillas: 5 },
    { tipo: "planta", x: 12, y: 24 },
    { tipo: "planta", x: 20, y: 15, alta: true },
  ],
  puestos: [
    { x: 2, y: 8 },
    { x: 6, y: 8 },
  ],
  jefe: { x: 15, y: 4, madera: true },
  reunion: asientosMesa(14, 19, 5),
  rotulos: [
    { texto: "PLANTA 4 · DIRECCIÓN", x: 5, y: 7.2 },
    { texto: "MI DESPACHO", x: 30, y: 13.4 },
    { texto: "DIRECCIÓN", x: 16, y: 9.4 },
    { texto: "SALA DE REUNIONES", x: 16, y: 24.4 },
  ],
  sillon: { x: 29, y: 4 },
};

export const EDIFICIO: Planta[] = [
  recepcion,
  plantaDepartamento(1, "Administración"),
  plantaDepartamento(2, "Tecnología"),
  plantaDepartamento(3, "Comunicación"),
  direccion,
];

export function planta(n: number): Planta {
  return EDIFICIO.find((p) => p.n === n) ?? EDIFICIO[0]!;
}

/** Casillas que ocupa un mueble (para los choques). */
export function huella(m: Mueble): Rect {
  const r = (ancho: number, alto: number) => ({ x1: m.x, y1: m.y, x2: m.x + ancho - 1, y2: m.y + alto - 1 });
  switch (m.tipo) {
    case "escritorio":
      return r(2, 1);
    case "mesaReunion":
      return r(m.casillas, 2);
    case "mesaDireccion":
      return r(3, 2);
    case "sofa":
    case "estanteria":
    case "encimeraCafe":
      return r(m.casillas, 1);
    case "mostrador":
      return r(m.casillas, 2);
    case "mesita":
      return r(2, 1);
    default:
      return r(1, 1);
  }
}
