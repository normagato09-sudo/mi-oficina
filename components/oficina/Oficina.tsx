import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { NOMBRE_DESPACHO, type AgenteConEstado, type DatosOficina } from "@/lib/datos";
import { COLOR_LUZ, estadoAgente, plural } from "@/lib/estado";
import { momentoEspana } from "@/lib/hora";
import type { Despacho, Edificio } from "@/lib/tipos";
import Ambiente from "./Ambiente";
import Lienzo from "./Lienzo";
import Personaje, { type Aspecto } from "./Personaje";
import {
  AlfombraPlanta, Archivador, Bandeja, Bandera, Cafetera, Calendario, Carteles, Cuadro, CuadroNombre, Escudo,
  GloboTerraqueo, LamparaColgante, MontonPapeles, Papelera, PizarraGraficos, Planta, RackServidor, Reloj, Sofa,
  TableroDibujo, Ventana,
} from "./Decor";

/** Tamaño de la planta (px de diseño): se escala al ancho disponible y la página se desplaza hacia abajo si hace falta. */
const ANCHO = 1400;
const ALTO = 922;

const ALTO_DESPACHO = 360;
const Y_ARRIBA = 24;
const Y_ABAJO = 538;
/** Centro vertical de los puestos dentro del despacho. */
const Y_PUESTO = 214;

type Sala = {
  x: number;
  y: number;
  ancho: number;
  /** Posición x de la puerta dentro del despacho. */
  puerta: number;
  /** Fila de abajo: la puerta da al pasillo por la pared del fondo. */
  abajo?: boolean;
};

const ANCHO_ABAJO = 260;
const abajo = (i: number): Sala => ({
  x: 24 + i * (ANCHO_ABAJO + 12),
  y: Y_ABAJO,
  ancho: i === 4 ? ANCHO_ABAJO + 4 : ANCHO_ABAJO,
  puerta: ANCHO_ABAJO - 82,
  abajo: true,
});

/** Fila de arriba: Dirección (la más grande), Redes, Traducción y Redacción. Fila de abajo: los otros cinco. */
const SALAS: Record<Despacho, Sala> = {
  direccion: { x: 24, y: Y_ARRIBA, ancho: 446, puerta: 360 },
  redes: { x: 482, y: Y_ARRIBA, ancho: 290, puerta: 24 },
  traduccion: { x: 784, y: Y_ARRIBA, ancho: 290, puerta: 24 },
  redaccion: { x: 1086, y: Y_ARRIBA, ancho: 290, puerta: 24 },
  programacion: abajo(0),
  ciberseguridad: abajo(1),
  secretaria: abajo(2),
  diseno: abajo(3),
  informes: abajo(4),
};

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

/** Aspecto de cada agente: uno distinto por despacho. */
const ASPECTOS: Record<Despacho, Aspecto> = {
  direccion: { camiseta: "#2c3e66", sombra: "#1f2c4a", pelo: "#8a8a8a", piel: "#e8b894", peinado: "corto" },
  redes: { camiseta: "#D62976", sombra: "#a81f5c", pelo: "#3b2a20", piel: "#f1c7a1", peinado: "largo", luz: "rgba(250, 126, 180, 0.6)" },
  traduccion: { camiseta: "#1f8a8a", sombra: "#166b6b", pelo: "#1c1714", piel: "#a8744f", peinado: "mono" },
  redaccion: { camiseta: "#c9a227", sombra: "#a3831c", pelo: "#a0522d", piel: "#f1c7a1", peinado: "corto" },
  programacion: { camiseta: "#2f6db5", sombra: "#245a96", pelo: "#1c1714", piel: "#d9a27a", peinado: "corto", luz: "rgba(120, 200, 255, 0.6)" },
  ciberseguridad: { camiseta: "#2b2b2b", sombra: "#1a1a1a", pelo: "#e0b23a", piel: "#f1c7a1", peinado: "mono", luz: "rgba(95, 208, 138, 0.6)" },
  secretaria: { camiseta: "#8e5aa8", sombra: "#6e4386", pelo: "#3b2a20", piel: "#e8b894", peinado: "largo" },
  diseno: { camiseta: "#e07b39", sombra: "#b8602a", pelo: "#c0392b", piel: "#f1c7a1", peinado: "largo" },
  informes: { camiseta: "#3c8d5a", sombra: "#2c6c44", pelo: "#8a8a8a", piel: "#8d5a3b", peinado: "corto" },
};

