import type { Aspecto } from "@/components/oficina/Personaje";
import { P, contornear, lienzo, px, tono, type Ctx, type Dibujo, type Recorte } from "./comun";

/**
 * Personajes de 32 × 48 px con contorno: andar en 4 direcciones (3 fotogramas cada una),
 * sentado de frente (2 fotogramas, tecleando) y sentado de espaldas.
 */

export const ANCHO_PJ = 32;
export const ALTO_PJ = 48;
export type Direccion = "abajo" | "arriba" | "izquierda" | "derecha";
export const DIRECCIONES: Direccion[] = ["abajo", "arriba", "izquierda", "derecha"];
export const FOTOGRAMAS_PJ = [...DIRECCIONES.flatMap((d) => [`${d}-0`, `${d}-1`, `${d}-2`]), "sentado-0", "sentado-1", "espalda"];

const PANTALON = "#3a3f55";
const ZAPATO = "#262833";

type Pose = { dy: number; paso: number };

function pelo(ctx: Ctx, a: Aspecto, vista: "frente" | "espalda" | "lado", dy: number) {
  const p = a.pelo;
  const luz = tono(p, 0.22);
  const osc = tono(p, -0.25);
  const peinado = a.peinado ?? "corto";
  if (vista === "espalda") {
    px(ctx, 9, 4 + dy, 14, 14, p);
    px(ctx, 10, 3 + dy, 12, 1, p);
    px(ctx, 11, 5 + dy, 5, 2, luz);
    px(ctx, 9, 16 + dy, 14, 2, osc);
    if (peinado === "largo") {
      px(ctx, 9, 18 + dy, 14, 7, p);
      px(ctx, 9, 24 + dy, 14, 1, osc);
    }
  } else if (vista === "frente") {
    px(ctx, 9, 4 + dy, 14, 5, p);
    px(ctx, 10, 3 + dy, 12, 1, p);
    px(ctx, 9, 9 + dy, 2, 5, p);
    px(ctx, 21, 9 + dy, 2, 5, p);
    px(ctx, 12, 9 + dy, 6, 1, p); // flequillo
    px(ctx, 11, 4 + dy, 6, 1, luz);
    if (peinado === "largo") {
      px(ctx, 7, 8 + dy, 4, 17, p);
      px(ctx, 21, 8 + dy, 4, 17, p);
      px(ctx, 7, 24 + dy, 4, 1, osc);
      px(ctx, 21, 24 + dy, 4, 1, osc);
    }
  } else {
    // De perfil mirando a la derecha: el pelo cubre la nuca (izquierda).
    px(ctx, 10, 4 + dy, 12, 5, p);
    px(ctx, 11, 3 + dy, 10, 1, p);
    px(ctx, 9, 7 + dy, 6, 9, p);
    px(ctx, 12, 4 + dy, 5, 1, luz);
    if (peinado === "largo") {
      px(ctx, 8, 14 + dy, 7, 11, p);
      px(ctx, 8, 24 + dy, 7, 1, osc);
    }
  }
  if (peinado === "mono") {
    const x = vista === "lado" ? 8 : 13;
    px(ctx, x, 0 + dy, 6, 4, p);
    px(ctx, x + 1, 0 + dy, 3, 1, luz);
  }
}

function cabeza(ctx: Ctx, a: Aspecto, vista: "frente" | "espalda" | "lado", dy: number) {
  const piel = a.piel;
  const sombraPiel = tono(piel, -0.14);
  if (vista === "lado") {
    px(ctx, 11, 6 + dy, 11, 13, piel);
    px(ctx, 22, 13 + dy, 1, 2, piel); // nariz
    px(ctx, 18, 11 + dy, 2, 2, P.contorno);
    px(ctx, 19, 16 + dy, 2, 1, sombraPiel);
    px(ctx, 12, 18 + dy, 9, 1, sombraPiel);
    px(ctx, 13, 19 + dy, 4, 2, sombraPiel); // cuello
  } else {
    px(ctx, 10, 6 + dy, 12, 13, piel);
    px(ctx, 11, 19 + dy, 10, 1, sombraPiel);
    px(ctx, 14, 19 + dy, 4, 2, sombraPiel);
    if (vista === "frente") {
      px(ctx, 12, 12 + dy, 2, 2, P.contorno);
      px(ctx, 18, 12 + dy, 2, 2, P.contorno);
      px(ctx, 12, 12 + dy, 1, 1, "#ffffff");
      px(ctx, 18, 12 + dy, 1, 1, "#ffffff");
      px(ctx, 12, 10 + dy, 2, 1, tono(a.pelo, -0.2));
      px(ctx, 18, 10 + dy, 2, 1, tono(a.pelo, -0.2));
      px(ctx, 11, 15 + dy, 2, 1, "#e89a8a");
      px(ctx, 19, 15 + dy, 2, 1, "#e89a8a");
      px(ctx, 15, 16 + dy, 2, 1, tono(piel, -0.3));
    }
  }
  pelo(ctx, a, vista, dy);
}

