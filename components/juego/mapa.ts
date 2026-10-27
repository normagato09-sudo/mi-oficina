import type { Despacho } from "@/lib/tipos";

/**
 * Plano de la oficina del juego, en casillas de 16 px. Solo datos (sin Phaser):
 *
 *   ┌──────── CEO ────────┬─Director─┬── Redes ─┬──── Traducción ────┐
 *   │                     │          │          │                    │
 *   ├─ Secretaría ┐  ╔══════════ pasillo ══════════╗  ┌─ Redacción ──┤
 *   │             │  ║   jardín · fuente · jardín ║  │              │
 *   ├─ Informes ──┘  ╚════════════════════════════╝  └─ Diseño ─────┤
 *   ├── Ciberseguridad ───┬──── Descanso ──────┬── Programación ────┤
 *   └─────────────────────┴────────────────────┴────────────────────┘
 */

export const T = 16;
export const ANCHO = 58;
export const ALTO = 46;

export type IdSala = "ceo" | Despacho | "descanso";

export type Suelo = "madera" | "moqueta" | "baldosa" | "pasillo" | "cesped" | "camino";

export type Sala = {
  id: IdSala;
  nombre: string;
  /** Interior (casillas, inclusive). */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  suelo: Suelo;
  /** Color del suelo (moqueta) o de la madera. */
  color: string;
  /** Puerta: casillas del muro que se abren al pasillo. */
  puerta: { x: number; y: number }[];
};

export const SALAS: Sala[] = [
  { id: "ceo", nombre: "Mi despacho", x1: 1, y1: 1, x2: 20, y2: 11, suelo: "madera", color: "#b98a5a", puerta: [{ x: 17, y: 12 }, { x: 18, y: 12 }] },
  { id: "direccion", nombre: "Dirección", x1: 22, y1: 1, x2: 30, y2: 11, suelo: "moqueta", color: "#5b6a8f", puerta: [{ x: 26, y: 12 }, { x: 27, y: 12 }] },
  { id: "redes", nombre: "Redes sociales", x1: 32, y1: 1, x2: 40, y2: 11, suelo: "moqueta", color: "#b5657f", puerta: [{ x: 36, y: 12 }, { x: 37, y: 12 }] },
  { id: "traduccion", nombre: "Traducción", x1: 42, y1: 1, x2: 56, y2: 11, suelo: "moqueta", color: "#4f8f8a", puerta: [{ x: 43, y: 12 }, { x: 44, y: 12 }] },
  { id: "secretaria", nombre: "Secretaría", x1: 1, y1: 13, x2: 11, y2: 21, suelo: "moqueta", color: "#86689c", puerta: [{ x: 12, y: 17 }, { x: 12, y: 18 }] },
  { id: "informes", nombre: "Informes", x1: 1, y1: 23, x2: 11, y2: 32, suelo: "moqueta", color: "#5f8a5e", puerta: [{ x: 12, y: 27 }, { x: 12, y: 28 }] },
  { id: "redaccion", nombre: "Redacción", x1: 46, y1: 13, x2: 56, y2: 21, suelo: "madera", color: "#a7804f", puerta: [{ x: 45, y: 17 }, { x: 45, y: 18 }] },
  { id: "diseno", nombre: "Diseño", x1: 46, y1: 23, x2: 56, y2: 32, suelo: "moqueta", color: "#c07a48", puerta: [{ x: 45, y: 27 }, { x: 45, y: 28 }] },
  { id: "ciberseguridad", nombre: "Ciberseguridad", x1: 1, y1: 34, x2: 20, y2: 44, suelo: "moqueta", color: "#39465a", puerta: [{ x: 17, y: 33 }, { x: 18, y: 33 }] },
  { id: "descanso", nombre: "Descanso", x1: 22, y1: 34, x2: 40, y2: 44, suelo: "baldosa", color: "#d9cfbd", puerta: [{ x: 30, y: 33 }, { x: 31, y: 33 }] },
  { id: "programacion", nombre: "Programación", x1: 42, y1: 34, x2: 56, y2: 44, suelo: "moqueta", color: "#3f5f86", puerta: [{ x: 43, y: 33 }, { x: 44, y: 33 }] },
];

/** Pasillo (anillo alrededor del patio) y patio (jardín con fuente). */
export const PASILLO = { x1: 13, y1: 13, x2: 44, y2: 32 };
export const PATIO = { x1: 16, y1: 16, x2: 41, y2: 29 };
/** Fuente en el centro del patio (casillas). */
export const FUENTE = { x: 27, y: 21, ancho: 4, alto: 4 };

