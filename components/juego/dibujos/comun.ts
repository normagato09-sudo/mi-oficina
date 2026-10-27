/**
 * Utilidades y paleta común de los dibujos del edificio (casillas de 32 px).
 * Cada objeto está en su archivo de esta carpeta: para cambiar uno, basta con cambiar su función.
 */

export const T = 32;

export type Ctx = CanvasRenderingContext2D;

/** Paleta del edificio: tonos apagados y cálidos, con el mismo contorno para todo. */
export const P = {
  contorno: "#2a2433",
  sombra: "rgba(30, 24, 40, 0.22)",
  // Muros y ventanales
  muroArriba: "#4b4658",
  muro: "#ebe5da",
  muroLuz: "#f7f3ec",
  zocalo: "#6e6878",
  marco: "#5c5a6a",
  cielo: "#a9d4ee",
  cieloAlto: "#7fb6dd",
  ciudad: "#7f97b3",
  ciudadLejos: "#9fb3c9",
  ventanaLuz: "#f3e3a0",
  // Cristal de los despachos
  cristal: "rgba(176, 214, 236, 0.38)",
  cristalBrillo: "rgba(255, 255, 255, 0.55)",
  cristalMarco: "#8f9cad",
  // Muebles
  blanco: "#f4f2ee",
  blancoSombra: "#d9d5ce",
  maderaClara: "#d9b98f",
  maderaClaraSombra: "#b8966b",
  madera: "#a87a50",
  maderaOscura: "#6e4a32",
  metal: "#9aa0ab",
  metalOscuro: "#5d6270",
  negro: "#2b2d35",
  pantalla: "#2f4f6f",
  pantallaLuz: "#8fd0f5",
  tela: "#5b6a8f",
  cuero: "#5a3a2c",
  verde: "#4f9a5a",
  verdeClaro: "#79bf6f",
  verdeOscuro: "#356f3f",
  maceta: "#c9b8a6",
  papel: "#fbfaf6",
  rojo: "#d9534f",
  amarillo: "#f5b841",
} as const;

export function lienzo(ancho: number, alto: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement("canvas");
  c.width = ancho;
  c.height = alto;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

export function px(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/** Aclara (+) u oscurece (−) un color #rrggbb. */
export function tono(hex: string, cuanto: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(cuanto >= 0 ? v + (255 - v) * cuanto : v * (1 + cuanto))));
  return `#${[f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Ruido fijo (el mismo dibujo cada vez). */
export function azar(x: number, y: number, s = 0): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Rectángulo con contorno de 1 px. */
export function caja(ctx: Ctx, x: number, y: number, w: number, h: number, relleno: string, contorno: string = P.contorno) {
  px(ctx, x, y, w, h, contorno);
  px(ctx, x + 1, y + 1, w - 2, h - 2, relleno);
}

/** Sombra suave (elipse difuminada) bajo un mueble. */
export function sombraSuave(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, fuerza = 0.24) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, rx * 0.3, 0, 0, rx);
  g.addColorStop(0, `rgba(30, 24, 40, ${fuerza})`);
  g.addColorStop(1, "rgba(30, 24, 40, 0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Círculo lleno en píxeles. */
export function circulo(ctx: Ctx, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color;
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) ctx.fillRect(cx + x, cy + y, 1, 1);
}

/** Añade un contorno de 1 px alrededor de todo lo dibujado (píxeles transparentes junto a uno opaco). */
export function contornear(c: HTMLCanvasElement, color: string = P.contorno) {
  const ctx = c.getContext("2d")!;
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const w = c.width;
  const h = c.height;
  const opaco = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3]! > 128;
  const n = parseInt(color.slice(1), 16);
  const marcar: number[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (!opaco(x, y) && (opaco(x - 1, y) || opaco(x + 1, y) || opaco(x, y - 1) || opaco(x, y + 1))) marcar.push((y * w + x) * 4);
  for (const i of marcar) {
    d[i] = n >> 16;
    d[i + 1] = (n >> 8) & 255;
    d[i + 2] = n & 255;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

/** Recorta un lienzo en fotogramas para Phaser: [nombre, x, y, ancho, alto]. */
export type Recorte = [string, number, number, number, number];

/** Un dibujo listo para convertirse en textura. */
export type Dibujo = { canvas: HTMLCanvasElement; fotogramas?: Recorte[] };
