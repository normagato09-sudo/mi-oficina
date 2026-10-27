import type { Aspecto } from "@/components/oficina/Personaje";
import type { Prop, Suelo } from "./mapa";

/**
 * Dibujos propios del juego, pintados en <canvas> píxel a píxel (sin Phaser: solo devuelven lienzos).
 * Tamaño base: casillas de 16 px, como la hoja de Kenney.
 */

type Ctx = CanvasRenderingContext2D;

function lienzo(ancho: number, alto: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement("canvas");
  c.width = ancho;
  c.height = alto;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

function px(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/** Aclara (+) u oscurece (−) un color #rrggbb. */
export function tono(hex: string, cuanto: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(cuanto >= 0 ? v + (255 - v) * cuanto : v * (1 + cuanto))));
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

/** Ruido fijo por casilla (el mismo dibujo cada vez). */
function azar(x: number, y: number, s = 0): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

/* ───────────── Personajes ───────────── */

export const ANCHO_PJ = 16;
export const ALTO_PJ = 24;
export type Direccion = "abajo" | "arriba" | "izquierda" | "derecha";
export const DIRECCIONES: Direccion[] = ["abajo", "arriba", "izquierda", "derecha"];
/** Fotogramas de la hoja de un personaje: 3 por dirección (quieto, paso A, paso B) y 2 sentado (quieto, tecleando). */
export const FOTOGRAMAS = [...DIRECCIONES.flatMap((d) => [`${d}-0`, `${d}-1`, `${d}-2`]), "sentado-0", "sentado-1"];

const PANTALON = "#343a4f";
const ZAPATO = "#1d1f27";
const OJOS = "#1d1f27";

function pelo(ctx: Ctx, ox: number, a: Aspecto, dir: Direccion, dy: number) {
  const p = a.pelo;
  const oscuro = tono(p, -0.25);
  const peinado = a.peinado ?? "corto";
  if (dir === "arriba") {
    px(ctx, ox + 4, 2 + dy, 8, 8, p);
    px(ctx, ox + 4, 9 + dy, 8, 1, oscuro);
    if (peinado === "largo") px(ctx, ox + 4, 10 + dy, 8, 4, p);
  } else {
    px(ctx, ox + 4, 2 + dy, 8, 3, p);
    px(ctx, ox + 5, 1 + dy, 6, 1, p);
    if (dir === "abajo") {
      px(ctx, ox + 4, 5 + dy, 1, 2, p);
      px(ctx, ox + 11, 5 + dy, 1, 2, p);
      if (peinado === "largo") {
        px(ctx, ox + 3, 4 + dy, 2, 9, p);
        px(ctx, ox + 11, 4 + dy, 2, 9, p);
        px(ctx, ox + 3, 12 + dy, 2, 1, oscuro);
        px(ctx, ox + 11, 12 + dy, 2, 1, oscuro);
      }
    } else {
      // De perfil: el pelo cubre la nuca (lado contrario a la cara).
      const nuca = dir === "izquierda" ? ox + 9 : ox + 4;
      px(ctx, nuca, 4 + dy, 3, 4, p);
      if (peinado === "largo") px(ctx, nuca, 8 + dy, 3, 5, p);
    }
    px(ctx, ox + 5, 2 + dy, 4, 1, tono(p, 0.25));
  }
  if (peinado === "mono") {
    px(ctx, ox + 6, 0 + dy, 4, 2, p);
    px(ctx, ox + 6, 0 + dy, 4, 1, oscuro);
  }
}

function cabeza(ctx: Ctx, ox: number, a: Aspecto, dir: Direccion, dy: number) {
  const piel = a.piel;
  px(ctx, ox + 4, 3 + dy, 8, 7, piel);
  px(ctx, ox + 5, 10 + dy, 6, 1, tono(piel, -0.15));
  if (dir === "abajo") {
    px(ctx, ox + 6, 6 + dy, 1, 2, OJOS);
    px(ctx, ox + 9, 6 + dy, 1, 2, OJOS);
    px(ctx, ox + 5, 8 + dy, 1, 1, tono(piel, -0.12));
    px(ctx, ox + 10, 8 + dy, 1, 1, tono(piel, -0.12));
  } else if (dir === "izquierda") {
    px(ctx, ox + 5, 6 + dy, 1, 2, OJOS);
    px(ctx, ox + 3, 7 + dy, 1, 1, piel);
  } else if (dir === "derecha") {
    px(ctx, ox + 10, 6 + dy, 1, 2, OJOS);
    px(ctx, ox + 12, 7 + dy, 1, 1, piel);
  }
  pelo(ctx, ox, a, dir, dy);
}

/** Torso con brazos; `brazos`: desplazamiento de cada brazo (balanceo al andar). */
function torso(ctx: Ctx, ox: number, a: Aspecto, dir: Direccion, dy: number, brazoIzq: number, brazoDer: number) {
  const c = a.camiseta;
  const s = a.sombra;
  if (dir === "izquierda" || dir === "derecha") {
    px(ctx, ox + 5, 11 + dy, 6, 7, c);
    px(ctx, ox + (dir === "izquierda" ? 10 : 5), 11 + dy, 1, 7, s);
    // Un brazo a la vista, que se balancea adelante y atrás.
    const bx = ox + 7 + brazoIzq;
    px(ctx, bx, 12 + dy, 2, 5, s);
    px(ctx, bx, 17 + dy, 2, 1, a.piel);
    return;
  }
  px(ctx, ox + 4, 11 + dy, 8, 7, c);
  px(ctx, ox + 4, 17 + dy, 8, 1, s);
  px(ctx, ox + 3, 11 + dy + brazoIzq, 1, 6, s);
  px(ctx, ox + 12, 11 + dy + brazoDer, 1, 6, s);
  px(ctx, ox + 3, 17 + dy + brazoIzq, 1, 1, a.piel);
  px(ctx, ox + 12, 17 + dy + brazoDer, 1, 1, a.piel);
  if (dir === "abajo") {
    px(ctx, ox + 7, 11 + dy, 2, 1, tono(c, 0.3));
    if (a.corbata) {
      px(ctx, ox + 7, 12 + dy, 2, 4, a.corbata);
      px(ctx, ox + 7, 16 + dy, 2, 1, tono(a.corbata, -0.3));
    }
  }
}

/** Piernas: `paso` 0 quieto, 1 o 2 alternando. */
function piernas(ctx: Ctx, ox: number, dir: Direccion, paso: number) {
  if (dir === "izquierda" || dir === "derecha") {
    if (paso === 0) {
      px(ctx, ox + 6, 18, 4, 4, PANTALON);
      px(ctx, ox + 6, 22, 4, 2, ZAPATO);
    } else {
      const a = paso === 1 ? 4 : 7;
      const b = paso === 1 ? 7 : 4;
      px(ctx, ox + a, 18, 3, 4, PANTALON);
      px(ctx, ox + a, 22, 3, 2, ZAPATO);
      px(ctx, ox + b, 18, 3, 3, tono(PANTALON, -0.2));
      px(ctx, ox + b, 21, 3, 2, ZAPATO);
    }
    return;
  }
  const izq = paso === 1 ? -1 : 0;
  const der = paso === 2 ? -1 : 0;
  px(ctx, ox + 5, 18, 3, 4 + izq, PANTALON);
  px(ctx, ox + 5, 22 + izq, 3, 2, ZAPATO);
  px(ctx, ox + 8, 18, 3, 4 + der, PANTALON);
  px(ctx, ox + 8, 22 + der, 3, 2, ZAPATO);
}

/** Hoja de un personaje: FOTOGRAMAS en fila, de 16 × 24 px. */
export function hojaPersonaje(a: Aspecto): HTMLCanvasElement {
  const [c, ctx] = lienzo(ANCHO_PJ * FOTOGRAMAS.length, ALTO_PJ);
  FOTOGRAMAS.forEach((nombre, i) => {
    const ox = i * ANCHO_PJ;
    const [d, n] = nombre.split("-") as [Direccion | "sentado", string];
    const paso = Number(n);
    if (d === "sentado") {
      // Sentada a la mesa, de cara: la mesa tapa de la cintura para abajo. Al teclear, las manos suben y bajan.
      torso(ctx, ox, a, "abajo", 0, paso === 1 ? -1 : 0, paso === 1 ? 0 : -1);
      cabeza(ctx, ox, a, "abajo", 0);
      return;
    }
    // Al andar, el cuerpo sube un píxel en cada paso.
    const dy = paso === 0 ? 0 : -1;
    piernas(ctx, ox, d, paso);
    const balanceo = paso === 0 ? 0 : paso === 1 ? 1 : -1;
    if (d === "izquierda" || d === "derecha") torso(ctx, ox, a, d, dy, d === "izquierda" ? -balanceo : balanceo, 0);
    else torso(ctx, ox, a, d, dy, balanceo, -balanceo);
    cabeza(ctx, ox, a, d, dy);
  });
  return c;
}

/* ───────────── Suelos y muros ───────────── */

/** Una casilla de suelo de 16 px. */
export function casillaSuelo(ctx: Ctx, ox: number, oy: number, suelo: Suelo, color: string, cx: number, cy: number) {
  const T = 16;
  switch (suelo) {
    case "madera": {
      // Tablas horizontales de 4 px, con juntas escalonadas.
      for (let f = 0; f < 4; f++) {
        const y = oy + f * 4;
        px(ctx, ox, y, T, 4, tono(color, (azar(cx, cy * 4 + f) - 0.5) * 0.12));
        px(ctx, ox, y + 3, T, 1, tono(color, -0.22));
        const junta = Math.floor(azar(cx + f, cy, 3) * 16);
        if ((cx + f) % 2 === 0) px(ctx, ox + junta, y, 1, 3, tono(color, -0.18));
        px(ctx, ox + ((junta + 5) % 16), y + 1, 2, 1, tono(color, 0.1));
      }
      break;
    }
    case "moqueta": {
      px(ctx, ox, oy, T, T, color);
      for (let i = 0; i < 14; i++) {
        const x = Math.floor(azar(cx, cy, i) * 16);
        const y = Math.floor(azar(cy, cx, i + 9) * 16);
        px(ctx, ox + x, oy + y, 1, 1, tono(color, azar(cx, i, cy) > 0.5 ? 0.09 : -0.09));
      }
      break;
    }
    case "baldosa": {
      const claro = (cx + cy) % 2 === 0;
      px(ctx, ox, oy, T, T, claro ? color : tono(color, -0.1));
      px(ctx, ox, oy + 15, T, 1, tono(color, -0.25));
      px(ctx, ox + 15, oy, 1, T, tono(color, -0.25));
      px(ctx, ox + 2, oy + 2, 3, 1, tono(color, 0.25));
      break;
    }
    case "pasillo": {
      const base = "#cfc8bb";
      px(ctx, ox, oy, T, T, tono(base, (azar(cx, cy) - 0.5) * 0.06));
      px(ctx, ox, oy + 15, T, 1, "#b3ab9c");
      px(ctx, ox + 15, oy, 1, T, "#b3ab9c");
      for (let i = 0; i < 4; i++) px(ctx, ox + Math.floor(azar(cx, cy, i) * 14), oy + Math.floor(azar(cy, cx, i) * 14), 1, 1, "#bdb5a7");
      break;
    }
    case "cesped":
    case "camino": {
      const verde = "#5f9c4b";
      px(ctx, ox, oy, T, T, tono(verde, (azar(cx, cy) - 0.5) * 0.08));
      for (let i = 0; i < 10; i++) {
        const x = Math.floor(azar(cx, cy, i) * 15);
        const y = Math.floor(azar(cy, cx, i + 3) * 14);
        px(ctx, ox + x, oy + y, 1, 2, azar(i, cx, cy) > 0.5 ? "#77b35c" : "#4d8a3d");
      }
      if (suelo === "camino") {
        // Losas de piedra.
        px(ctx, ox + 1, oy + 1, 6, 6, "#bcb3a1");
        px(ctx, ox + 9, oy + 2, 6, 5, "#c8bfad");
        px(ctx, ox + 2, oy + 9, 5, 6, "#c8bfad");
        px(ctx, ox + 8, oy + 9, 7, 6, "#bcb3a1");
        for (const [x, y, w] of [[1, 6, 6], [9, 6, 6], [2, 14, 5], [8, 14, 7]] as const) px(ctx, ox + x, oy + y, w, 1, "#9d9483");
      }
      break;
    }
  }
}

export const COLOR_MURO_ARRIBA = "#3b4152";
const MURO_CARA = "#ece5d6";
const MURO_ZOCALO = "#9a8a72";

/** Muro: la cara que se ve (si hay suelo debajo) o solo la parte de arriba. */
export function casillaMuro(ctx: Ctx, ox: number, oy: number, conCara: boolean) {
  if (!conCara) {
    px(ctx, ox, oy, 16, 16, COLOR_MURO_ARRIBA);
    return;
  }
  px(ctx, ox, oy, 16, 4, COLOR_MURO_ARRIBA);
  px(ctx, ox, oy + 4, 16, 10, MURO_CARA);
  px(ctx, ox, oy + 4, 16, 1, "#f8f3e8");
  px(ctx, ox, oy + 13, 16, 3, MURO_ZOCALO);
  px(ctx, ox, oy + 13, 16, 1, tono(MURO_ZOCALO, -0.2));
}

/** Sombra del muro sobre el suelo de la fila de debajo. */
export function sombraMuro(ctx: Ctx, ox: number, oy: number) {
  px(ctx, ox, oy, 16, 3, "rgba(0, 0, 0, 0.16)");
}

/** Felpudo en las puertas. */
export function felpudo(ctx: Ctx, ox: number, oy: number) {
  px(ctx, ox + 1, oy + 3, 14, 10, "#6b4f3a");
  px(ctx, ox + 2, oy + 4, 12, 8, "#8a6a4d");
}

/* ───────────── Fuente del patio (4 × 4 casillas, 2 fotogramas de agua) ───────────── */

export function hojaFuente(): HTMLCanvasElement {
  const L = 64;
  const [c, ctx] = lienzo(L * 2, L);
  for (let f = 0; f < 2; f++) {
    const ox = f * L;
    const circulo = (r: number, color: string) => {
      ctx.fillStyle = color;
      for (let y = 0; y < L; y++)
        for (let x = 0; x < L; x++) {
          const dx = x + 0.5 - L / 2;
          const dy = (y + 0.5 - L / 2) * 1.12;
          if (dx * dx + dy * dy <= r * r) ctx.fillRect(ox + x, y, 1, 1);
        }
    };
    circulo(31, "#8d8577");
    circulo(29, "#c9c0b0");
    circulo(26, "#3f86c4");
    circulo(22, "#4f9ad6");
    // Brillos del agua (cambian de sitio en cada fotograma).
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + f * 0.35;
      const r = 13 + (i % 3) * 4;
      px(ctx, ox + Math.round(L / 2 + Math.cos(a) * r), Math.round(L / 2 + Math.sin(a) * r * 0.9), 3, 1, "#a9d8f7");
    }
    // Pedestal y surtidor.
    px(ctx, ox + 27, 26, 10, 12, "#bdb3a2");
    px(ctx, ox + 27, 26, 10, 2, "#d9d0c0");
    px(ctx, ox + 29, 18 - f, 6, 9 + f, "#cfe9fb");
    px(ctx, ox + 30, 16 - f, 4, 3, "#e9f6fd");
  }
  return c;
}