/* ───────────── Muebles y objetos ───────────── */

/** Casillas de la hoja de Kenney (Roguelike Indoor, CC0): 27 columnas, 16 px y 1 px de separación. */
export const K = {
  mesa: [
    [0, 1, 2],
    [27, 28, 29],
  ],
  sillaOficina: 216,
  plantas: [16, 17],
  estanteria: [478, 479, 480],
  armario: [324, 325, 326, 327],
  armarioBotellas: [329, 330],
  sofaNaranja: [170, 171],
  sofaVerde: [197, 198],
  sofaCrema: [174, 175],
  alfombraNaranja: [
    [243, 244, 245],
    [270, 271, 272],
  ],
  alfombraVerde: [
    [250, 251, 252],
    [277, 278, 279],
  ],
  mesaRedonda: [60],
  cuadros: [340, 341, 342, 343, 451, 452, 453],
  taquillas: [
    [446, 447],
    [473, 474],
  ],
} as const;

/** Objetos dibujados por el juego (ver dibujos.ts). */
export type Prop =
  | "portatil"
  | "monitores"
  | "maquinaEscribir"
  | "papeles"
  | "caballete"
  | "pizarra"
  | "calendario"
  | "banderas"
  | "globo"
  | "escudo"
  | "leds"
  | "cafetera"
  | "fuenteAgua"
  | "arbol"
  | "arbusto"
  | "flores"
  | "telefono"
  | "anilloLuz"
  | "archivador"
  | "ordenadorCeo";

export type Objeto =
  /** Una casilla de Kenney. */
  | { k: number; x: number; y: number; solido?: boolean; encima?: boolean }
  /** Un objeto dibujado por el juego (posición en casillas, puede ser fraccionaria). */
  | { prop: Prop; x: number; y: number; solido?: { ancho: number; alto: number }; encima?: boolean };

function mesa(cx: number, y: number): Objeto[] {
  const o: Objeto[] = [];
  K.mesa.forEach((fila, f) => fila.forEach((k, c) => o.push({ k, x: cx - 1 + c, y: y + f, solido: true })));
  return o;
}
function filaK(frames: readonly number[], x: number, y: number, solido = true): Objeto[] {
  return frames.map((k, i) => ({ k, x: x + i, y, solido }));
}
function bloqueK(frames: readonly (readonly number[])[], x: number, y: number, solido = false): Objeto[] {
  return frames.flatMap((fila, f) => fila.map((k, c) => ({ k, x: x + c, y: y + f, solido })));
}

/** Puesto de un agente: silla (donde se sienta), mesa delante y su ordenador. */
export type Puesto = { agenteId: string; despacho: Despacho; x: number; y: number };

function centroX(s: Sala) {
  return Math.floor((s.x1 + s.x2) / 2);
}
const sala = (id: IdSala) => SALAS.find((s) => s.id === id)!;

/** Dónde se sienta cada agente (casilla de su silla): centrados en su despacho, 4 casillas entre mesas. */
export function puestos(todos: { id: string; despacho: Despacho }[]): Puesto[] {
  // Los jefes de planta no tienen sala en este plano.
  const agentes = todos.filter((a) => a.despacho !== "jefatura") as { id: string; despacho: Exclude<Despacho, "jefatura"> }[];
  return agentes.map((a) => {
    const s = sala(a.despacho);
    const suyos = agentes.filter((b) => b.despacho === a.despacho);
    const i = suyos.indexOf(a);
    return { agenteId: a.id, despacho: a.despacho, x: centroX(s) + Math.round((i - (suyos.length - 1) / 2) * 4), y: s.y1 + 3 };
  });
}
/** Mi silla: al abrir la oficina aparezco sentada aquí. */
export const SILLA_CEO = { x: 9, y: 4 };

/** Lo que va encima de la mesa de cada agente. */
const MESA: Record<Despacho, (x: number, y: number) => Objeto[]> = {
  programacion: (x, y) => [{ prop: "monitores", x, y, encima: true }],
  ciberseguridad: (x, y) => [{ prop: "portatil", x, y, encima: true }],
  redaccion: (x, y) => [{ prop: "maquinaEscribir", x, y, encima: true }],
  diseno: (x, y) => [{ prop: "portatil", x, y, encima: true }],
  informes: (x, y) => [{ prop: "portatil", x, y, encima: true }],
  secretaria: (x, y) => [{ prop: "portatil", x, y, encima: true }],
  traduccion: (x, y) => [{ prop: "portatil", x, y, encima: true }],
  redes: (x, y) => [{ prop: "telefono", x, y, encima: true }],
  direccion: (x, y) => [{ prop: "papeles", x: x + 1, y, encima: true }, { prop: "portatil", x: x - 0.4, y, encima: true }],
  jefatura: (x, y) => [{ prop: "portatil", x, y, encima: true }],
};

