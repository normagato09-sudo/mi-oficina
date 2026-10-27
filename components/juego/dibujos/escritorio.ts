import { P, lienzo, px, tono, type Dibujo } from "./comun";

/**
 * Mesa de trabajo moderna de 2 casillas (64 × 48 px; la parte de abajo es la casilla que ocupa).
 * La persona se sienta detrás (al norte), de cara; los monitores se ven por detrás.
 */
export type OpcionesEscritorio = {
  madera?: boolean;
  monitores?: 1 | 2;
  /** Algo más encima de la mesa. */
  extra?: "taza" | "papeles" | "planta" | "nada";
};

export const ALTO_ESCRITORIO = 48;

export function dibujarEscritorio({ madera = false, monitores = 1, extra = "taza" }: OpcionesEscritorio = {}): Dibujo {
  const [c, ctx] = lienzo(64, ALTO_ESCRITORIO);
  const tablero = madera ? P.maderaClara : P.blanco;
  const canto = madera ? P.maderaClaraSombra : P.blancoSombra;
  // Patas y faldón.
  px(ctx, 3, 36, 4, 12, P.metalOscuro);
  px(ctx, 57, 36, 4, 12, P.metalOscuro);
  px(ctx, 7, 37, 50, 7, tono(canto, -0.12));
  // Tablero (con contorno y canto delantero).
  px(ctx, 0, 15, 64, 23, P.contorno);
  px(ctx, 1, 16, 62, 18, tablero);
  px(ctx, 1, 16, 62, 1, tono(tablero, 0.4));
  px(ctx, 1, 34, 62, 3, canto);
  if (madera) for (let i = 0; i < 4; i++) px(ctx, 4 + i * 15, 20 + (i % 2) * 7, 10, 1, tono(tablero, -0.06));
  // Teclado y ratón, junto a quien se sienta.
  px(ctx, 20, 18, 22, 5, P.contorno);
  px(ctx, 21, 19, 20, 3, "#e3e5ea");
  for (let i = 0; i < 6; i++) px(ctx, 22 + i * 3, 20, 2, 1, "#b5b9c2");
  px(ctx, 45, 18, 4, 5, P.contorno);
  px(ctx, 46, 19, 2, 3, "#e3e5ea");
  // Monitores, vistos por detrás.
  const monitor = (x: number, w: number) => {
    px(ctx, x + w / 2 - 2, 28, 4, 5, P.metalOscuro);
    px(ctx, x + w / 2 - 6, 32, 12, 2, P.metalOscuro);
    px(ctx, x, 19, w, 11, P.contorno);
    px(ctx, x + 1, 20, w - 2, 9, "#4a4e5c");
    px(ctx, x + 1, 20, w - 2, 1, "#6a6f80");
    px(ctx, x + 3, 29, w - 6, 1, "rgba(143, 208, 245, 0.6)"); // reflejo de la pantalla en la mesa
  };
  if (monitores === 2) {
    monitor(12, 19);
    monitor(33, 19);
  } else monitor(21, 22);
  // Algo más.
  if (extra === "taza") {
    px(ctx, 53, 22, 7, 7, P.contorno);
    px(ctx, 54, 23, 5, 5, "#ffffff");
    px(ctx, 54, 23, 5, 1, "#7a4a2a");
    px(ctx, 59, 24, 2, 3, P.contorno);
  } else if (extra === "papeles") {
    px(ctx, 3, 19, 12, 12, P.contorno);
    px(ctx, 4, 20, 10, 10, P.papel);
    px(ctx, 6, 22, 6, 1, "#c3c8d2");
    px(ctx, 6, 24, 5, 1, "#c3c8d2");
    px(ctx, 6, 26, 6, 1, "#c3c8d2");
  } else if (extra === "planta") {
    px(ctx, 53, 24, 7, 7, P.contorno);
    px(ctx, 54, 25, 5, 5, P.maceta);
    px(ctx, 52, 17, 9, 8, P.verdeOscuro);
    px(ctx, 53, 18, 7, 6, P.verde);
    px(ctx, 55, 18, 2, 2, P.verdeClaro);
  }
  return { canvas: c };
}
