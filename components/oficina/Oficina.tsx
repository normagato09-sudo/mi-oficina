import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { AgenteConEstado, DatosOficina } from "@/lib/datos";
import { COLOR_LUZ, estadoAgente, plural } from "@/lib/estado";
import { momentoEspana } from "@/lib/hora";
import type { Despacho, Edificio } from "@/lib/tipos";
import Ambiente from "./Ambiente";
import Lienzo from "./Lienzo";
import Personaje, { type Aspecto } from "./Personaje";
import {
  AlfombraPlanta, Bandeja, Bandera, Cafetera, Cuadro, CuadroNombre, GloboTerraqueo, Lampara, LamparaColgante,
  Mesita, Papelera, Planta, Reloj, Sofa, Ventana,
} from "./Decor";

/** Tamaño de la planta (px de diseño): se escala al ancho disponible. */
const ANCHO = 1200;
const ALTO = 842;

/** Posición y tamaño de cada despacho en la planta, y dónde está su puerta (x dentro del despacho). */
const DESPACHOS: Record<Despacho, { x: number; ancho: number; puerta: number }> = {
  direccion: { x: 24, ancho: 540, puerta: 448 },
  redes: { x: 576, ancho: 294, puerta: 24 },
  traduccion: { x: 882, ancho: 294, puerta: 24 },
};
const Y_DESPACHOS = 24;
const ALTO_DESPACHO = 360;
/** Centro vertical de los puestos dentro del despacho. */
const Y_PUESTO = 214;

const NOMBRE: Record<Despacho, string> = { direccion: "Dirección", redes: "Redes sociales", traduccion: "Traducción" };

type Props = {
  datos: DatosOficina;
  /** Encargos en la cola del Director. */
  enCola: number;
  /** Proyecto cuyo cartel cuelga en Dirección (el del primer encargo de la cola, o el primero). */
  proyectoCartel?: Edificio;
  agenteSeleccionado?: string;
  /** La carpeta "Equipo" de la estantería está abierta. */
  equipoAbierto?: boolean;
};

/** Texto y colores del cartel de un proyecto. */
export function letreroDe(edificio: Edificio) {
  return {
    principal: edificio.letrero || edificio.nombre,
    secundario: edificio.letrero_secundario || null,
    color: edificio.color,
    colorSecundario: edificio.color_secundario || edificio.color,
  };
}

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const ASPECTOS_EXTRA: Aspecto[] = [
  { camiseta: "#8e5aa8", sombra: "#6e4386", pelo: "#3b2a20", piel: "#f1c7a1", peinado: "largo" },
  { camiseta: "#e07b39", sombra: "#b8602a", pelo: "#a0522d", piel: "#d9a27a", peinado: "corto" },
];

/** Aspecto del muñeco y de su pantalla según el agente. */
export function estiloAgente(agente: AgenteConEstado, corbata: string, i = 0): { aspecto: Aspecto; marca: string } {
  const n = normalizar(agente.nombre);
  if (n.includes("instagram")) {
    return {
      marca: "instagram",
      aspecto: { camiseta: "#D62976", sombra: "#a81f5c", pelo: "#3b2a20", piel: "#f1c7a1", peinado: "largo", luz: "rgba(250, 126, 180, 0.6)" },
    };
  }
  if (agente.tipo === "direccion") {
    return {
      marca: "direccion",
      aspecto: { camiseta: "#2c3e66", sombra: "#1f2c4a", pelo: "#8a8a8a", piel: "#e8b894", peinado: "corto", corbata },
    };
  }
  if (agente.tipo === "traduccion") {
    return {
      marca: "generico",
      aspecto: { camiseta: "#1f8a8a", sombra: "#166b6b", pelo: "#1c1714", piel: "#a8744f", peinado: "mono" },
    };
  }
  return { marca: "generico", aspecto: ASPECTOS_EXTRA[i % ASPECTOS_EXTRA.length]! };
}