/** Aspecto del muñeco y de su pantalla según el despacho del agente. */
export function estiloAgente(agente: AgenteConEstado, corbata: string): { aspecto: Aspecto; marca: string } {
  const aspecto = ASPECTOS[agente.despacho];
  if (agente.despacho === "direccion") return { marca: "direccion", aspecto: { ...aspecto, corbata } };
  if (agente.despacho === "redes") return { marca: "instagram", aspecto };
  return { marca: agente.despacho, aspecto };
}

/** Objetos de la mesa de cada despacho (además del portátil, que algunos sustituyen). */
function ObjetosMesa({ despacho, enCola }: { despacho: Despacho; enCola: number }) {
  switch (despacho) {
    case "direccion":
      return (
        <>
          <Bandeja papeles={enCola} />
          <span className="placa-mesa" />
          <span className="telefono" />
        </>
      );
    case "traduccion":
      return (
        <>
          <span className="papel" />
          <span className="libreta" />
        </>
      );
    case "redaccion":
      return (
        <>
          <span className="maquina-escribir">
            <span className="hoja-maquina" />
            <span className="teclas" />
          </span>
          <span className="pila-mesa" />
        </>
      );
    case "programacion":
      return (
        <span className="monitores">
          <span className="monitor m1" />
          <span className="monitor m2" />
          <span className="monitor m3" />
        </span>
      );
    case "secretaria":
      return (
        <>
          <span className="fichero" />
          <span className="papel" />
        </>
      );
    case "diseno":
      return (
        <>
          <span className="paleta" />
          <span className="lapices" />
        </>
      );
    case "informes":
      return (
        <>
          <span className="carpetas-mesa" />
          <span className="papel" />
        </>
      );
    default:
      return <span className="papel" />;
  }
}

/** Puesto de trabajo: personaje, mesa y objetos. Es un enlace que abre la ficha del agente. */
function Puesto({ agente, x, seleccionado, enCola, corbata }: { agente: AgenteConEstado; x: number; seleccionado: boolean; enCola: number; corbata: string }) {
  const estado = estadoAgente(agente, enCola);
  const { aspecto, marca } = estiloAgente(agente, corbata);
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
      <span className="objetos-mesa" aria-hidden="true">
        <ObjetosMesa despacho={tipo} enCola={enCola} />
      </span>
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
  const { x, y, ancho, puerta, abajo } = SALAS[despacho];
  return (
    <div
      className={`despacho despacho-${despacho}${abajo ? " despacho-abajo" : ""}`}
      style={{ left: x, top: y, width: ancho, height: ALTO_DESPACHO, "--puerta": `${puerta}px` } as CSSProperties}
      role="group"
      aria-label={`${NOMBRE_DESPACHO[despacho]} · ${plural(agentes, "agente", "agentes")}`}
    >
      <div className="despacho-interior">
        <div className="despacho-pared" aria-hidden="true">
          <span className="zocalo" />
          {abajo && <span className="puerta-pared" />}
        </div>
        <div className="despacho-suelo" aria-hidden="true" />
        {children}
        <span className="sala-noche" aria-hidden="true" />
      </div>
      <span className="cristal cristal-izq" aria-hidden="true" />
      <span className="cristal cristal-der" aria-hidden="true" />
      <span className="cristal cristal-frente-a" aria-hidden="true" />
      <span className="cristal cristal-frente-b" aria-hidden="true" />
      {!abajo && <span className="puerta-cristal" aria-hidden="true" />}
      <p className="despacho-etiqueta" aria-hidden="true">
        {NOMBRE_DESPACHO[despacho]}
      </p>
    </div>
  );
}

