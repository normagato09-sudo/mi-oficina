import * as Phaser from "phaser";
import type { Aspecto } from "@/components/oficina/Personaje";
import { COLOR_LUZ, type Luz } from "@/lib/estado";
import type { Despacho } from "@/lib/tipos";
import { pintarAlfombra } from "./dibujos/alfombra";
import { dibujarAscensor } from "./dibujos/ascensor";
import { dibujarEncimeraCafe } from "./dibujos/cafe";
import { P, T, lienzo, sombraSuave, type Dibujo } from "./dibujos/comun";
import { pintarCristalVertical, dibujarCristalHorizontal } from "./dibujos/cristal";
import { dibujarEscalera } from "./dibujos/escalera";
import { dibujarEscritorio } from "./dibujos/escritorio";
import { dibujarEstanteria } from "./dibujos/estanteria";
import { dibujarImpresora } from "./dibujos/impresora";
import { dibujarMesaRedonda, dibujarMesita, dibujarTaburete } from "./dibujos/mesaCafe";
import { dibujarMesaDireccion, dibujarMesaReunion } from "./dibujos/mesaReunion";
import { dibujarMostrador } from "./dibujos/mostrador";
import { pintarLogo, pintarMuroArriba, pintarMuroCara, pintarVentanal } from "./dibujos/muro";
import { ALTO_PJ, DIRECCIONES, dibujarPersonaje, type Direccion } from "./dibujos/personaje";
import { dibujarPlanta } from "./dibujos/planta";
import { dibujarSilla, dibujarSillon } from "./dibujos/silla";
import { dibujarSofa } from "./dibujos/sofa";
import { pintarLuzTecho, pintarLuzVentanal, pintarSombraMuro, pintarSuelo } from "./dibujos/suelo";
import {
  ALTO, ANCHO, ASCENSOR, ESCALERA, LLEGADA, MURO_ARRIBA, PUNTOS_ASCENSOR, huella, planta as datosPlanta,
  type Mueble, type Planta, type Puesto,
} from "./edificio";

/** Lo que el juego necesita saber de cada agente (lo calcula el servidor, como en la vista clásica). */
export type AgenteJuego = {
  id: string;
  nombre: string;
  despacho: Despacho;
  planta: number;
  /** Jefe de su planta (o el Director, en Dirección): se sienta en el despacho acristalado. */
  jefe: boolean;
  luz: Luz;
  texto: string;
  trabajando: boolean;
  inactivo: boolean;
  aspecto: Aspecto;
};

export type OpcionesJuego = {
  agentes: AgenteJuego[];
  /** Abre la ficha de un agente (la misma de la vista clásica). */
  abrirFicha: (agenteId: string) => void;
  /** Hay una ficha, el menú del ascensor u otra ventana abierta: el personaje no se mueve. */
  bloqueado: () => boolean;
  /** He pulsado E junto al ascensor o la escalera. */
  abrirAscensor: (plantaActual: number) => void;
  /** He llegado a otra planta. */
  alCambiarPlanta: (n: number) => void;
};

export type Juego = {
  actualizar: (agentes: AgenteJuego[]) => void;
  irAPlanta: (n: number) => void;
  destruir: () => void;
};

/** Mi personaje (la CEO). */
const ASPECTO_CEO: Aspecto = { camiseta: "#9b2c3c", sombra: "#76202d", pelo: "#5a3a26", piel: "#f1c7a1", peinado: "largo" };
/** Planta en la que aparezco al abrir la app. */
const PLANTA_INICIAL = 4;

const VELOCIDAD = 150;
const VELOCIDAD_AGENTE = 115;
/** Distancia (px) para hablar con un agente o usar el ascensor. */
const ALCANCE = 2.3 * T;
const ALCANCE_ASCENSOR = 1.4 * T;
const ZOOM_MAX = 4;
/** Los textos se dibujan al doble y se reducen, para que se lean nítidos con zoom. */
const ESCALA_TEXTO = 0.5;
/** Profundidad de las etiquetas (siempre encima). */
const ENCIMA = 100000;

const hex = (color: string) => Phaser.Display.Color.HexStringToColor(color).color;

/** Un sitio donde está (o va) un agente: px de los pies, hacia dónde mira y si está sentado. */
type Sitio = { x: number; y: number; casilla: { x: number; y: number }; postura: "frente" | "espalda" | "pie"; profundidad: number };

type Vista = {
  sprite: Phaser.GameObjects.Sprite;
  halo: Phaser.GameObjects.Image;
  haloTween?: Phaser.Tweens.Tween;
  etiqueta: Phaser.GameObjects.Container;
  fondo: Phaser.GameObjects.Graphics;
  texto: Phaser.GameObjects.Text;
};

type Agente = {
  datos: AgenteJuego;
  /** Su mesa (o donde se queda si no hay mesa libre). */
  casa: Sitio;
  /** Donde está sentado o hacia donde va. */
  destino: Sitio;
  /** Asiento de la mesa de reunión que ocupa (o null). */
  asiento: number | null;
  x: number;
  y: number;
  camino: { x: number; y: number }[];
  dir: Direccion;
  vista?: Vista;
};

/** Dónde aparezco: sentada en mi sillón, delante del ascensor o en un punto concreto. */
type Aparecer = "sillon" | "ascensor" | { x: number; y: number; dir: Direccion };
/** Posición guardada (al volver a la vista de juego sigo donde estaba). */
let guardado: { planta: number; donde: Aparecer } | null = null;
type Cerca = { tipo: "agente"; ag: Agente } | { tipo: "ascensor" } | null;

