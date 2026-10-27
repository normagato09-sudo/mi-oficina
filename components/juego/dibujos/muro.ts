import { P, T, azar, px, tono, type Ctx } from "./comun";

/** Parte de arriba de un muro (lo que se ve de los muros laterales y de abajo). */
export function pintarMuroArriba(ctx: Ctx, x: number, y: number, w: number, h: number) {
  px(ctx, x, y, w, h, P.muroArriba);
  px(ctx, x, y, w, 1, tono(P.muroArriba, 0.15));
}

/** Cara de un muro de 2 casillas de alto (64 px) con zócalo. */
export function pintarMuroCara(ctx: Ctx, x: number, y: number, w: number) {
  px(ctx, x, y, w, 8, P.muroArriba);
  px(ctx, x, y + 8, w, 48, P.muro);
  px(ctx, x, y + 8, w, 2, P.muroLuz);
  px(ctx, x, y + 56, w, 8, P.zocalo);
  px(ctx, x, y + 56, w, 1, tono(P.zocalo, 0.25));
}

/**
 * Ventanal de 2 casillas de alto a lo largo de `w` px, con la ciudad detrás.
 * Cuanto más alta la planta, más cielo y más bajos se ven los edificios.
 */
export function pintarVentanal(ctx: Ctx, x: number, y: number, w: number, planta: number) {
  pintarMuroCara(ctx, x, y, w);
  const top = y + 10;
  const alto = 44;
  // Cielo.
  const g = ctx.createLinearGradient(0, top, 0, top + alto);
  g.addColorStop(0, P.cieloAlto);
  g.addColorStop(1, P.cielo);
  ctx.fillStyle = g;
  ctx.fillRect(x + 2, top, w - 4, alto);
  // Nubes.
  for (let i = 0; i < w / 90; i++) {
    const nx = x + Math.floor(azar(i, planta, 7) * (w - 30));
    const ny = top + 4 + Math.floor(azar(planta, i, 7) * 10);
    px(ctx, nx, ny, 22, 4, "rgba(255,255,255,0.75)");
    px(ctx, nx + 5, ny - 3, 12, 3, "rgba(255,255,255,0.75)");
  }
  // Ciudad: dos capas de edificios (lejos y cerca).
  const bajar = planta * 5;
  for (const [capa, color, base] of [
    [0, P.ciudadLejos, 22],
    [1, P.ciudad, 30],
  ] as const) {
    let bx = x + 2;
    let i = 0;
    while (bx < x + w - 2) {
      const ancho = 12 + Math.floor(azar(i, capa, planta) * 18);
      const altura = Math.max(4, base - bajar + Math.floor(azar(capa, i, planta) * 14) - 6);
      const by = top + alto - altura;
      const anchoReal = Math.min(ancho, x + w - 2 - bx);
      px(ctx, bx, by, anchoReal, altura, color);
      if (capa === 1)
        for (let wy = by + 3; wy < top + alto - 3; wy += 5)
          for (let wx = bx + 2; wx < bx + anchoReal - 2; wx += 4) if (azar(wx, wy) > 0.55) px(ctx, wx, wy, 2, 2, P.ventanaLuz);
      bx += ancho + (capa === 0 ? 2 : 4);
      i++;
    }
  }
  // Marcos del ventanal cada 2 casillas, con un brillo en diagonal.
  px(ctx, x, top - 2, w, 2, P.marco);
  px(ctx, x, top + alto, w, 2, P.marco);
  for (let mx = x; mx <= x + w; mx += T * 2) {
    px(ctx, Math.min(mx, x + w - 3), top - 2, 3, alto + 4, P.marco);
    for (let k = 0; k < 10; k++) px(ctx, mx + 10 + k, top + 30 - k * 2, 1, 2, "rgba(255,255,255,0.35)");
  }
}

/** Cuadro o letrero en la pared (logo de la oficina). */
export function pintarLogo(ctx: Ctx, cx: number, y: number) {
  px(ctx, cx - 30, y + 14, 60, 28, P.contorno);
  px(ctx, cx - 29, y + 15, 58, 26, "#2c3e66");
  for (const [dx, dy] of [
    [-10, 19],
    [1, 19],
    [-10, 29],
    [1, 29],
  ])
    px(ctx, cx + dx!, y + dy!, 9, 8, P.amarillo);
}