/** Todo lo que hay en cada sala, con una mesa por puesto. */
export function objetos(lista: Puesto[]): Objeto[] {
  const o: Objeto[] = [];

  // Mi despacho: mesa grande con ordenador, silla, estantería, sofá, alfombra, plantas y cuadros.
  o.push(...mesa(SILLA_CEO.x, SILLA_CEO.y + 1), { k: K.sillaOficina, x: SILLA_CEO.x, y: SILLA_CEO.y });
  o.push({ prop: "ordenadorCeo", x: SILLA_CEO.x, y: SILLA_CEO.y + 1, encima: true });
  o.push(...filaK(K.estanteria, 2, 1), ...filaK(K.estanteria, 5, 1));
  o.push(...bloqueK(K.alfombraNaranja, 14, 6), ...filaK(K.sofaNaranja, 14, 9), { k: K.mesaRedonda[0], x: 15, y: 7, solido: true });
  o.push({ k: K.plantas[0], x: 1, y: 11, solido: true }, { k: K.plantas[1], x: 20, y: 1, solido: true }, { k: K.plantas[0], x: 20, y: 11, solido: true });
  o.push({ k: K.cuadros[4], x: 12, y: 1 }, { k: K.cuadros[5], x: 16, y: 1 });

  // Agentes: mesa, silla y lo que tienen encima.
  for (const p of lista) o.push(...mesa(p.x, p.y + 1), { k: K.sillaOficina, x: p.x, y: p.y }, ...MESA[p.despacho](p.x, p.y + 1));

  // La decoración de cada despacho, según su agente.
  for (const s of SALAS) {
    const derecha = s.x2 - 1;
    switch (s.id) {
      case "programacion":
        o.push({ k: K.plantas[1], x: s.x1, y: s.y2, solido: true }, ...filaK(K.armario.slice(0, 2), derecha - 1, s.y1));
        break;
      case "ciberseguridad":
        o.push(...bloqueK(K.taquillas, s.x1, s.y1, true), ...bloqueK(K.taquillas, s.x1 + 2, s.y1, true));
        o.push({ prop: "leds", x: s.x1, y: s.y1, encima: true }, { prop: "leds", x: s.x1 + 2, y: s.y1, encima: true });
        o.push({ prop: "escudo", x: derecha - 2, y: s.y1 });
        break;
      case "redaccion":
        o.push({ prop: "papeles", x: s.x1, y: s.y2, solido: { ancho: 1, alto: 1 } }, { prop: "papeles", x: derecha, y: s.y2 - 1, solido: { ancho: 1, alto: 1 } });
        o.push(...filaK(K.estanteria, derecha - 2, s.y1));
        break;
      case "diseno":
        o.push({ prop: "caballete", x: derecha - 1, y: s.y2 - 2, solido: { ancho: 1, alto: 2 } });
        o.push({ k: K.cuadros[0], x: s.x1, y: s.y1 }, { k: K.cuadros[1], x: s.x1 + 1, y: s.y1 }, { k: K.cuadros[2], x: s.x1 + 2, y: s.y1 });
        o.push({ k: K.plantas[0], x: s.x1, y: s.y2, solido: true });
        break;
      case "informes":
        o.push({ prop: "pizarra", x: s.x1 + 1, y: s.y1 });
        o.push(...filaK(K.armario.slice(2), derecha - 1, s.y1), { k: K.plantas[1], x: s.x1, y: s.y2, solido: true });
        break;
      case "secretaria":
        o.push({ prop: "calendario", x: s.x1 + 1, y: s.y1 }, { prop: "archivador", x: derecha, y: s.y1, solido: { ancho: 1, alto: 1 } });
        o.push(...filaK(K.armario.slice(0, 2), s.x1, s.y2), { k: K.plantas[0], x: derecha, y: s.y2, solido: true });
        break;
      case "traduccion":
        o.push({ prop: "banderas", x: s.x1 + 1, y: s.y1 }, { prop: "globo", x: derecha, y: s.y2, solido: { ancho: 1, alto: 1 } });
        o.push(...filaK(K.estanteria, derecha - 3, s.y1), { k: K.plantas[1], x: s.x1, y: s.y2, solido: true });
        break;
      case "redes":
        o.push({ prop: "anilloLuz", x: derecha, y: s.y1 + 1, solido: { ancho: 1, alto: 1 } }, { k: K.cuadros[6], x: s.x1, y: s.y1 });
        o.push({ k: K.plantas[0], x: s.x1, y: s.y2, solido: true }, { k: K.plantas[1], x: derecha, y: s.y2, solido: true });
        break;
      case "direccion":
        o.push(...filaK(K.armarioBotellas, s.x1, s.y1), { k: K.cuadros[3], x: derecha - 1, y: s.y1 }, { k: K.plantas[0], x: derecha, y: s.y2, solido: true });
        break;
    }
  }

  // Sala de descanso: sofás, alfombra, mesa baja, cocina con cafetera y fuente de agua.
  const d = sala("descanso");
  o.push(...bloqueK(K.alfombraVerde, d.x1 + 3, d.y1 + 4), ...filaK(K.sofaVerde, d.x1 + 3, d.y1 + 3), ...filaK(K.sofaCrema, d.x1 + 3, d.y1 + 7));
  o.push({ k: K.mesaRedonda[0], x: d.x1 + 4, y: d.y1 + 5, solido: true });
  o.push(...filaK(K.armario, d.x2 - 6, d.y1), ...filaK(K.armarioBotellas, d.x2 - 2, d.y1));
  o.push({ prop: "cafetera", x: d.x2 - 5, y: d.y1, encima: true }, { prop: "fuenteAgua", x: d.x2, y: d.y1, solido: { ancho: 1, alto: 1 } });
  o.push({ k: K.plantas[0], x: d.x1, y: d.y2, solido: true }, { k: K.plantas[1], x: d.x2, y: d.y2, solido: true });

  // Patio: árboles en las esquinas, arbustos y flores.
  const P = PATIO;
  for (const [x, y] of [
    [P.x1 + 1, P.y1 + 1],
    [P.x2 - 2, P.y1 + 1],
    [P.x1 + 1, P.y2 - 2],
    [P.x2 - 2, P.y2 - 2],
  ]) {
    o.push({ prop: "arbol", x: x!, y: y!, solido: { ancho: 2, alto: 2 } });
  }
  for (const [x, y] of [
    [P.x1 + 6, P.y1 + 2],
    [P.x2 - 7, P.y1 + 2],
    [P.x1 + 6, P.y2 - 2],
    [P.x2 - 7, P.y2 - 2],
    [P.x1 + 2, P.y1 + 6],
    [P.x2 - 3, P.y2 - 7],
  ]) {
    o.push({ prop: "arbusto", x: x!, y: y!, solido: { ancho: 1, alto: 1 } });
  }
  for (const [x, y] of [
    [P.x1 + 9, P.y1 + 4],
    [P.x2 - 10, P.y1 + 4],
    [P.x1 + 9, P.y2 - 4],
    [P.x2 - 10, P.y2 - 4],
    [P.x1 + 4, P.y1 + 10],
    [P.x2 - 5, P.y1 + 3],
  ]) {
    o.push({ prop: "flores", x: x!, y: y! });
  }
  return o;
}