class Oficina extends Phaser.Scene {
  private op!: OpcionesJuego;
  private planta!: Planta;
  private solido: boolean[][] = [];
  private agentes = new Map<string, Agente>();
  private objetos: Phaser.GameObjects.GameObject[] = [];
  private yo!: Phaser.GameObjects.Sprite;
  private dir: Direccion = "abajo";
  private sentada = false;
  private teclas = new Set<string>();
  private cerca: Cerca = null;
  private aviso!: Phaser.GameObjects.Container;
  private avisoTexto!: Phaser.GameObjects.Text;
  private avisoFondo!: Phaser.GameObjects.Graphics;
  private alerta: Phaser.GameObjects.Container | null = null;
  private zoomObjetivo = 2;
  private quitarEscuchas: (() => void) | null = null;

  constructor() {
    super("oficina");
  }

  init(op: OpcionesJuego) {
    this.op = op;
    this.agentes = new Map();
    this.objetos = [];
    this.teclas = new Set();
    this.cerca = null;
    this.alerta = null;
  }

  create() {
    this.colocarAgentes(this.op.agentes);
    this.ponerAviso();
    this.mostrarPlanta(guardado?.planta ?? PLANTA_INICIAL, guardado?.donde ?? "sillon");
    this.prepararCamara();
    this.escuchar();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.quitarEscuchas?.());
  }

  /* ───────────── Texturas ───────────── */

  private textura(clave: string, dibujar: () => Dibujo): string {
    if (this.textures.exists(clave)) return clave;
    const d = dibujar();
    const t = this.textures.addCanvas(clave, d.canvas)!;
    for (const [nombre, x, y, w, h] of d.fotogramas ?? []) t.add(nombre, 0, x, y, w, h);
    return clave;
  }

  /** Textura y animaciones de un personaje (se reutilizan mientras no cambie su aspecto). */
  private personaje(aspecto: Aspecto): string {
    const clave = `pj-${JSON.stringify(aspecto)}`;
    if (this.textures.exists(clave)) return clave;
    this.textura(clave, () => dibujarPersonaje(aspecto));
    for (const d of DIRECCIONES)
      this.anims.create({ key: `${clave}-andar-${d}`, frames: [1, 0, 2, 0].map((n) => ({ key: clave, frame: `${d}-${n}` })), frameRate: 8, repeat: -1 });
    this.anims.create({ key: `${clave}-teclear`, frames: [{ key: clave, frame: "sentado-0" }, { key: clave, frame: "sentado-1" }], frameRate: 4, repeat: -1 });
    return clave;
  }

  private halo(): string {
    return this.textura("halo", () => {
      const [c, ctx] = lienzo(96, 48);
      sombraSuave(ctx, 48, 24, 46, 22, 1);
      // La sombra es oscura: se usa solo su forma (se tiñe del color de la luz).
      const img = ctx.getImageData(0, 0, 96, 48);
      for (let i = 0; i < img.data.length; i += 4) img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      ctx.putImageData(img, 0, 0);
      return { canvas: c };
    });
  }

  /* ───────────── Los agentes (en todas las plantas) ───────────── */

  /** Sitio de una mesa de trabajo: sentado detrás, de cara. */
  private sitioPuesto(p: Puesto): Sitio {
    return { x: (p.x + 1) * T, y: p.y * T + 50, casilla: { x: p.x, y: p.y }, postura: "frente", profundidad: (p.y + 1) * T };
  }

  private sitioAsiento(pl: Planta, i: number): Sitio {
    const a = pl.reunion[i]!;
    return a.mira === "abajo"
      ? { x: (a.x + 0.5) * T, y: a.y * T + 50, casilla: a, postura: "frente", profundidad: (a.y + 1) * T }
      : { x: (a.x + 0.5) * T, y: a.y * T + 42, casilla: a, postura: "espalda", profundidad: (a.y + 1) * T };
  }

  /** Reparte las mesas de cada planta: el jefe a su despacho y los demás, por orden, a las mesas. */
  private colocarAgentes(lista: AgenteJuego[]) {
    const anteriores = this.agentes;
    this.agentes = new Map();
    const porPlanta = new Map<number, AgenteJuego[]>();
    for (const a of lista) porPlanta.set(a.planta, [...(porPlanta.get(a.planta) ?? []), a]);
    for (const [n, suyos] of porPlanta) {
      const pl = datosPlanta(n);
      const libres = [...pl.puestos];
      let jefeLibre = !!pl.jefe;
      suyos.forEach((datos, i) => {
        let casa: Sitio;
        if (datos.jefe && jefeLibre) {
          jefeLibre = false;
          casa = this.sitioPuesto(pl.jefe!);
        } else if (libres.length) casa = this.sitioPuesto(libres.shift()!);
        else {
          // Sin mesa libre: de pie en el núcleo, junto al ascensor.
          const x = 1 + (i % 4) * 2;
          casa = { x: (x + 0.5) * T, y: 6 * T + 26, casilla: { x, y: 6 }, postura: "pie", profundidad: 6 * T + 26 };
        }
        const antes = anteriores.get(datos.id);
        const ag: Agente = { datos, casa, destino: casa, asiento: null, x: casa.x, y: casa.y, camino: [], dir: "abajo" };
        // Si ya estaba en la mesa de reunión de esta misma planta, sigue ahí.
        if (antes && antes.datos.planta === datos.planta && antes.asiento !== null) {
          ag.asiento = antes.asiento;
          ag.destino = this.sitioAsiento(pl, antes.asiento);
          ag.x = ag.destino.x;
          ag.y = ag.destino.y;
        }
        this.agentes.set(datos.id, ag);
      });
    }
    for (const ag of this.agentes.values()) this.decidir(ag, false);
  }

  /** ¿Trabaja? A la mesa de reunión de su planta. ¿Ha terminado? De vuelta a su mesa. */
  private decidir(ag: Agente, andando: boolean) {
    const pl = datosPlanta(ag.datos.planta);
    const quiere = ag.datos.trabajando && !ag.datos.inactivo && pl.reunion.length > 0;
    if (quiere && ag.asiento === null) {
      const ocupados = new Set([...this.agentes.values()].filter((o) => o.datos.planta === pl.n && o.asiento !== null).map((o) => o.asiento));
      const libre = pl.reunion.findIndex((_, i) => !ocupados.has(i));
      if (libre < 0) return;
      ag.asiento = libre;
      this.ir(ag, this.sitioAsiento(pl, libre), andando);
    } else if (!quiere && ag.asiento !== null) {
      ag.asiento = null;
      this.ir(ag, ag.casa, andando);
    }
  }

  private ir(ag: Agente, destino: Sitio, andando: boolean) {
    ag.destino = destino;
    const desde = this.casillaDe(ag);
    const camino = andando && ag.vista && ag.datos.planta === this.planta?.n ? this.buscarCamino(desde, destino.casilla) : null;
    if (!camino) {
      ag.x = destino.x;
      ag.y = destino.y;
      ag.camino = [];
      if (ag.vista) this.posarAgente(ag);
      return;
    }
    ag.camino = camino.map((c) => ({ x: (c.x + 0.5) * T, y: (c.y + 0.5) * T + 12 }));
    ag.camino.push({ x: destino.x, y: destino.y });
  }

  private casillaDe(ag: Agente) {
    if (ag.camino.length === 0) return ag.destino.casilla;
    return { x: Math.floor(ag.x / T), y: Math.floor((ag.y - 12) / T) };
  }

  /** Camino más corto por casillas libres (las de salida y llegada pueden ser sillas). */
  private buscarCamino(desde: { x: number; y: number }, hasta: { x: number; y: number }): { x: number; y: number }[] | null {
    const clave = (x: number, y: number) => y * ANCHO + x;
    const previo = new Map<number, number>();
    const cola = [clave(desde.x, desde.y)];
    previo.set(cola[0]!, -1);
    const meta = clave(hasta.x, hasta.y);
    while (cola.length) {
      const k = cola.shift()!;
      if (k === meta) break;
      const x = k % ANCHO;
      const y = Math.floor(k / ANCHO);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        const nk = clave(nx, ny);
        if (nx < 0 || ny < 0 || nx >= ANCHO || ny >= ALTO || previo.has(nk)) continue;
        if (this.solido[ny]![nx] && nk !== meta) continue;
        previo.set(nk, k);
        cola.push(nk);
      }
    }
    if (!previo.has(meta)) return null;
    const camino: { x: number; y: number }[] = [];
    for (let k = meta; k !== -1; k = previo.get(k)!) camino.unshift({ x: k % ANCHO, y: Math.floor(k / ANCHO) });
    return camino.slice(1, -1);
  }

  /* ───────────── Una planta ───────────── */

  /** Quita la planta que se ve y dibuja la `n`. */
  private mostrarPlanta(n: number, donde: Aparecer) {
    for (const o of this.objetos) o.destroy();
    this.objetos = [];
    for (const ag of this.agentes.values()) {
      ag.vista = undefined;
      // Quien iba andando por la planta que dejo llega a su sitio.
      if (ag.camino.length) {
        ag.camino = [];
        ag.x = ag.destino.x;
        ag.y = ag.destino.y;
      }
    }
    this.planta = datosPlanta(n);
    this.pintarFondo();
    this.ponerMuebles();
    for (const ag of this.agentes.values()) if (ag.datos.planta === n) this.crearVista(ag);
    this.ponerYo(donde);
    this.pintarAlerta();
    this.cerca = null;
    this.aviso.setVisible(false);
    this.op.alCambiarPlanta(n);
  }

  private añadir<O extends Phaser.GameObjects.GameObject>(o: O): O {
    this.objetos.push(o);
    return o;
  }

  /** Suelos, muros, ventanales, cristal vertical, sombras y luces en un solo dibujo (se guarda por planta). */
  private pintarFondo() {
    const pl = this.planta;
    const clave = `fondo-${pl.n}`;
    this.solido = Array.from({ length: ALTO }, (_, y) =>
      Array.from({ length: ANCHO }, (_, x) => x === 0 || x === ANCHO - 1 || y < MURO_ARRIBA || y === ALTO - 1),
    );
    for (const v of pl.cristalesV) for (let y = v.y1; y <= v.y2; y++) this.solido[y]![v.x] = true;
    for (const h of pl.cristalesH) for (let x = h.x1; x <= h.x2; x++) this.solido[h.y]![x] = true;

    if (!this.textures.exists(clave)) {
      const [c, ctx] = lienzo(ANCHO * T, ALTO * T);
      for (const z of pl.zonas)
        for (let y = z.y1; y <= z.y2; y++) for (let x = z.x1; x <= z.x2; x++) pintarSuelo(ctx, x * T, y * T, z.suelo, z.color, x, y);
      for (const a of pl.alfombras) pintarAlfombra(ctx, a.x1 * T + 4, a.y1 * T + 4, (a.x2 - a.x1 + 1) * T - 8, (a.y2 - a.y1 + 1) * T - 8, a.color);
      // Muros: arriba con ventanales (salvo el núcleo y el logo), a los lados y abajo solo se ve su parte de arriba.
      pintarMuroCara(ctx, 0, 0, 10 * T);
      if (pl.logo !== undefined) {
        pintarVentanal(ctx, 10 * T, 0, (pl.logo - 13) * T, pl.n);
        pintarMuroCara(ctx, (pl.logo - 3) * T, 0, 6 * T);
        pintarLogo(ctx, pl.logo * T, 0);
        pintarVentanal(ctx, (pl.logo + 3) * T, 0, (ANCHO - pl.logo - 4) * T, pl.n);
      } else pintarVentanal(ctx, 10 * T, 0, (ANCHO - 11) * T, pl.n);
      pintarMuroArriba(ctx, 0, 0, T, ALTO * T);
      pintarMuroArriba(ctx, (ANCHO - 1) * T, 0, T, ALTO * T);
      pintarMuroArriba(ctx, 0, (ALTO - 1) * T, ANCHO * T, T);
      if (pl.n === 0) {
        // Puerta de entrada de cristal, abajo.
        ctx.fillStyle = P.cristalMarco;
        ctx.fillRect(18 * T, (ALTO - 1) * T + 4, 4 * T, T - 8);
        ctx.fillStyle = "#cfe6f5";
        ctx.fillRect(18 * T + 4, (ALTO - 1) * T + 8, 2 * T - 6, T - 16);
        ctx.fillRect(20 * T + 2, (ALTO - 1) * T + 8, 2 * T - 6, T - 16);
      }
      pintarSombraMuro(ctx, T, MURO_ARRIBA * T, (ANCHO - 2) * T);
      pintarLuzVentanal(ctx, 10 * T, MURO_ARRIBA * T, (ANCHO - 11) * T, 5 * T);
      for (const v of pl.cristalesV) pintarCristalVertical(ctx, v.x * T, v.y1 * T, (v.y2 - v.y1 + 1) * T);
      // Sombras suaves bajo los muebles y las mesas.
      for (const m of pl.muebles) {
        const h = huella(m);
        sombraSuave(ctx, ((h.x1 + h.x2 + 1) / 2) * T, (h.y2 + 1) * T - 2, ((h.x2 - h.x1 + 1) * T) / 2 + 4, 7);
      }
      // Luces de techo.
      for (let y = 6; y < ALTO - 1; y += 6) for (let x = 4; x < ANCHO - 1; x += 6) pintarLuzTecho(ctx, x * T, y * T, 3.2 * T);
      this.textures.addCanvas(clave, c);
    }
    this.añadir(this.add.image(0, 0, clave).setOrigin(0).setDepth(-10));

    // Ascensor (con el número de la planta) y escalera.
    this.añadir(this.add.image(ASCENSOR.x * T, 0, this.textura("ascensor", dibujarAscensor)).setOrigin(0).setDepth(-8));
    this.añadir(this.texto(String(this.planta.n), 18, "#f5b841", "800").setOrigin(0.5).setPosition((ASCENSOR.x + 1) * T, 12.5).setDepth(-7));
    this.añadir(this.add.image(ESCALERA.x * T, ESCALERA.y * T, this.textura("escalera", dibujarEscalera)).setOrigin(0).setDepth(-8));
    this.marcar(ESCALERA.x, ESCALERA.y, ESCALERA.ancho, ESCALERA.alto);

    // Paredes de cristal horizontales: tapan a quien está detrás.
    for (const h of pl.cristalesH) {
      const casillas = h.x2 - h.x1 + 1;
      const img = this.add.image(h.x1 * T, (h.y + 1) * T, this.textura(`cristal-${casillas}`, () => dibujarCristalHorizontal(casillas)));
      this.añadir(img.setOrigin(0, 1).setDepth((h.y + 1) * T - 4));
    }
    for (const r of pl.rotulos)
      this.añadir(this.texto(r.texto, 22, pl.n === 0 ? P.contorno : "#ffffff", "800").setPosition(r.x * T, r.y * T).setOrigin(0.5).setAlpha(0.45).setDepth(-5));
  }

  private marcar(x: number, y: number, ancho: number, alto: number) {
    for (let j = y; j < y + alto; j++) for (let i = x; i < x + ancho; i++) if (this.solido[j]?.[i] !== undefined) this.solido[j]![i] = true;
  }

  /** Un dibujo apoyado en el suelo: centrado en su huella y con la base en su borde de abajo. */
  private poner(clave: string, cx: number, abajo: number, profundidad = abajo) {
    return this.añadir(this.add.image(cx, abajo, clave).setOrigin(0.5, 1).setDepth(profundidad));
  }

  private ponerMuebles() {
    const pl = this.planta;
    for (const m of pl.muebles) {
      const h = huella(m);
      const cx = ((h.x1 + h.x2 + 1) / 2) * T;
      const abajo = (h.y2 + 1) * T;
      if (m.tipo !== "sillon") this.marcar(h.x1, h.y1, h.x2 - h.x1 + 1, h.y2 - h.y1 + 1);
      this.ponerMueble(m, cx, abajo);
    }
    // Mesas de trabajo (solo las que tienen a alguien) y el despacho del jefe.
    const ocupados = new Set([...this.agentes.values()].filter((a) => a.datos.planta === pl.n).map((a) => `${a.casa.casilla.x},${a.casa.casilla.y}`));
    const mesas = [...pl.puestos.filter((p) => ocupados.has(`${p.x},${p.y}`)), ...(pl.jefe ? [pl.jefe] : [])];
    mesas.forEach((p, i) => {
      const cx = (p.x + 1) * T;
      this.marcar(p.x, p.y, 2, 1);
      this.poner(this.textura(`silla-arriba`, () => dibujarSilla("arriba")), cx, (p.y + 1) * T + 4, (p.y + 1) * T - 1);
      if (p.sinMesa) return;
      this.marcar(p.x, p.y + 1, 2, 1);
      this.poner(this.textura("sombra-mesa", () => {
        const [c, ctx] = lienzo(80, 16);
        sombraSuave(ctx, 40, 8, 38, 7);
        return { canvas: c };
      }), cx, (p.y + 2) * T + 6, -3);
      const monitores = (i % 3 === 1 ? 2 : 1) as 1 | 2;
      const extra = (["taza", "papeles", "planta", "taza"] as const)[i % 4];
      this.poner(this.textura(`escritorio-${p.madera ? "m" : "b"}-${monitores}-${extra}`, () => dibujarEscritorio({ madera: p.madera, monitores, extra })), cx, (p.y + 2) * T);
    });
    // Sillas de la mesa de reunión.
    for (const a of pl.reunion) {
      this.marcar(a.x, a.y, 1, 1);
      const cx = (a.x + 0.5) * T;
      if (a.mira === "abajo") this.poner(this.textura("silla-arriba", () => dibujarSilla("arriba")), cx, (a.y + 1) * T + 4, (a.y + 1) * T - 1);
      else this.poner(this.textura("silla-abajo", () => dibujarSilla("abajo")), cx, (a.y + 1) * T + 6, (a.y + 1) * T + 1);
    }
  }

  private ponerMueble(m: Mueble, cx: number, abajo: number) {
    switch (m.tipo) {
      case "escritorio":
        this.poner(this.textura(`escritorio-libre`, () => dibujarEscritorio(m)), cx, abajo);
        break;
      case "mesaReunion":
        this.poner(this.textura(`mesaReunion-${m.casillas}`, () => dibujarMesaReunion(m.casillas)), cx, abajo);
        break;
      case "mesaDireccion":
        this.poner(this.textura("mesaDireccion", dibujarMesaDireccion), cx, abajo);
        break;
      case "sillon":
        this.poner(this.textura("sillon", dibujarSillon), cx, abajo + 4, abajo - 1);
        break;
      case "sofa":
        this.poner(this.textura(`sofa-${m.casillas}-${m.color}-${m.mira}`, () => dibujarSofa(m.casillas, m.color, m.mira)), cx, abajo);
        break;
      case "estanteria":
        this.poner(this.textura(`estanteria-${m.casillas}-${m.x}`, () => dibujarEstanteria(m.casillas, m.x)), cx, abajo);
        break;
      case "planta":
        this.poner(this.textura(`planta-${m.alta ? "alta" : "frondosa"}`, () => dibujarPlanta(m.alta ? "alta" : "frondosa")), cx, abajo);
        break;
      case "encimeraCafe":
        this.poner(this.textura(`cafe-${m.casillas}`, () => dibujarEncimeraCafe(m.casillas)), cx, abajo);
        break;
      case "impresora":
        this.poner(this.textura("impresora", dibujarImpresora), cx, abajo);
        break;
      case "mostrador":
        this.poner(this.textura(`mostrador-${m.casillas}`, () => dibujarMostrador(m.casillas)), cx, abajo);
        break;
      case "mesaRedonda":
        this.poner(this.textura("mesaRedonda", dibujarMesaRedonda), cx, abajo - 2);
        break;
      case "taburete":
        this.poner(this.textura(`taburete-${m.color ?? ""}`, () => dibujarTaburete(m.color)), cx, abajo - 4);
        break;
      case "mesita":
        this.poner(this.textura("mesita", dibujarMesita), cx, abajo);
        break;
    }
  }

  /** Texto nítido: se dibuja al doble y se reduce. */
  private texto(texto: string, tamano: number, color: string, peso = "600") {
    const t = this.add.text(0, 0, texto, { fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", fontSize: `${tamano}px`, fontStyle: peso, color });
    t.setScale(ESCALA_TEXTO);
    t.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    return t;
  }

  /* ───────────── Agentes visibles ───────────── */

  private crearVista(ag: Agente) {
    const clave = this.personaje(ag.datos.aspecto);
    const sprite = this.añadir(this.add.sprite(ag.x, ag.y, clave, "sentado-0").setOrigin(0.5, 1));
    sprite.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.op.abrirFicha(ag.datos.id));
    const halo = this.añadir(this.add.image(ag.x, ag.y, this.halo()).setDepth(-2).setBlendMode(Phaser.BlendModes.ADD));
    const texto = this.texto(ag.datos.nombre, 22, "#ffffff", "700").setOrigin(0, 0.5);
    const fondo = this.add.graphics();
    const etiqueta = this.añadir(this.add.container(0, 0, [fondo, texto]).setDepth(ENCIMA));
    etiqueta.setInteractive(new Phaser.Geom.Rectangle(-40, -8, 80, 16), Phaser.Geom.Rectangle.Contains).on("pointerdown", () => this.op.abrirFicha(ag.datos.id));
    ag.vista = { sprite, halo, etiqueta, fondo, texto };
    this.pintarAgente(ag);
    this.posarAgente(ag);
  }

  /** Nombre, luz de estado y aspecto. */
  private pintarAgente(ag: Agente) {
    const v = ag.vista;
    if (!v) return;
    const { datos } = ag;
    const color = hex(COLOR_LUZ[datos.luz]);
    v.texto.setText(datos.nombre).setAlpha(datos.inactivo ? 0.6 : 1);
    const ancho = v.texto.width * ESCALA_TEXTO + 22;
    v.fondo.clear();
    v.fondo.fillStyle(0x1b1726, datos.inactivo ? 0.6 : 0.88).fillRoundedRect(-ancho / 2, -8, ancho, 16, 8);
    if (datos.luz !== "apagada") v.fondo.fillStyle(color, 0.35).fillCircle(-ancho / 2 + 9, 0, 5.5);
    v.fondo.fillStyle(color, 1).fillCircle(-ancho / 2 + 9, 0, 3.5);
    v.texto.setPosition(-ancho / 2 + 16, 0);
    (v.etiqueta.input!.hitArea as Phaser.Geom.Rectangle).setTo(-ancho / 2, -8, ancho, 16);

    v.haloTween?.remove();
    v.halo.setVisible(datos.luz !== "apagada").setTint(color).setAlpha(0.35);
    if (datos.luz !== "apagada")
      v.haloTween = this.tweens.add({ targets: v.halo, alpha: 0.75, duration: datos.luz === "rojo" ? 520 : 1100, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    if (datos.inactivo) v.sprite.setTint(0x9aa0ad).setAlpha(0.75);
    else v.sprite.clearTint().setAlpha(1);
  }

  /** Postura y posición de un agente quieto en su sitio. */
  private posarAgente(ag: Agente) {
    const v = ag.vista;
    if (!v) return;
    const clave = this.personaje(ag.datos.aspecto);
    const s = ag.destino;
    v.sprite.setPosition(ag.x, ag.y).setDepth(s.profundidad);
    if (s.postura === "frente") {
      // En su mesa teclea si trabaja; en la mesa de reunión también.
      if (ag.datos.trabajando && !ag.datos.inactivo) v.sprite.play(`${clave}-teclear`, true);
      else v.sprite.stop().setTexture(clave, "sentado-0");
    } else if (s.postura === "espalda") v.sprite.stop().setTexture(clave, "espalda");
    else v.sprite.stop().setTexture(clave, "abajo-0");
    this.seguirAgente(ag);
  }

  /** Etiqueta y brillo, encima y debajo del agente. */
  private seguirAgente(ag: Agente) {
    const v = ag.vista!;
    // En la mesa de reunión, los nombres de asientos vecinos se alternan de altura para no taparse.
    const alterna = !ag.camino.length && ag.asiento !== null && ag.destino.casilla.x % 2 === 1 ? 16 : 0;
    v.etiqueta.setPosition(ag.x, ag.y - ALTO_PJ - 8 - alterna);
    v.halo.setPosition(ag.x, ag.y - 6);
  }

  /** Nuevos datos (la página se ha refrescado). Si cambia el equipo o alguien cambia de planta, se recoloca todo. */
  actualizar(agentes: AgenteJuego[]) {
    const mismos = agentes.length === this.agentes.size && agentes.every((a) => {
      const ag = this.agentes.get(a.id);
      return ag && ag.datos.planta === a.planta && ag.datos.jefe === a.jefe;
    });
    if (!mismos) {
      this.op = { ...this.op, agentes };
      this.colocarAgentes(agentes);
      this.mostrarPlanta(this.planta.n, this.dondeEstoy());
      return;
    }
    this.op = { ...this.op, agentes };
    for (const a of agentes) {
      const ag = this.agentes.get(a.id)!;
      ag.datos = a;
      this.pintarAgente(ag);
      this.decidir(ag, true);
      if (ag.vista && !ag.camino.length) this.posarAgente(ag);
    }
    this.pintarAlerta();
    this.cerca = null;
  }

  /* ───────────── Ascensor: aviso si me necesitan en otra planta ───────────── */

  private pintarAlerta() {
    this.alerta?.destroy();
    this.alerta = null;
    const otras = [...new Set([...this.agentes.values()].filter((a) => a.datos.luz === "rojo" && a.datos.planta !== this.planta.n).map((a) => a.datos.planta))].sort();
    if (!otras.length) return;
    const t = this.texto(`Te necesitan en ${otras.map((n) => `P${n}`).join(", ")}`, 20, "#ffffff", "700").setOrigin(0, 0.5);
    const ancho = t.width * ESCALA_TEXTO + 22;
    const g = this.add.graphics();
    g.fillStyle(0xda1415, 1).fillRoundedRect(-ancho / 2, -8, ancho, 16, 8);
    g.fillStyle(0xffffff, 1).fillCircle(-ancho / 2 + 9, 0, 3);
    t.setPosition(-ancho / 2 + 16, 0);
    this.alerta = this.add.container((ASCENSOR.x + 1) * T, 1.55 * T, [g, t]).setDepth(ENCIMA - 1);
    this.añadir(this.alerta);
    this.tweens.add({ targets: this.alerta, scale: 1.08, duration: 520, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  /* ───────────── Yo ───────────── */

  private ponerYo(donde: Aparecer) {
    const clave = this.personaje(ASPECTO_CEO);
    this.yo = this.añadir(this.add.sprite(0, 0, clave, "abajo-0").setOrigin(0.5, 1));
    const sillon = this.planta.sillon;
    if (typeof donde === "object" && this.libre(donde.x, donde.y)) {
      this.sentada = false;
      this.dir = donde.dir;
      this.yo.setPosition(donde.x, donde.y).setFrame(`${donde.dir}-0`).setDepth(donde.y);
    } else if (donde === "sillon" && sillon) {
      // Al abrir la oficina estoy sentada en mi sillón.
      this.sentada = true;
      this.yo.setPosition((sillon.x + 0.5) * T, sillon.y * T + 50).setFrame("sentado-0").setDepth((sillon.y + 1) * T);
    } else {
      this.sentada = false;
      this.dir = "abajo";
      this.yo.setPosition((LLEGADA.x + 0.5) * T, LLEGADA.y * T + 26).setFrame("abajo-0").setDepth(LLEGADA.y * T + 26);
    }
    this.cameras.main.startFollow(this.yo, true, 0.12, 0.12, 0, ALTO_PJ / 2);
    this.cameras.main.centerOn(this.yo.x, this.yo.y - ALTO_PJ / 2);
  }

  private dondeEstoy(): Aparecer {
    return this.sentada ? "sillon" : { x: this.yo.x, y: this.yo.y, dir: this.dir };
  }

  guardarPos() {
    if (this.yo?.active) guardado = { planta: this.planta.n, donde: this.dondeEstoy() };
  }

  /** ¿Caben mis pies (14 × 6 px) en (x, y)? */
  private libre(x: number, y: number): boolean {
    for (const [px, py] of [
      [x - 7, y - 6],
      [x + 6, y - 6],
      [x - 7, y - 1],
      [x + 6, y - 1],
    ] as const) {
      if (this.solido[Math.floor(py / T)]?.[Math.floor(px / T)] !== false) return false;
    }
    return true;
  }

  /** Voy a otra planta (después de la animación del ascensor). */
  irAPlanta(n: number) {
    this.teclas.clear();
    this.mostrarPlanta(n, "ascensor");
  }

  /* ───────────── Aviso "Pulsa E" ───────────── */

  private ponerAviso() {
    this.avisoFondo = this.add.graphics();
    this.avisoTexto = this.texto("", 20, "#1b1726", "700").setOrigin(0, 0.5);
    this.aviso = this.add.container(0, 0, [this.avisoFondo, this.avisoTexto]).setDepth(ENCIMA + 1).setVisible(false);
  }

  private mostrarAviso(texto: string, x: number, y: number) {
    this.avisoTexto.setText(texto);
    const ancho = this.avisoTexto.width * ESCALA_TEXTO + 14;
    this.avisoFondo.clear();
    this.avisoFondo.fillStyle(0xf5b841, 1).fillRoundedRect(-ancho / 2, -8, ancho, 16, 5);
    this.avisoFondo.fillTriangle(-4, 7.5, 4, 7.5, 0, 12);
    this.avisoTexto.setPosition(-ancho / 2 + 7, 0);
    this.aviso.setPosition(x, y).setVisible(true);
  }

  /* ───────────── Cámara y teclado ───────────── */

  private zoomMinimo() {
    const { width, height } = this.scale;
    return Math.min(width / (ANCHO * T), height / (ALTO * T));
  }

  private prepararCamara() {
    const cam = this.cameras.main;
    cam.setRoundPixels(true);
    this.zoomObjetivo = Phaser.Math.Clamp(this.scale.height / (13 * T), this.zoomMinimo(), ZOOM_MAX);
    cam.setZoom(this.zoomObjetivo);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.alRedimensionar, this);
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => this.zoom(dy > 0 ? 1 / 1.15 : 1.15));
  }

  private alRedimensionar() {
    this.zoomObjetivo = Phaser.Math.Clamp(this.zoomObjetivo, this.zoomMinimo(), ZOOM_MAX);
  }

  private zoom(factor: number) {
    this.zoomObjetivo = Phaser.Math.Clamp(this.zoomObjetivo * factor, this.zoomMinimo(), ZOOM_MAX);
  }

  private escuchar() {
    const editable = (e: Event) => {
      const t = e.target;
      return t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(t.tagName));
    };
    const MOVER = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"]);
    const abajo = (e: KeyboardEvent) => {
      // Mientras escribo en una ficha o formulario, las teclas son para el texto.
      if (editable(e) || this.op.bloqueado() || e.ctrlKey || e.metaKey || e.altKey) return;
      if (MOVER.has(e.code)) {
        this.teclas.add(e.code);
        e.preventDefault();
      } else if (e.code === "KeyE" && !e.repeat) {
        if (this.cerca?.tipo === "agente") this.op.abrirFicha(this.cerca.ag.datos.id);
        else if (this.cerca?.tipo === "ascensor") {
          this.teclas.clear();
          this.op.abrirAscensor(this.planta.n);
        }
      } else if (e.key === "+" || e.code === "NumpadAdd" || e.code === "Equal") this.zoom(1.25);
      else if (e.key === "-" || e.code === "NumpadSubtract" || e.code === "Minus") this.zoom(1 / 1.25);
    };
    const arriba = (e: KeyboardEvent) => this.teclas.delete(e.code);
    const soltarTodo = () => this.teclas.clear();
    window.addEventListener("keydown", abajo);
    window.addEventListener("keyup", arriba);
    window.addEventListener("blur", soltarTodo);
    this.quitarEscuchas = () => {
      window.removeEventListener("keydown", abajo);
      window.removeEventListener("keyup", arriba);
      window.removeEventListener("blur", soltarTodo);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.alRedimensionar, this);
    };
  }

  /* ───────────── Cada fotograma ───────────── */

  update(_t: number, delta: number) {
    const dt = Math.min(delta, 50) / 1000;
    const cam = this.cameras.main;
    if (Math.abs(cam.zoom - this.zoomObjetivo) > 0.001) cam.setZoom(cam.zoom + (this.zoomObjetivo - cam.zoom) * Math.min(1, delta / 90));
    // Si la planta cabe entera en un sentido, queda centrada en él.
    const sobraX = Math.max(0, cam.width / cam.zoom - ANCHO * T) / 2;
    const sobraY = Math.max(0, cam.height / cam.zoom - ALTO * T) / 2;
    cam.setBounds(-sobraX, -sobraY, ANCHO * T + sobraX * 2, ALTO * T + sobraY * 2);

    this.moverme(dt);
    for (const ag of this.agentes.values()) if (ag.vista && ag.camino.length) this.andarAgente(ag, dt);
    this.buscarCerca();
  }

  private moverme(dt: number) {
    if (this.op.bloqueado()) this.teclas.clear();
    const k = this.teclas;
    let dx = (k.has("ArrowRight") || k.has("KeyD") ? 1 : 0) - (k.has("ArrowLeft") || k.has("KeyA") ? 1 : 0);
    let dy = (k.has("ArrowDown") || k.has("KeyS") ? 1 : 0) - (k.has("ArrowUp") || k.has("KeyW") ? 1 : 0);
    const clave = this.personaje(ASPECTO_CEO);
    if (dx || dy) {
      if (this.sentada && this.planta.sillon) {
        // Me levanto: quedo de pie en la casilla del sillón.
        this.sentada = false;
        this.yo.setPosition((this.planta.sillon.x + 0.5) * T, this.planta.sillon.y * T + 26);
      }
      const largo = Math.hypot(dx, dy);
      dx /= largo;
      dy /= largo;
      const paso = VELOCIDAD * dt;
      // Cada eje por separado: así se resbala a lo largo de las paredes.
      const nx = this.yo.x + dx * paso;
      if (this.libre(nx, this.yo.y)) this.yo.x = nx;
      const ny = this.yo.y + dy * paso;
      if (this.libre(this.yo.x, ny)) this.yo.y = ny;
      this.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "derecha" : "izquierda") : dy > 0 ? "abajo" : "arriba";
      this.yo.play(`${clave}-andar-${this.dir}`, true).setDepth(this.yo.y);
    } else if (!this.sentada && this.yo.anims.isPlaying) this.yo.stop().setFrame(`${this.dir}-0`);
  }

  private andarAgente(ag: Agente, dt: number) {
    const v = ag.vista!;
    const clave = this.personaje(ag.datos.aspecto);
    let paso = VELOCIDAD_AGENTE * dt;
    while (paso > 0 && ag.camino.length) {
      const p = ag.camino[0]!;
      const dx = p.x - ag.x;
      const dy = p.y - ag.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.5) ag.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "derecha" : "izquierda") : dy > 0 ? "abajo" : "arriba";
      if (d <= paso) {
        ag.x = p.x;
        ag.y = p.y;
        paso -= d;
        ag.camino.shift();
      } else {
        ag.x += (dx / d) * paso;
        ag.y += (dy / d) * paso;
        paso = 0;
      }
    }
    if (!ag.camino.length) {
      this.posarAgente(ag);
      return;
    }
    v.sprite.setPosition(ag.x, ag.y).setDepth(ag.y).play(`${clave}-andar-${ag.dir}`, true);
    this.seguirAgente(ag);
  }

  /** ¿Qué tengo cerca para pulsar E? El agente o el ascensor más próximos. */
  private buscarCerca() {
    let mejor: Cerca = null;
    let dist = Infinity;
    for (const ag of this.agentes.values()) {
      if (!ag.vista) continue;
      const d = Phaser.Math.Distance.Between(this.yo.x, this.yo.y, ag.x, ag.y);
      if (d < ALCANCE && d < dist) {
        dist = d;
        mejor = { tipo: "agente", ag };
      }
    }
    for (const p of PUNTOS_ASCENSOR) {
      const d = Phaser.Math.Distance.Between(this.yo.x, this.yo.y, p.x * T, p.y * T);
      if (d < ALCANCE_ASCENSOR && d < dist) {
        dist = d;
        mejor = { tipo: "ascensor" };
      }
    }
    const igual = mejor?.tipo === this.cerca?.tipo && (mejor?.tipo !== "agente" || (this.cerca?.tipo === "agente" && this.cerca.ag === mejor.ag));
    if (igual && !(mejor?.tipo === "agente" && mejor.ag.camino.length)) return;
    this.cerca = mejor;
    if (!mejor) this.aviso.setVisible(false);
    else if (mejor.tipo === "ascensor") this.mostrarAviso("Pulsa E · Ascensor", this.yo.x, this.yo.y - ALTO_PJ - 10);
    else this.mostrarAviso(`Pulsa E · ${mejor.ag.datos.texto}`, mejor.ag.x, mejor.ag.y - ALTO_PJ - 26);
  }
}

/** Arranca el juego dentro de `padre` (ocupa todo su tamaño). */
export function crearJuego(padre: HTMLElement, op: OpcionesJuego): Juego {
  const juego = new Phaser.Game({
    type: Phaser.AUTO,
    parent: padre,
    backgroundColor: "#1b1f2a",
    pixelArt: true,
    banner: false,
    audio: { noAudio: true },
    input: { keyboard: false },
    fps: { target: 60 },
    scale: { mode: Phaser.Scale.RESIZE, width: padre.clientWidth, height: padre.clientHeight },
  });
  juego.scene.add("oficina", Oficina, true, op);
  const escena = () => {
    const e = juego.scene.getScene("oficina") as Oficina | null;
    return e?.sys.isActive() ? e : null;
  };
  return {
    actualizar: (agentes) => escena()?.actualizar(agentes),
    irAPlanta: (n) => escena()?.irAPlanta(n),
    destruir: () => {
      escena()?.guardarPos();
      juego.destroy(true);
    },
  };
}
