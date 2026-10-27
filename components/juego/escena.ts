import * as Phaser from "phaser";
import type { Aspecto } from "@/components/oficina/Personaje";
import { COLOR_LUZ, type Luz } from "@/lib/estado";
import type { Despacho } from "@/lib/tipos";
import {
  ALTO_PJ, DIRECCIONES, FOTOGRAMAS, MEDIDAS, casillaMuro, casillaSuelo, dibujoHalo, dibujoProp, felpudo, hojaFuente,
  hojaPersonaje, lienzo, sombraMuro, type Direccion,
} from "./dibujos";
import { ALTO, ANCHO, FUENTE, K, SALAS, SILLA_CEO, T, objetos, plano, puestos, type Prop, type Puesto } from "./mapa";

/** Lo que el juego necesita saber de cada agente (lo calcula el servidor, como en la vista clásica). */
export type AgenteJuego = {
  id: string;
  nombre: string;
  despacho: Despacho;
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
  /** Hay una ficha o ventana abierta: el personaje no se mueve. */
  bloqueado: () => boolean;
};

export type Juego = { actualizar: (agentes: AgenteJuego[]) => void; destruir: () => void };

/** Mi personaje (la CEO). */
const ASPECTO_CEO: Aspecto = { camiseta: "#9b2c3c", sombra: "#76202d", pelo: "#5a3a26", piel: "#f1c7a1", peinado: "largo" };

/** Velocidad al andar (px del mundo por segundo). */
const VELOCIDAD = 84;
/** Distancia (px) a la que se puede hablar con un agente: desde delante de su mesa llega. */
const ALCANCE = 3.4 * T;
const ZOOM_MAX = 6;
/** Sentada: el dibujo baja para que la mesa tape de la cintura para abajo. */
const BAJA_SENTADO = 6;
/** Escala de los textos: se dibujan grandes y se reducen, para que se lean nítidos con zoom. */
const ESCALA_TEXTO = 0.25;

const ALFOMBRAS = new Set<number>([...K.alfombraNaranja.flat(), ...K.alfombraVerde.flat()]);
const CUADROS = new Set<number>(K.cuadros);
const SILLA = K.sillaOficina;

const hex = (color: string) => Phaser.Display.Color.HexStringToColor(color).color;

/** Posición guardada del personaje (al rehacer la escena por un cambio en el equipo, sigo donde estaba). */
let ultimaPos: { x: number; y: number; dir: Direccion } | null = null;

type VistaAgente = {
  datos: AgenteJuego;
  puesto: Puesto;
  sprite: Phaser.GameObjects.Sprite;
  halo: Phaser.GameObjects.Image;
  haloTween?: Phaser.Tweens.Tween;
  etiqueta: Phaser.GameObjects.Container;
  fondoEtiqueta: Phaser.GameObjects.Graphics;
  textoEtiqueta: Phaser.GameObjects.Text;
};

class Oficina extends Phaser.Scene {
  private op!: OpcionesJuego;
  private solido: boolean[][] = [];
  private yo!: Phaser.GameObjects.Sprite;
  private dir: Direccion = "abajo";
  private sentada = true;
  private teclas = new Set<string>();
  private agentes = new Map<string, VistaAgente>();
  private cerca: VistaAgente | null = null;
  private aviso!: Phaser.GameObjects.Container;
  private avisoTexto!: Phaser.GameObjects.Text;
  private avisoFondo!: Phaser.GameObjects.Graphics;
  private zoomObjetivo = 3;
  private quitarEscuchas: (() => void) | null = null;

  constructor() {
    super("oficina");
  }

  init(op: OpcionesJuego) {
    this.op = op;
    this.agentes = new Map();
    this.teclas = new Set();
    this.cerca = null;
  }

  preload() {
    this.load.image("kenney", "/juego/kenney-roguelike-indoor.png");
  }