/* ───────────── Suelos y muros ───────────── */

export type Casilla = { suelo: Suelo | null; color: string; sala: IdSala | "pasillo" | "patio" | null };

/** El plano casilla a casilla: null = muro. */
export function plano(): Casilla[][] {
  const g: Casilla[][] = Array.from({ length: ALTO }, () => Array.from({ length: ANCHO }, () => ({ suelo: null, color: "", sala: null })));
  const pintar = (x1: number, y1: number, x2: number, y2: number, c: Casilla) => {
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) g[y]![x] = { ...c };
  };
  for (const s of SALAS) {
    pintar(s.x1, s.y1, s.x2, s.y2, { suelo: s.suelo, color: s.color, sala: s.id });
    for (const p of s.puerta) g[p.y]![p.x] = { suelo: "pasillo", color: "", sala: "pasillo" };
  }
  pintar(PASILLO.x1, PASILLO.y1, PASILLO.x2, PASILLO.y2, { suelo: "pasillo", color: "", sala: "pasillo" });
  pintar(PATIO.x1, PATIO.y1, PATIO.x2, PATIO.y2, { suelo: "cesped", color: "", sala: "patio" });
  // Caminos de piedra de cada lado del patio hasta la fuente.
  const cx = FUENTE.x + FUENTE.ancho / 2 - 1;
  const cy = FUENTE.y + FUENTE.alto / 2 - 1;
  pintar(cx, PATIO.y1, cx + 1, PATIO.y2, { suelo: "camino", color: "", sala: "patio" });
  pintar(PATIO.x1, cy, PATIO.x2, cy + 1, { suelo: "camino", color: "", sala: "patio" });
  return g;
}