/* ───────────── Objetos ───────────── */

export type MedidaProp = {
  ancho: number;
  alto: number;
  /** Casillas de ancho donde se apoya (para centrarlo). */
  pie: number;
  /** Cuelga de la pared (se dibuja sobre el muro de arriba). */
  pared?: boolean;
  /** Fotogramas (animado). */
  fotogramas?: number;
  /** Píxeles que sube desde el borde de abajo de su casilla (p. ej. encima de la mesa). */
  sube?: number;
};

export const MEDIDAS: Record<Prop, MedidaProp> = {
  portatil: { ancho: 14, alto: 12, pie: 1, sube: 3 },
  monitores: { ancho: 40, alto: 14, pie: 1, sube: 4 },
  maquinaEscribir: { ancho: 14, alto: 12, pie: 1, sube: 3 },
  papeles: { ancho: 12, alto: 10, pie: 1, sube: 3 },
  caballete: { ancho: 16, alto: 30, pie: 1 },
  pizarra: { ancho: 30, alto: 18, pie: 2, pared: true },
  calendario: { ancho: 12, alto: 14, pie: 1, pared: true },
  banderas: { ancho: 40, alto: 12, pie: 3, pared: true },
  globo: { ancho: 14, alto: 16, pie: 1 },
  escudo: { ancho: 14, alto: 16, pie: 1, pared: true },
  leds: { ancho: 16, alto: 16, pie: 1, fotogramas: 2 },
  cafetera: { ancho: 10, alto: 13, pie: 1, sube: 4 },
  fuenteAgua: { ancho: 12, alto: 22, pie: 1 },
  arbol: { ancho: 34, alto: 42, pie: 2 },
  arbusto: { ancho: 16, alto: 14, pie: 1 },
  flores: { ancho: 16, alto: 12, pie: 1, sube: 2 },
  telefono: { ancho: 12, alto: 12, pie: 1, sube: 3 },
  anilloLuz: { ancho: 16, alto: 28, pie: 1 },
  archivador: { ancho: 14, alto: 20, pie: 1 },
  ordenadorCeo: { ancho: 22, alto: 16, pie: 1, sube: 4 },
};