/** Puesto de trabajo: personaje, mesa y objetos. Es un enlace que abre la ficha del agente. */
function Puesto({ agente, x, i, seleccionado, enCola, corbata }: { agente: AgenteConEstado; x: number; i: number; seleccionado: boolean; enCola: number; corbata: string }) {
  const estado = estadoAgente(agente, enCola);
  const { aspecto, marca } = estiloAgente(agente, corbata, i);
  const tipo = agente.despacho;
  return (
    <Link
      href={seleccionado ? "/" : `/?agente=${agente.id}`}
      scroll={false}
      prefetch={false}
      aria-current={seleccionado ? "true" : undefined}
      aria-label={`${agente.nombre}: ${estado.texto}. ${seleccionado ? "Cerrar" : "Abrir"} ficha`}
      className={`puesto puesto-${tipo} marca-${marca} luz-${estado.luz}${estado.trabajando ? " trabajando" : ""}`}
      style={{ left: x, top: Y_PUESTO }}
    >
      <span className={`burbuja${estado.texto.length > 28 ? " burbuja-larga" : ""}`} aria-hidden="true">
        <span className="punto" style={{ background: COLOR_LUZ[estado.luz] }} />
        <span>{`${agente.nombre} · ${estado.texto}`}</span>
      </span>
      <span className="sombra-puesto" aria-hidden="true" />
      <span className="halo-estado" aria-hidden="true" />
      <span className="silla" aria-hidden="true" />
      <Personaje pose={estado.trabajando ? "trabajando" : "libre"} aspecto={aspecto} />
      <span className="escritorio" aria-hidden="true" />
      <span className="lampara-mesa" aria-hidden="true">
        <span className="halo" />
      </span>
      <span className="portatil" aria-hidden="true">
        <span className="brillo" />
      </span>
      {tipo === "direccion" ? (
        <>
          <Bandeja papeles={enCola} />
          <span className="placa-mesa" aria-hidden="true" />
          <span className="telefono" aria-hidden="true" />
        </>
      ) : tipo === "traduccion" ? (
        <>
          <span className="papel" aria-hidden="true" />
          <span className="libreta" aria-hidden="true" />
        </>
      ) : (
        <span className="papel" aria-hidden="true" />
      )}
      <span className="taza" aria-hidden="true" />
    </Link>
  );
}

/** Centro horizontal de cada puesto dentro de su despacho. */
function xPuesto(i: number, total: number, ancho: number): number {
  return ancho / 2 + (i - (total - 1) / 2) * 230;
}

/** Despacho con paredes de cristal, ventana y puerta al pasillo. */
function DespachoSala({ despacho, agentes, children }: { despacho: Despacho; agentes: number; children: ReactNode }) {
  const { x, ancho, puerta } = DESPACHOS[despacho];
  return (
    <div
      className={`despacho despacho-${despacho}`}
      style={{ left: x, top: Y_DESPACHOS, width: ancho, height: ALTO_DESPACHO, "--puerta": `${puerta}px` } as CSSProperties}
      role="group"
      aria-label={`${NOMBRE[despacho]} · ${plural(agentes, "agente", "agentes")}`}
    >
      <div className="despacho-interior">
        <div className="despacho-pared" aria-hidden="true">
          <span className="zocalo" />
        </div>
        <div className="despacho-suelo" aria-hidden="true" />
        {children}
        <span className="sala-noche" aria-hidden="true" />
      </div>
      <span className="cristal cristal-izq" aria-hidden="true" />
      <span className="cristal cristal-der" aria-hidden="true" />
      <span className="cristal cristal-frente-a" aria-hidden="true" />
      <span className="cristal cristal-frente-b" aria-hidden="true" />
      <span className="puerta-cristal" aria-hidden="true" />
      <p className="despacho-etiqueta" aria-hidden="true">
        {NOMBRE[despacho]}
      </p>
    </div>
  );
}

/** Estantería del Director: la carpeta del equipo (perfiles). Los proyectos se gestionan desde la cabecera. */
function EstanteriaCarpetas({ abierta }: { abierta?: boolean }) {
  return (
    <div className="estanteria-carpetas" style={{ left: 22, top: 10 }}>
      <div className="balda balda-carpetas">
        <Link
          href={abierta ? "/" : "/?panel=equipo"}
          scroll={false}
          prefetch={false}
          aria-current={abierta ? "true" : undefined}
          aria-label={`${abierta ? "Cerrar" : "Abrir"} la carpeta del equipo (perfiles de los agentes)`}
          className="carpeta"
          style={{ "--carpeta": "#5b6378" } as CSSProperties}
        >
          <span className="lomo" aria-hidden="true">
            EQUIPO
          </span>
          <span className="carpeta-pista" aria-hidden="true">
            Perfiles del equipo
          </span>
        </Link>
      </div>
      <div className="balda" aria-hidden="true">
        {["#c0392b", "#2f6db5", "#e0b23a", "#3c8d5a", "#8e5aa8", "#e07b39", "#34495e", "#d35d6e"].map((color, i) => (
          <span key={i} className="libro" style={{ background: color, height: 22 + ((i * 7) % 12) }} />
        ))}
        <span className="trofeo" />
      </div>
      <div className="balda" aria-hidden="true">
        {["#1f8a8a", "#c9a227", "#298d3b", "#da1415", "#2f6db5"].map((color, i) => (
          <span key={i} className="libro" style={{ background: color, height: 24 + ((i * 5) % 10) }} />
        ))}
        <span className="planta-mini" />
      </div>
    </div>
  );
}