/** Estantería del Director: la carpeta "Equipo" abre los perfiles de los agentes. */
function EstanteriaEquipo({ abierta }: { abierta: boolean }) {
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
        {["#8e2f2f", "#2f6db5", "#3c8d5a", "#c9a227", "#34495e"].map((color, i) => (
          <span key={i} className="libro" aria-hidden="true" style={{ background: color, height: 46 + ((i * 9) % 18), width: 11 }} />
        ))}
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
    case "direccion":
      return (
        <>
          <EstanteriaEquipo abierta={props.equipoAbierto === true} />
          <Ventana x={196} y={14} ancho={112} alto={96} />
          {props.proyectoCartel && <CuadroNombre x={320} y={20} {...letreroDe(props.proyectoCartel)} />}
          <LamparaColgante x={252} cable={10} />
          <AlfombraPlanta x={63} y={222} ancho={320} alto={124} tipo="persa" />
          <Planta x={378} y={150} tipo="ficus" />
          <Papelera x={30} y={304} />
        </>
      );
    case "redes":
      return (
        <>
          <Cuadro x={16} y={30} tipo="abstracto" ancho={46} alto={58} />
          <Ventana x={76} y={14} ancho={132} alto={96} />
          <Reloj x={228} y={30} />
          <Planta x={10} y={170} tipo="frondosa" />
          <Planta x={236} y={180} tipo="cactus" />
        </>
      );
    case "traduccion":
      return (
        <>
          <Bandera x={16} y={22} pais="es" />
          <Bandera x={66} y={22} pais="ca" />
          <Bandera x={116} y={22} pais="gb" />
          <Ventana x={172} y={14} ancho={104} alto={96} />
          <GloboTerraqueo x={232} y={168} />
          <Planta x={8} y={176} tipo="sanseviera" />
        </>
      );
    case "redaccion":
      return (
        <>
          <Ventana x={16} y={14} ancho={112} alto={96} />
          <Cuadro x={150} y={34} tipo="retrato" ancho={48} alto={60} />
          <Reloj x={226} y={30} />
          <MontonPapeles x={8} y={196} montones={3} />
          <MontonPapeles x={234} y={214} montones={2} />
        </>
      );
    case "programacion":
      return (
        <>
          <Cuadro x={16} y={30} tipo="abstracto" ancho={46} alto={58} />
          <Ventana x={76} y={14} ancho={90} alto={96} />
          <Planta x={200} y={196} tipo="cactus" />
          <Papelera x={14} y={304} />
        </>
      );
    case "ciberseguridad":
      return (
        <>
          <RackServidor x={10} y={44} />
          <Escudo x={96} y={20} />
          <Planta x={204} y={200} tipo="sanseviera" />
        </>
      );
    case "secretaria":
      return (
        <>
          <Calendario x={14} y={24} />
          <Ventana x={108} y={14} ancho={62} alto={96} />
          <Archivador x={8} y={150} />
          <Planta x={204} y={196} tipo="frondosa" />
        </>
      );
    case "diseno":
      return (
        <>
          <Carteles x={12} y={18} />
          <TableroDibujo x={196} y={140} />
          <Papelera x={14} y={304} />
        </>
      );
    case "informes":
      return (
        <>
          <PizarraGraficos x={12} y={14} />
          <Archivador x={202} y={150} />
          <Planta x={8} y={196} tipo="ficus" />
        </>
      );
  }
}

/** La oficina vista desde arriba: nueve despachos, el pasillo y un rincón de descanso. */
export default function Oficina(props: Props) {
  const { datos, enCola, agenteSeleccionado } = props;
  const corbata = props.proyectoCartel ? letreroDe(props.proyectoCartel).colorSecundario : "#F5B841";
  const despachos = Object.keys(SALAS) as Despacho[];

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
                  x={xPuesto(i, suyos.length, SALAS[d].ancho)}
                  seleccionado={agente.id === agenteSeleccionado}
                  enCola={d === "direccion" ? enCola : 0}
                  corbata={corbata}
                />
              ))}
            </DespachoSala>
          );
        })}

        {/* Pasillo de baldosas con una alfombra larga */}
        <div className="pasillo" style={{ left: 24, top: 396, width: 1042, height: 130 }} role="group" aria-label="Pasillo">
          <AlfombraPlanta x={70} y={38} ancho={902} alto={54} tipo="pasillo" />
          <Planta x={8} y={14} tipo="sanseviera" />
          <span className="sala-noche" aria-hidden="true" />
        </div>

        {/* Rincón de descanso */}
        <div className="descanso" style={{ left: 1078, top: 396, width: 298, height: 130 }} role="group" aria-label="Rincón de descanso">
          <Sofa x={14} y={40} color="#4f6db8" />
          <Cafetera x={178} y={22} />
          <Planta x={232} y={44} tipo="frondosa" />
          <span className="sala-noche" aria-hidden="true" />
        </div>
      </Ambiente>
    </Lienzo>
  );
}