function circuloLleno(ctx: Ctx, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color;
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) ctx.fillRect(cx + x, cy + y, 1, 1);
}

function pantalla(ctx: Ctx, x: number, y: number, w: number, h: number, brillo: string) {
  px(ctx, x, y, w, h, "#22252e");
  px(ctx, x + 1, y + 1, w - 2, h - 2, "#2f5d8a");
  px(ctx, x + 1, y + 1, w - 2, 1, brillo);
  for (let i = 0; i < h - 4; i += 2) px(ctx, x + 2, y + 3 + i, Math.max(1, Math.floor((w - 4) * (0.4 + ((i * 7) % 5) / 10))), 1, "#9fd0f5");
}

const DIBUJOS: Record<Prop, (ctx: Ctx, ox: number) => void> = {
  portatil: (ctx, o) => {
    pantalla(ctx, o + 1, 0, 12, 8, "#6fb3e8");
    px(ctx, o, 8, 14, 4, "#b9bec9");
    px(ctx, o + 1, 9, 12, 2, "#8e94a1");
  },
  monitores: (ctx, o) => {
    for (const x of [0, 13, 27]) {
      pantalla(ctx, o + x, 0, 13, 10, "#7fd0a8");
      px(ctx, o + x + 5, 10, 3, 2, "#3b3f4a");
      px(ctx, o + x + 3, 12, 7, 2, "#2b2e37");
    }
  },
  maquinaEscribir: (ctx, o) => {
    px(ctx, o + 3, 0, 8, 5, "#f7f3e8");
    px(ctx, o + 4, 1, 6, 1, "#9aa1ad");
    px(ctx, o + 4, 3, 5, 1, "#9aa1ad");
    px(ctx, o, 4, 14, 8, "#3a4a5e");
    px(ctx, o + 1, 6, 12, 1, "#e9e3d3");
    px(ctx, o + 1, 8, 12, 1, "#e9e3d3");
    px(ctx, o + 2, 10, 10, 1, "#c9c2b0");
  },
  papeles: (ctx, o) => {
    for (let i = 0; i < 4; i++) {
      px(ctx, o + 1 + (i % 2), 6 - i * 2, 10, 4, i % 2 ? "#f4efe2" : "#ffffff");
      px(ctx, o + 1 + (i % 2), 9 - i * 2, 10, 1, "#c8c0ae");
    }
  },
  caballete: (ctx, o) => {
    px(ctx, o + 3, 6, 2, 24, "#7a5532");
    px(ctx, o + 11, 6, 2, 24, "#7a5532");
    px(ctx, o + 7, 2, 2, 26, "#8b6238");
    px(ctx, o + 1, 2, 14, 15, "#fbf8f0");
    px(ctx, o + 2, 3, 12, 13, "#f3d9a0");
    circuloLleno(ctx, o + 6, 8, 3, "#e07b39");
    px(ctx, o + 2, 12, 12, 4, "#5f9c4b");
    px(ctx, o + 9, 5, 3, 3, "#4f9ad6");
    px(ctx, o + 1, 17, 14, 2, "#7a5532");
  },
  pizarra: (ctx, o) => {
    px(ctx, o, 0, 30, 18, "#9aa1ad");
    px(ctx, o + 1, 1, 28, 15, "#fbfbf8");
    const barras = [5, 9, 7, 12, 10];
    barras.forEach((h, i) => px(ctx, o + 3 + i * 5, 14 - h, 3, h, ["#4f9ad6", "#5fd08a", "#f5b841", "#e07b39", "#d62976"][i]!));
    px(ctx, o + 2, 14, 26, 1, "#3b4152");
    px(ctx, o + 4, 16, 22, 2, "#7d8491");
  },
  calendario: (ctx, o) => {
    px(ctx, o, 0, 12, 14, "#ffffff");
    px(ctx, o, 0, 12, 4, "#da1415");
    px(ctx, o + 3, 0, 1, 2, "#3b4152");
    px(ctx, o + 8, 0, 1, 2, "#3b4152");
    for (let f = 0; f < 3; f++) for (let c = 0; c < 4; c++) px(ctx, o + 1 + c * 3, 5 + f * 3, 2, 2, f === 1 && c === 2 ? "#da1415" : "#c3c8d2");
  },
  banderas: (ctx, o) => {
    // España, Cataluña y Reino Unido.
    px(ctx, o, 0, 12, 9, "#c60b1e");
    px(ctx, o, 2, 12, 5, "#ffc400");
    px(ctx, o + 14, 0, 12, 9, "#fcdd09");
    for (let i = 0; i < 4; i++) px(ctx, o + 14, 1 + i * 2, 12, 1, "#da121a");
    px(ctx, o + 28, 0, 12, 9, "#012169");
    for (let i = 0; i < 12; i++) {
      px(ctx, o + 28 + i, Math.floor(i * 0.7), 1, 1, "#ffffff");
      px(ctx, o + 39 - i, Math.floor(i * 0.7), 1, 1, "#ffffff");
    }
    px(ctx, o + 28, 3, 12, 3, "#ffffff");
    px(ctx, o + 32, 0, 4, 9, "#ffffff");
    px(ctx, o + 28, 4, 12, 1, "#c8102e");
    px(ctx, o + 33, 0, 2, 9, "#c8102e");
    for (const x of [0, 14, 28]) px(ctx, o + x, 9, 12, 1, "rgba(0,0,0,0.25)");
  },
  globo: (ctx, o) => {
    circuloLleno(ctx, o + 7, 6, 6, "#3f86c4");
    px(ctx, o + 4, 3, 3, 2, "#5f9c4b");
    px(ctx, o + 8, 6, 3, 3, "#5f9c4b");
    px(ctx, o + 5, 9, 2, 1, "#5f9c4b");
    px(ctx, o + 6, 13, 2, 2, "#7a5532");
    px(ctx, o + 3, 15, 8, 1, "#5a3e24");
  },
  escudo: (ctx, o) => {
    px(ctx, o + 1, 0, 12, 9, "#2f6db5");
    for (let i = 0; i < 6; i++) px(ctx, o + 1 + i, 9 + i, 12 - i * 2, 1, "#2f6db5");
    px(ctx, o + 3, 2, 8, 6, "#5fd08a");
    px(ctx, o + 6, 4, 2, 6, "#ffffff");
    px(ctx, o + 5, 4, 4, 2, "#ffffff");
  },
  leds: (ctx, o) => {
    // Dos fotogramas: o es el fotograma × 16. Las luces se encienden alternas.
    const f = o / 16;
    for (let i = 0; i < 4; i++) {
      const enc = (i + f) % 2 === 0;
      px(ctx, o + 3 + (i % 2) * 8, 4 + Math.floor(i / 2) * 6, 2, 1, enc ? "#5fd08a" : "#2a5a3c");
      px(ctx, o + 6 + (i % 2) * 8, 4 + Math.floor(i / 2) * 6, 1, 1, enc ? "#f5b841" : "#5a4a20");
    }
  },
  cafetera: (ctx, o) => {
    px(ctx, o, 0, 10, 12, "#2b2e37");
    px(ctx, o + 1, 1, 8, 3, "#4a4f5c");
    px(ctx, o + 2, 5, 6, 4, "#1d1f27");
    px(ctx, o + 3, 7, 4, 3, "#ffffff");
    px(ctx, o + 3, 7, 4, 1, "#7a4a2a");
    px(ctx, o + 7, 2, 1, 1, "#da1415");
  },
  fuenteAgua: (ctx, o) => {
    px(ctx, o + 2, 0, 8, 9, "#8fd0f2");
    px(ctx, o + 3, 1, 3, 6, "#c4e8fa");
    px(ctx, o + 1, 9, 10, 13, "#e7e9ee");
    px(ctx, o + 1, 9, 10, 1, "#c3c8d2");
    px(ctx, o + 3, 12, 2, 2, "#4f9ad6");
    px(ctx, o + 7, 12, 2, 2, "#da1415");
    px(ctx, o + 1, 20, 10, 2, "#9aa1ad");
  },
  arbol: (ctx, o) => {
    px(ctx, o + 15, 28, 4, 12, "#6b4a2b");
    px(ctx, o + 9, 39, 16, 3, "rgba(0,0,0,0.18)");
    circuloLleno(ctx, o + 17, 16, 15, "#3f7a35");
    circuloLleno(ctx, o + 11, 18, 9, "#4d8a3d");
    circuloLleno(ctx, o + 22, 12, 9, "#5f9c4b");
    circuloLleno(ctx, o + 15, 9, 6, "#77b35c");
    for (let i = 0; i < 8; i++) px(ctx, o + 6 + Math.floor(azar(i, 1) * 22), 4 + Math.floor(azar(1, i) * 22), 2, 2, "#8cc46e");
  },
  arbusto: (ctx, o) => {
    px(ctx, o + 2, 12, 12, 2, "rgba(0,0,0,0.18)");
    circuloLleno(ctx, o + 5, 8, 5, "#3f7a35");
    circuloLleno(ctx, o + 11, 8, 5, "#4d8a3d");
    circuloLleno(ctx, o + 8, 5, 5, "#5f9c4b");
    px(ctx, o + 6, 3, 2, 2, "#8cc46e");
    px(ctx, o + 11, 6, 2, 1, "#e07b9a");
  },
  flores: (ctx, o) => {
    const colores = ["#e07b9a", "#f5b841", "#ffffff", "#b07be0", "#e05a5a"];
    for (let i = 0; i < 6; i++) {
      const x = o + 1 + Math.floor(azar(i, 4) * 12);
      const y = 2 + Math.floor(azar(4, i) * 7);
      px(ctx, x + 1, y + 2, 1, 2, "#3f7a35");
      px(ctx, x, y, 3, 2, colores[i % colores.length]!);
      px(ctx, x + 1, y, 1, 1, "#fff6c8");
    }
  },
  telefono: (ctx, o) => {
    px(ctx, o + 3, 1, 6, 10, "#1d1f27");
    px(ctx, o + 4, 2, 4, 7, "#d62976");
    px(ctx, o + 4, 2, 4, 2, "#f58fc0");
    px(ctx, o + 5, 10, 2, 1, "#4a4f5c");
  },
  anilloLuz: (ctx, o) => {
    ctx.fillStyle = "#fff7d6";
    for (let a = 0; a < 40; a++) {
      const ang = (a / 40) * Math.PI * 2;
      ctx.fillRect(o + Math.round(8 + Math.cos(ang) * 6), Math.round(7 + Math.sin(ang) * 6), 1, 1);
    }
    px(ctx, o + 6, 5, 4, 5, "#1d1f27");
    px(ctx, o + 7, 14, 2, 12, "#3b3f4a");
    px(ctx, o + 3, 26, 10, 2, "#2b2e37");
  },
  archivador: (ctx, o) => {
    px(ctx, o, 0, 14, 20, "#7d8491");
    px(ctx, o, 0, 14, 2, "#9aa1ad");
    for (let i = 0; i < 3; i++) {
      px(ctx, o + 1, 3 + i * 6, 12, 5, "#8e95a2");
      px(ctx, o + 5, 5 + i * 6, 4, 1, "#3b4152");
    }
  },
  ordenadorCeo: (ctx, o) => {
    px(ctx, o, 0, 22, 12, "#d8dbe2");
    px(ctx, o + 1, 1, 20, 10, "#1e2a3c");
    px(ctx, o + 2, 2, 18, 8, "#3b6fa3");
    px(ctx, o + 2, 2, 18, 2, "#f5b841");
    px(ctx, o + 4, 6, 6, 3, "#ffffff");
    px(ctx, o + 12, 6, 6, 1, "#9fd0f5");
    px(ctx, o + 12, 8, 4, 1, "#9fd0f5");
    px(ctx, o + 9, 12, 4, 2, "#b9bec9");
    px(ctx, o + 5, 14, 12, 2, "#8e94a1");
  },
};

/** Lienzo de un objeto (con sus fotogramas en fila si es animado). */
export function dibujoProp(prop: Prop): HTMLCanvasElement {
  const m = MEDIDAS[prop];
  const n = m.fotogramas ?? 1;
  const [c, ctx] = lienzo(m.ancho * n, m.alto);
  for (let f = 0; f < n; f++) DIBUJOS[prop](ctx, f * m.ancho);
  return c;
}

/** Brillo redondo (luz de estado bajo el agente). */
export function dibujoHalo(): HTMLCanvasElement {
  const [c, ctx] = lienzo(64, 32);
  const g = ctx.createRadialGradient(32, 16, 0, 32, 16, 32);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.scale(1, 0.5);
  ctx.beginPath();
  ctx.arc(32, 32, 32, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

export { lienzo };