function decoracion(despacho: Despacho, props: Props): ReactNode {
  switch (despacho) {
    case "direccion": {
      const cartel = props.proyectoCartel;
      return (
        <>
          <EstanteriaCarpetas abierta={props.equipoAbierto} />
          <Ventana x={190} y={14} ancho={150} alto={96} />
          {cartel && <CuadroNombre x={356} y={20} {...letreroDe(cartel)} />}
          <Reloj x={486} y={30} />
          <LamparaColgante x={250} cable={10} />
          <AlfombraPlanta x={130} y={222} ancho={340} alto={124} tipo="persa" />
          <Planta x={476} y={150} tipo="ficus" />
          <Papelera x={30} y={300} />
        </>
      );
    }
    case "redes":
      return (
        <>
          <Cuadro x={18} y={30} tipo="abstracto" ancho={46} alto={58} />
          <Ventana x={78} y={14} ancho={138} alto={96} />
          <Reloj x={236} y={30} />
          <Planta x={14} y={170} tipo="frondosa" />
          <Planta x={240} y={180} tipo="cactus" />
          <Papelera x={238} y={300} />
        </>
      );
    case "traduccion":
      return (
        <>
          <Bandera x={16} y={22} pais="es" />
          <Bandera x={66} y={22} pais="ca" />
          <Bandera x={116} y={22} pais="gb" />
          <Ventana x={172} y={14} ancho={106} alto={96} />
          <GloboTerraqueo x={230} y={168} />
          <Planta x={12} y={176} tipo="sanseviera" />
        </>
      );
  }
}

/** La oficina vista desde arriba: tres despachos, el pasillo y la zona de descanso. */
export default function Oficina(props: Props) {
  const { datos, enCola, agenteSeleccionado } = props;
  const corbata = props.proyectoCartel ? letreroDe(props.proyectoCartel).colorSecundario : "#F5B841";
  const despachos: Despacho[] = ["direccion", "redes", "traduccion"];

  return (
    <Lienzo ancho={ANCHO} alto={ALTO}>
      <Ambiente inicial={momentoEspana()} className="oficina-planta">
        <span className="oficina-fondo" aria-hidden="true" />

        {despachos.map((d) => {
          const suyos = datos.agentes.filter((a) => a.despacho === d);
          return (
            <DespachoSala key={d} despacho={d} agentes={suyos.length}>
              {decoracion(d, props)}
              {suyos.map((agente, i) => (
                <Puesto
                  key={agente.id}
                  agente={agente}
                  x={xPuesto(i, suyos.length, DESPACHOS[d].ancho)}
                  i={i}
                  seleccionado={agente.id === agenteSeleccionado}
                  enCola={d === "direccion" ? enCola : 0}
                  corbata={corbata}
                />
              ))}
            </DespachoSala>
          );
        })}

        {/* Pasillo de baldosas con una alfombra larga */}
        <div className="pasillo" style={{ left: 24, top: 396, width: 1152, height: 110 }} role="group" aria-label="Pasillo">
          <AlfombraPlanta x={60} y={28} ancho={1032} alto={54} tipo="pasillo" />
          <Planta x={8} y={4} tipo="sanseviera" />
          <Planta x={1104} y={4} tipo="frondosa" />
          <span className="sala-noche" aria-hidden="true" />
        </div>

        {/* Zona de descanso */}
        <div className="descanso" style={{ left: 24, top: 518, width: 700, height: 300 }} role="group" aria-label="Zona de descanso">
          <AlfombraPlanta x={60} y={120} ancho={380} alto={150} tipo="descanso" />
          <Sofa x={86} y={110} color="#4f6db8" />
          <Sofa x={262} y={110} color="#c47b57" />
          <Mesita x={180} y={200} />
          <Lampara x={470} y={70} />
          <Cafetera x={560} y={60} />
          <Planta x={16} y={30} tipo="ficus" />
          <Planta x={620} y={190} tipo="frondosa" />
          <Planta x={470} y={200} tipo="cactus" />
          <p className="despacho-etiqueta descanso-etiqueta" aria-hidden="true">
            Zona de descanso
          </p>
          <span className="sala-noche" aria-hidden="true" />
        </div>

        <div className="hueco-despachos" style={{ left: 736, top: 518, width: 440, height: 300 }}>
          + Espacio para próximos despachos
        </div>
      </Ambiente>
    </Lienzo>
  );
}
