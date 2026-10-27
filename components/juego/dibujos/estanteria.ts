import { P, azar, lienzo, px, tono, type Dibujo } from "./comun";

/** Estantería baja de madera contra la pared, `casillas` de ancho y 64 px de alto, con libros y algún objeto. */
export function dibujarEstanteria(casillas: number, semilla = 0): Dibujo {
  const w = casillas * 32;
  const h = 64;
  const [c, ctx] = lienzo(w, h);
  px(ctx, 0, 0, w, h, P.contorno);
  px(ctx, 1, 1, w - 2, h - 2, P.madera);
  px(ctx, 1, 1, w - 2, 3, tono(P.madera, 0.25));
  const colores = ["#2f6db5", "#c0392b", "#e0b23a", "#3c8d5a", "#8e5aa8", "#e07b39", "#34495e", "#d35d6e", "#1f8a8a"];
  for (let balda = 0; balda < 3; balda++) {
    const y = 5 + balda * 19;
    px(ctx, 3, y, w - 6, 15, tono(P.madera, -0.35));
    let x = 4;
    let i = 0;
    while (x < w - 8) {
      const r = azar(i, balda, semilla);
      if (r < 0.12 && x < w - 16) {
        // Un hueco con un objeto: maceta pequeña o caja.
        px(ctx, x + 1, y + 7, 7, 8, r < 0.06 ? P.maceta : "#e8e1d4");
        if (r < 0.06) px(ctx, x, y + 2, 9, 6, P.verde);
        x += 11;
      } else {
        const ancho = 3 + Math.floor(r * 3);
        const alto = 10 + Math.floor(azar(balda, i, semilla) * 5);
        px(ctx, x, y + 15 - alto, ancho, alto, colores[Math.floor(azar(i, semilla, balda) * colores.length)]!);
        px(ctx, x, y + 15 - alto + 2, ancho, 1, "rgba(255,255,255,0.35)");
        x += ancho + 1;
      }
      i++;
    }
    px(ctx, 1, y + 15, w - 2, 3, P.madera);
  }
  return { canvas: c };
}