/** Torso y brazos. `brazo`: balanceo (−2…2). `manos`: sentado, manos sobre la mesa. */
function torso(ctx: Ctx, a: Aspecto, vista: "frente" | "espalda" | "lado", dy: number, brazo: number, manos?: [number, number]) {
  const c = a.camiseta;
  const s = a.sombra;
  if (vista === "lado") {
    px(ctx, 11, 21 + dy, 10, 13, c);
    px(ctx, 11, 21 + dy, 2, 13, s);
    px(ctx, 11, 32 + dy, 10, 1, s);
    const bx = 14 + brazo;
    px(ctx, bx, 22 + dy, 4, 10, s);
    px(ctx, bx, 32 + dy, 4, 2, a.piel);
    return;
  }
  px(ctx, 9, 21 + dy, 14, 13, c);
  px(ctx, 20, 21 + dy, 3, 13, s);
  px(ctx, 9, 32 + dy, 14, 2, s);
  if (vista === "frente") {
    px(ctx, 13, 21 + dy, 6, 2, tono(c, 0.35)); // cuello de la camisa
    px(ctx, 15, 23 + dy, 2, 1, tono(c, 0.35));
    if (a.corbata) {
      px(ctx, 15, 22 + dy, 2, 8, a.corbata);
      px(ctx, 14, 29 + dy, 4, 1, tono(a.corbata, -0.3));
    }
  }
  if (manos) {
    // Antebrazos hacia la mesa.
    px(ctx, 6, 22 + dy, 3, 9, s);
    px(ctx, 23, 22 + dy, 3, 9, s);
    px(ctx, 8, 30 + dy + manos[0], 5, 3, a.piel);
    px(ctx, 19, 30 + dy + manos[1], 5, 3, a.piel);
    return;
  }
  px(ctx, 6, 22 + dy + brazo, 3, 10, s);
  px(ctx, 23, 22 + dy - brazo, 3, 10, s);
  px(ctx, 6, 32 + dy + brazo, 3, 3, a.piel);
  px(ctx, 23, 32 + dy - brazo, 3, 3, a.piel);
}

function piernas(ctx: Ctx, vista: "frente" | "espalda" | "lado", paso: number) {
  px(ctx, 9, 34, 14, 1, P.contorno); // cinturón
  if (vista === "lado") {
    if (paso === 0) {
      px(ctx, 12, 35, 8, 9, PANTALON);
      px(ctx, 12, 44, 10, 4, ZAPATO);
    } else {
      const delante = paso === 1 ? 16 : 10;
      const detras = paso === 1 ? 10 : 16;
      px(ctx, detras, 35, 6, 8, tono(PANTALON, -0.2));
      px(ctx, detras, 43, 7, 3, ZAPATO);
      px(ctx, delante, 35, 6, 9, PANTALON);
      px(ctx, delante, 44, 8, 4, ZAPATO);
    }
    return;
  }
  const izq = paso === 1 ? 2 : 0;
  const der = paso === 2 ? 2 : 0;
  px(ctx, 10, 35, 6, 9 - izq, PANTALON);
  px(ctx, 16, 35, 6, 9 - der, PANTALON);
  px(ctx, 15, 35, 2, 8, tono(PANTALON, -0.25));
  px(ctx, 9, 44 - izq, 7, 4, ZAPATO);
  px(ctx, 16, 44 - der, 7, 4, ZAPATO);
}

function fotograma(a: Aspecto, nombre: string): HTMLCanvasElement {
  const [c, ctx] = lienzo(ANCHO_PJ, ALTO_PJ);
  const [d, n] = nombre.split("-") as [Direccion | "sentado" | "espalda", string | undefined];
  const paso = Number(n ?? 0);
  if (d === "sentado") {
    torso(ctx, a, "frente", 0, 0, paso === 1 ? [-1, 1] : [1, -1]);
    cabeza(ctx, a, "frente", 0);
  } else if (d === "espalda") {
    torso(ctx, a, "espalda", 0, 0);
    cabeza(ctx, a, "espalda", 0);
  } else {
    const pose: Pose = { dy: paso === 0 ? 0 : -1, paso };
    const vista = d === "abajo" ? "frente" : d === "arriba" ? "espalda" : "lado";
    const brazo = paso === 0 ? 0 : paso === 1 ? 2 : -2;
    piernas(ctx, vista, pose.paso);
    torso(ctx, a, vista, pose.dy, vista === "lado" ? brazo * 1.5 : brazo);
    cabeza(ctx, a, vista, pose.dy);
    if (d === "izquierda") {
      // La izquierda es la derecha en espejo.
      const [e, ectx] = lienzo(ANCHO_PJ, ALTO_PJ);
      ectx.translate(ANCHO_PJ, 0);
      ectx.scale(-1, 1);
      ectx.drawImage(c, 0, 0);
      contornear(e);
      return e;
    }
  }
  contornear(c);
  return c;
}

/** Hoja de un personaje: FOTOGRAMAS_PJ en fila. */
export function dibujarPersonaje(a: Aspecto): Dibujo {
  const [c, ctx] = lienzo(ANCHO_PJ * FOTOGRAMAS_PJ.length, ALTO_PJ);
  const fotogramas: Recorte[] = FOTOGRAMAS_PJ.map((f, i) => {
    ctx.drawImage(fotograma(a, f), i * ANCHO_PJ, 0);
    return [f, i * ANCHO_PJ, 0, ANCHO_PJ, ALTO_PJ];
  });
  return { canvas: c, fotogramas };
}