  create() {
    this.prepararTexturas();
    this.pintarFondo();
    const lista = puestos(this.op.agentes);
    this.ponerObjetos(lista);
    this.ponerAgentes(lista);
    this.ponerYo();
    this.ponerAviso();
    this.prepararCamara();
    this.escuchar();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.quitarEscuchas?.());
  }

  /* ───────────── Texturas ───────────── */

  private prepararTexturas() {
    const tx = this.textures;
    // La hoja de Kenney: 27 columnas de 16 px con 1 px de separación (la última columna mide 15 px en el PNG).
    const kenney = tx.get("kenney");
    if (!kenney.has("0")) {
      const ancho = kenney.getSourceImage().width;
      for (let i = 0; i < 27 * 18; i++) {
        const x = (i % 27) * 17;
        kenney.add(String(i), 0, x, Math.floor(i / 27) * 17, Math.min(16, ancho - x), 16);
      }
    }
    if (!tx.exists("fuente")) {
      const f = tx.addCanvas("fuente", hojaFuente())!;
      f.add("0", 0, 0, 0, 64, 64);
      f.add("1", 0, 64, 0, 64, 64);
    }
    if (!tx.exists("halo")) tx.addCanvas("halo", dibujoHalo());
    for (const prop of Object.keys(MEDIDAS) as Prop[]) {
      const clave = `prop-${prop}`;
      if (tx.exists(clave)) continue;
      const m = MEDIDAS[prop];
      const t = tx.addCanvas(clave, dibujoProp(prop))!;
      for (let f = 0; f < (m.fotogramas ?? 1); f++) t.add(String(f), 0, f * m.ancho, 0, m.ancho, m.alto);
    }
    if (!this.anims.exists("fuente")) {
      this.anims.create({ key: "fuente", frames: [{ key: "fuente", frame: "0" }, { key: "fuente", frame: "1" }], frameRate: 3, repeat: -1 });
      this.anims.create({ key: "leds", frames: [{ key: "prop-leds", frame: "0" }, { key: "prop-leds", frame: "1" }], frameRate: 2, repeat: -1 });
    }
  }

  /** Textura y animaciones de un personaje; la clave depende de su aspecto (se reutiliza si no cambia). */
  private personaje(aspecto: Aspecto): string {
    const clave = `pj-${JSON.stringify(aspecto)}`;
    if (this.textures.exists(clave)) return clave;
    const t = this.textures.addCanvas(clave, hojaPersonaje(aspecto))!;
    FOTOGRAMAS.forEach((f, i) => t.add(f, 0, i * 16, 0, 16, ALTO_PJ));
    for (const d of DIRECCIONES) {
      this.anims.create({
        key: `${clave}-andar-${d}`,
        frames: [1, 0, 2, 0].map((n) => ({ key: clave, frame: `${d}-${n}` })),
        frameRate: 8,
        repeat: -1,
      });
    }
    this.anims.create({ key: `${clave}-teclear`, frames: [{ key: clave, frame: "sentado-0" }, { key: clave, frame: "sentado-1" }], frameRate: 5, repeat: -1 });
    return clave;
  }

  /* ───────────── El mapa ───────────── */

  /** Suelos y muros en un solo dibujo (es lo más rápido de pintar en cada fotograma). */
  private pintarFondo() {
    const g = plano();
    this.solido = g.map((fila) => fila.map((c) => c.suelo === null));
    const puertas = new Set(SALAS.flatMap((s) => s.puerta.map((p) => `${p.x},${p.y}`)));
    const [canvas, ctx] = lienzo(ANCHO * T, ALTO * T);
    for (let y = 0; y < ALTO; y++)
      for (let x = 0; x < ANCHO; x++) {
        const c = g[y]![x]!;
        if (c.suelo === null) casillaMuro(ctx, x * T, y * T, g[y + 1]?.[x]?.suelo != null);
        else {
          casillaSuelo(ctx, x * T, y * T, c.suelo, c.color, x, y);
          if (g[y - 1]?.[x]?.suelo === null) sombraMuro(ctx, x * T, y * T);
          if (puertas.has(`${x},${y}`)) felpudo(ctx, x * T, y * T);
        }
      }
    if (this.textures.exists("fondo")) this.textures.remove("fondo");
    this.textures.addCanvas("fondo", canvas);
    this.add.image(0, 0, "fondo").setOrigin(0).setDepth(-10);

    // La fuente del patio.
    this.add.sprite(FUENTE.x * T, FUENTE.y * T, "fuente", "0").setOrigin(0).setDepth((FUENTE.y + FUENTE.alto) * T).play("fuente");
    this.marcarSolido(FUENTE.x, FUENTE.y, FUENTE.ancho, FUENTE.alto);

    // El nombre de cada sala, pintado en el suelo junto a la puerta.
    for (const s of SALAS) {
      const puerta = s.puerta[0]!;
      const abajo = puerta.y > s.y2;
      const lado = puerta.x < s.x1 || puerta.x > s.x2;
      const x = lado ? (s.x1 + s.x2 + 1) / 2 : puerta.x + 1;
      const y = abajo ? s.y2 + 0.55 : lado ? s.y2 + 0.55 : s.y1 + 0.6;
      this.texto(s.nombre.toUpperCase(), 26, "#ffffff", "800")
        .setPosition(x * T, y * T)
        .setOrigin(0.5)
        .setAlpha(0.5)
        .setDepth(-4);
    }
  }

  private marcarSolido(x: number, y: number, ancho: number, alto: number) {
    for (let j = Math.floor(y); j < Math.floor(y) + alto; j++)
      for (let i = Math.floor(x); i < Math.floor(x) + ancho; i++) if (this.solido[j]?.[i] !== undefined) this.solido[j]![i] = true;
  }

  private ponerObjetos(lista: Puesto[]) {
    for (const o of objetos(lista)) {
      if ("k" in o) {
        const pared = CUADROS.has(o.k);
        const img = this.add.image(o.x * T, (pared ? o.y - 0.7 : o.y) * T, "kenney", String(o.k)).setOrigin(0);
        // Las alfombras van en el suelo; los cuadros, en la pared; las sillas, detrás de quien se sienta.
        img.setDepth(ALFOMBRAS.has(o.k) ? -5 : pared ? -4 : o.encima ? (o.y + 2) * T + 1 : (o.y + 1) * T - (o.k === SILLA ? 2 : 0));
        if (o.solido) this.marcarSolido(o.x, o.y, 1, 1);
        continue;
      }
      const m = MEDIDAS[o.prop];
      const pieAncho = o.solido?.ancho ?? m.pie;
      const pieAlto = o.solido?.alto ?? 1;
      const abajo = m.pared ? o.y * T - 2 : (o.y + pieAlto) * T - (m.sube ?? 0);
      const img = this.add.sprite((o.x + pieAncho / 2) * T, abajo, `prop-${o.prop}`, "0").setOrigin(0.5, 1);
      img.setDepth(m.pared ? -4 : o.encima ? (o.y + 2) * T + 1 : (o.y + pieAlto) * T);
      if (o.prop === "leds") img.play("leds");
      if (o.solido) this.marcarSolido(o.x, o.y, o.solido.ancho, o.solido.alto);
    }
  }

  /** Texto nítido: se dibuja grande y se reduce. */
  private texto(texto: string, tamano: number, color: string, peso = "600") {
    const t = this.add.text(0, 0, texto, { fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", fontSize: `${tamano}px`, fontStyle: peso, color });
    t.setScale(ESCALA_TEXTO);
    t.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    return t;
  }

  /* ───────────── Agentes ───────────── */

  private ponerAgentes(lista: Puesto[]) {
    for (const p of lista) {
      const datos = this.op.agentes.find((a) => a.id === p.agenteId)!;
      const x = (p.x + 0.5) * T;
      const pie = (p.y + 1) * T + BAJA_SENTADO;
      const halo = this.add.image(x, (p.y + 0.6) * T, "halo").setDepth(-3).setScale(0.75).setBlendMode(Phaser.BlendModes.ADD);
      const sprite = this.add.sprite(x, pie, this.personaje(datos.aspecto), "sentado-0").setOrigin(0.5, 1).setDepth((p.y + 1) * T);
      sprite.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.op.abrirFicha(datos.id));
      // Silla ocupada: no se puede atravesar.
      this.marcarSolido(p.x, p.y, 1, 1);

      const textoEtiqueta = this.texto(datos.nombre, 24, "#ffffff", "700").setOrigin(0, 0.5);
      const fondoEtiqueta = this.add.graphics();
      const etiqueta = this.add.container(x, pie - ALTO_PJ - 4, [fondoEtiqueta, textoEtiqueta]).setDepth(9000);
      etiqueta.setSize(40, 8).setInteractive({ useHandCursor: true }).on("pointerdown", () => this.op.abrirFicha(datos.id));
      const vista: VistaAgente = { datos, puesto: p, sprite, halo, etiqueta, fondoEtiqueta, textoEtiqueta };
      this.agentes.set(datos.id, vista);
      this.pintarAgente(vista);
    }
  }

  /** Nombre, luz de estado y postura según los datos del agente. */
  private pintarAgente(v: VistaAgente) {
    const { datos } = v;
    const color = hex(COLOR_LUZ[datos.luz]);
    v.textoEtiqueta.setText(datos.nombre);
    const anchoTexto = v.textoEtiqueta.width * ESCALA_TEXTO;
    const ancho = anchoTexto + 12;
    const g = v.fondoEtiqueta;
    g.clear();
    g.fillStyle(0x141824, datos.inactivo ? 0.55 : 0.85).fillRoundedRect(-ancho / 2, -4.5, ancho, 9, 4.5);
    // La luz: un punto con su brillo.
    if (datos.luz !== "apagada") g.fillStyle(color, 0.35).fillCircle(-ancho / 2 + 5, 0, 3.4);
    g.fillStyle(color, 1).fillCircle(-ancho / 2 + 5, 0, 2);
    v.textoEtiqueta.setPosition(-ancho / 2 + 9, 0).setAlpha(datos.inactivo ? 0.6 : 1);
    v.etiqueta.setSize(ancho, 9);

    // Brillo en el suelo del color de la luz (en rojo, late más deprisa).
    v.haloTween?.remove();
    v.halo.setVisible(datos.luz !== "apagada").setTint(color).setAlpha(0.45);
    if (datos.luz !== "apagada")
      v.haloTween = this.tweens.add({ targets: v.halo, alpha: 0.85, duration: datos.luz === "rojo" ? 520 : 1100, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

    const clave = this.personaje(datos.aspecto);
    if (datos.trabajando) v.sprite.play(`${clave}-teclear`, true);
    else v.sprite.stop().setTexture(clave, "sentado-0");
    if (datos.inactivo) v.sprite.setTint(0x9aa0ad).setAlpha(0.7);
    else v.sprite.clearTint().setAlpha(1);
  }

  /** Nuevos datos (la página se ha refrescado). Si el equipo cambia, se rehace la escena. */
  actualizar(agentes: AgenteJuego[]) {
    const mismos = agentes.length === this.agentes.size && agentes.every((a) => this.agentes.get(a.id)?.datos.despacho === a.despacho);
    if (!mismos) {
      this.guardarPos();
      this.scene.restart({ ...this.op, agentes });
      return;
    }
    this.op = { ...this.op, agentes };
    for (const a of agentes) {
      const v = this.agentes.get(a.id)!;
      v.datos = a;
      this.pintarAgente(v);
    }
    if (this.cerca) this.mostrarAviso(this.cerca);
  }

  /* ───────────── Yo ───────────── */

  private ponerYo() {
    const clave = this.personaje(ASPECTO_CEO);
    if (ultimaPos) {
      this.sentada = false;
      this.dir = ultimaPos.dir;
      this.yo = this.add.sprite(ultimaPos.x, ultimaPos.y, clave, `${this.dir}-0`).setOrigin(0.5, 1);
    } else {
      // Al abrir la oficina estoy sentada en mi mesa.
      this.sentada = true;
      this.yo = this.add.sprite((SILLA_CEO.x + 0.5) * T, (SILLA_CEO.y + 1) * T + BAJA_SENTADO, clave, "sentado-0").setOrigin(0.5, 1);
    }
    this.yo.setDepth(this.sentada ? (SILLA_CEO.y + 1) * T : this.yo.y);
  }

  guardarPos() {
    if (this.yo && !this.sentada) ultimaPos = { x: this.yo.x, y: this.yo.y, dir: this.dir };
  }

  /** ¿Cabe mi pie (10 × 5 px) en (x, y)? */
  private libre(x: number, y: number): boolean {
    for (const [px, py] of [
      [x - 5, y - 5],
      [x + 4, y - 5],
      [x - 5, y - 1],
      [x + 4, y - 1],
    ] as const) {
      if (this.solido[Math.floor(py / T)]?.[Math.floor(px / T)] !== false) return false;
    }
    return true;
  }

  /* ───────────── Aviso "Pulsa E" ───────────── */

  private ponerAviso() {
    this.avisoFondo = this.add.graphics();
    this.avisoTexto = this.texto("", 22, "#ffffff", "600").setOrigin(0, 0.5);
    this.aviso = this.add.container(0, 0, [this.avisoFondo, this.avisoTexto]).setDepth(9500).setVisible(false);
  }

  private mostrarAviso(v: VistaAgente) {
    this.avisoTexto.setText(`Pulsa E · ${v.datos.texto}`);
    const ancho = this.avisoTexto.width * ESCALA_TEXTO + 10;
    this.avisoFondo.clear();
    this.avisoFondo.fillStyle(0xf5b841, 1).fillRoundedRect(-ancho / 2, -4.5, ancho, 9, 3);
    this.avisoFondo.fillStyle(0xf5b841, 1).fillTriangle(-2.5, 4.4, 2.5, 4.4, 0, 7);
    this.avisoTexto.setColor("#1b1f2a").setPosition(-ancho / 2 + 5, 0);
    this.aviso.setPosition(v.etiqueta.x, v.etiqueta.y - 11).setVisible(true);
  }

  /* ───────────── Cámara y teclado ───────────── */

  private zoomMinimo() {
    const { width, height } = this.scale;
    return Math.min(width / (ANCHO * T), height / (ALTO * T));
  }

  private prepararCamara() {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, ANCHO * T, ALTO * T);
    cam.setRoundPixels(true);
    this.zoomObjetivo = Phaser.Math.Clamp(this.scale.height / (17 * T), this.zoomMinimo(), ZOOM_MAX);
    cam.setZoom(this.zoomObjetivo);
    cam.startFollow(this.yo, true, 0.12, 0.12, 0, ALTO_PJ / 2);
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
        if (this.cerca) this.op.abrirFicha(this.cerca.datos.id);
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
    const cam = this.cameras.main;
    if (Math.abs(cam.zoom - this.zoomObjetivo) > 0.001) cam.setZoom(cam.zoom + (this.zoomObjetivo - cam.zoom) * Math.min(1, delta / 90));
    // Si la oficina cabe entera en un sentido, queda centrada en él (los límites se agrandan por igual a los dos lados).
    const verAncho = cam.width / cam.zoom;
    const verAlto = cam.height / cam.zoom;
    const sobraX = Math.max(0, verAncho - ANCHO * T) / 2;
    const sobraY = Math.max(0, verAlto - ALTO * T) / 2;
    cam.setBounds(-sobraX, -sobraY, ANCHO * T + sobraX * 2, ALTO * T + sobraY * 2);

    if (this.op.bloqueado()) this.teclas.clear();
    const k = this.teclas;
    let dx = (k.has("ArrowRight") || k.has("KeyD") ? 1 : 0) - (k.has("ArrowLeft") || k.has("KeyA") ? 1 : 0);
    let dy = (k.has("ArrowDown") || k.has("KeyS") ? 1 : 0) - (k.has("ArrowUp") || k.has("KeyW") ? 1 : 0);
    const clave = this.personaje(ASPECTO_CEO);

    if (dx || dy) {
      if (this.sentada) {
        // Me levanto: quedo de pie en la casilla de la silla.
        this.sentada = false;
        this.yo.setPosition((SILLA_CEO.x + 0.5) * T, (SILLA_CEO.y + 1) * T - 2);
      }
      const largo = Math.hypot(dx, dy);
      dx /= largo;
      dy /= largo;
      const paso = (VELOCIDAD * Math.min(delta, 50)) / 1000;
      // Cada eje por separado: así se resbala a lo largo de las paredes.
      const nx = this.yo.x + dx * paso;
      if (this.libre(nx, this.yo.y)) this.yo.x = nx;
      const ny = this.yo.y + dy * paso;
      if (this.libre(this.yo.x, ny)) this.yo.y = ny;
      this.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "derecha" : "izquierda") : dy > 0 ? "abajo" : "arriba";
      this.yo.play(`${clave}-andar-${this.dir}`, true);
      this.yo.setDepth(this.yo.y);
    } else if (!this.sentada && this.yo.anims.isPlaying) {
      this.yo.stop().setFrame(`${this.dir}-0`);
    }

    // ¿Qué agente tengo más cerca?
    let mejor: VistaAgente | null = null;
    let dist = ALCANCE;
    for (const v of this.agentes.values()) {
      const d = Phaser.Math.Distance.Between(this.yo.x, this.yo.y, v.sprite.x, v.sprite.y);
      if (d < dist) {
        dist = d;
        mejor = v;
      }
    }
    if (mejor !== this.cerca) {
      this.cerca = mejor;
      if (mejor) this.mostrarAviso(mejor);
      else this.aviso.setVisible(false);
    }
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
  return {
    actualizar: (agentes) => {
      const escena = juego.scene.getScene("oficina") as Oficina | null;
      if (escena?.sys.isActive()) escena.actualizar(agentes);
    },
    destruir: () => {
      (juego.scene.getScene("oficina") as Oficina | null)?.guardarPos();
      juego.destroy(true);
    },
  };
}
