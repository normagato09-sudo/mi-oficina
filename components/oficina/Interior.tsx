import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { AgenteConEstado, DatosOficina } from "@/lib/datos";
import { COLOR_LUZ, estadoAgente, plural } from "@/lib/estado";
import { momentoEspana } from "@/lib/hora";
import type { Edificio } from "@/lib/tipos";
import Ambiente from "./Ambiente";
import Personaje, { type Aspecto } from "./Personaje";
import {
  Alfombra, Archivador, Cafetera, Calendario, CuadroNombre, Cuadro, Estanteria, Lampara, LamparaColgante,
  MicroDoblaje, PanelAcustico, Papelera, Pizarra, Planta, PuertaEntrada, Reloj, Rotulo, Sofa, TablonEquipo, Ventana,
} from "./Decor";

type Tipo = "direccion" | "redes" | "comunicacion" | "administracion" | "rrhh" | "generico";
type Estilo = "campo" | "escuela";

export const ALTO_PISO = 270;
export const ALTO_RECEPCION = 220;
export const ALTO_LOSA = 14;

/** Alto del lienzo de la escena (px de diseño). */
export const ALTO_LIENZO = 900;

/** Escala para que el corte (tejado + pisos + recepción + terreno) quepa en el lienzo; con muchos pisos, se desliza en vertical. */
function encaje(pisos: number): number {
  const alto = 70 + pisos * (ALTO_PISO + ALTO_LOSA) + ALTO_RECEPCION + 40;
  return Math.max(0.8, Math.min(1, (ALTO_LIENZO - 50) / alto));
}

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Qué piso es, por el tipo de sus agentes o por el nombre del departamento. */
function tipoPiso(nombre: string, agentes: AgenteConEstado[]): Tipo {
  const n = normalizar(nombre);
  if (agentes.some((a) => a.tipo === "direccion") || n.includes("direc")) return "direccion";
  if (agentes.some((a) => a.tipo === "rrhh") || n === "rrhh" || n.includes("recursos humanos")) return "rrhh";
  if (n.includes("redes")) return "redes";
  if (n.includes("comunicacion")) return "comunicacion";
  if (n.includes("administracion")) return "administracion";
  return "generico";
}

function estiloDe(edificio: Edificio): Estilo {
  return edificio.estilo === "escuela" ? "escuela" : "campo";
}

/** Texto y colores del letrero de un proyecto. */
export function letreroDe(edificio: Edificio) {
  return {
    principal: edificio.letrero || edificio.nombre,
    secundario: edificio.letrero_secundario || null,
    color: edificio.color,
    colorSecundario: edificio.color_secundario || edificio.color,
  };
}

const ASPECTOS_EXTRA: Aspecto[] = [
  { camiseta: "#8e5aa8", sombra: "#6e4386", pelo: "#3b2a20", piel: "#f1c7a1", peinado: "largo" },
  { camiseta: "#1f8a8a", sombra: "#166b6b", pelo: "#1c1714", piel: "#a8744f", peinado: "mono" },
  { camiseta: "#e07b39", sombra: "#b8602a", pelo: "#a0522d", piel: "#d9a27a", peinado: "corto" },
];

/** Aspecto del muñeco y de su pantalla según el agente y su proyecto. */
function estiloAgente(agente: AgenteConEstado, edificio: Edificio, i: number): { aspecto: Aspecto; marca: string } {
  const n = normalizar(agente.nombre);
  if (n.includes("instagram")) {
    return {
      marca: "instagram",
      aspecto: { camiseta: "#D62976", sombra: "#a81f5c", pelo: "#3b2a20", piel: "#f1c7a1", peinado: "largo", luz: "rgba(250, 126, 180, 0.6)" },
    };
  }
  if (n.includes("facebook")) {
    return {
      marca: "facebook",
      aspecto: { camiseta: "#1877F2", sombra: "#0f5bc4", pelo: "#1c1714", piel: "#d9a27a", peinado: "corto", luz: "rgba(90, 160, 255, 0.65)" },
    };
  }
  if (agente.tipo === "direccion") {
    return {
      marca: "direccion",
      aspecto: { camiseta: "#2c3e66", sombra: "#1f2c4a", pelo: "#8a8a8a", piel: "#e8b894", peinado: "corto", corbata: letreroDe(edificio).colorSecundario },
    };
  }
  if (agente.tipo === "comunicacion") {
    return {
      marca: "proyecto",
      aspecto: { camiseta: edificio.color, sombra: `color-mix(in srgb, ${edificio.color} 78%, black)`, pelo: "#3b2a20", piel: "#f1c7a1", peinado: "largo" },
    };
  }
  return { marca: "generico", aspecto: ASPECTOS_EXTRA[i % ASPECTOS_EXTRA.length] };
}

/** Puesto de trabajo: personaje, mesa y objetos. Es un enlace que abre la ficha del agente. */
function Puesto({ agente, edificio, tipo, x, i, seleccionado }: { agente: AgenteConEstado; edificio: Edificio; tipo: Tipo; x: number; i: number; seleccionado: boolean }) {
  const estado = estadoAgente(agente);
  const { aspecto, marca } = estiloAgente(agente, edificio, i);
  const base = `/?vista=edificio&proyecto=${edificio.id}`;
  return (
    <Link
      href={seleccionado ? base : `${base}&agente=${agente.id}`}
      scroll={false}
      prefetch={false}
      aria-current={seleccionado ? "true" : undefined}
      aria-label={`${agente.nombre}: ${estado.texto}. ${seleccionado ? "Cerrar" : "Abrir"} ficha`}
      className={`puesto puesto-${tipo} marca-${marca} luz-${estado.luz}${estado.trabajando ? " trabajando" : ""}${estado.inactivo ? " inactivo" : ""}`}
      style={{ left: x, top: 176 }}
    >
      <span className={`burbuja${estado.texto.length > 28 ? " burbuja-larga" : ""}`} aria-hidden="true">
        <span className="punto" style={{ background: COLOR_LUZ[estado.luz] }} />
        <span>{estado.inactivo ? estado.texto : `${agente.nombre} · ${estado.texto}`}</span>
      </span>
      <span className="sombra-puesto" aria-hidden="true" />
      <span className="halo-estado" aria-hidden="true" />
      <span className="silla" aria-hidden="true" />
      <Personaje pose={estado.inactivo ? "inactivo" : estado.trabajando ? "trabajando" : "libre"} aspecto={aspecto} />
      <span className="escritorio" aria-hidden="true" />
      <span className="lampara-mesa" aria-hidden="true">
        <span className="halo" />
      </span>
      <span className="portatil" aria-hidden="true">
        <span className="brillo" />
      </span>
      {tipo === "direccion" ? (
        <>
          <span className="placa-mesa" aria-hidden="true" />
          <span className="telefono" aria-hidden="true" />
        </>
      ) : tipo === "comunicacion" ? (
        <span className="micro-mesa" aria-hidden="true" />
      ) : tipo === "administracion" || tipo === "rrhh" ? (
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

/** Posición horizontal (centro) de cada puesto dentro del piso (960 px de ancho). */
function xPuesto(i: number, total: number): number {
  if (total === 2) return i === 0 ? 220 : 740;
  return 480 + (i - (total - 1) / 2) * 260;
}

/**
 * La estantería del despacho del Director: abre el panel con la ficha del proyecto
 * y los perfiles de los agentes del edificio.
 */
function EstanteriaDelDirector({ x, y, ancho, edificio, abierto, children }: { x: number; y: number; ancho: number; edificio: Edificio; abierto: boolean; children: ReactNode }) {
  const base = `/?vista=edificio&proyecto=${edificio.id}`;
  return (
    <Link
      href={abierto ? base : `${base}&panel=proyecto`}
      scroll={false}
      prefetch={false}
      aria-current={abierto ? "true" : undefined}
      aria-label={`${abierto ? "Cerrar" : "Abrir"} la ficha del proyecto y los perfiles de los agentes`}
      className="estanteria-enlace"
      style={{ left: x, top: y, width: ancho }}
    >
      {children}
      <span className="estanteria-pista" aria-hidden="true">
        Ficha y perfiles
      </span>
    </Link>
  );
}

function DecoracionPiso({ tipo, estilo, edificio, panelAbierto }: { tipo: Tipo; estilo: Estilo; edificio: Edificio; panelAbierto: boolean }) {
  const letrero = letreroDe(edificio);

  if (tipo === "rrhh") {
    return (
      <>
        <TablonEquipo x={196} y={40} />
        <Ventana x={650} y={26} ancho={160} alto={130} />
        <Reloj x={850} y={40} />
        <Archivador x={30} y={156} candidaturas />
        <Planta x={884} y={176} tipo="frondosa" />
        <Planta x={120} y={176} tipo="sanseviera" />
        <Papelera x={610} y={228} />
      </>
    );
  }

  if (estilo === "escuela") {
    switch (tipo) {
      case "direccion":
        return (
          <>
            <Pizarra x={30} y={58} ancho={150} />
            <EstanteriaDelDirector x={198} y={54} ancho={112} edificio={edificio} abierto={panelAbierto}>
              <Estanteria x={0} y={0} baldas={3} ancho={112} cursos />
            </EstanteriaDelDirector>
            <Ventana x={340} y={20} ancho={280} alto={150} />
            <CuadroNombre x={652} y={46} {...letrero} />
            <Reloj x={800} y={40} />
            <LamparaColgante x={880} cable={30} />
            <Alfombra x={300} y={238} ancho={360} tipo="rayas" />
            <Planta x={40} y={176} tipo="sanseviera" />
            <Planta x={884} y={164} tipo="ficus" />
            <Papelera x={660} y={226} />
          </>
        );
      case "administracion":
        return (
          <>
            <Calendario x={38} y={58} />
            <Ventana x={400} y={26} ancho={160} alto={130} />
            <Reloj x={598} y={40} />
            <Estanteria x={846} y={46} baldas={2} ancho={100} cursos />
            <LamparaColgante x={480} cable={14} />
            <Archivador x={14} y={156} />
            <Planta x={350} y={176} tipo="frondosa" />
            <Planta x={550} y={176} tipo="cactus" />
            <Papelera x={430} y={228} />
          </>
        );
      case "comunicacion":
        return (
          <>
            <Rotulo x={40} y={62} texto="EN EL AIRE" />
            <PanelAcustico x={300} y={20} ancho={360} />
            <Reloj x={236} y={70} />
            <CuadroNombre x={790} y={46} {...letrero} />
            <MicroDoblaje x={640} y={62} />
            <Lampara x={150} y={60} />
            <Alfombra x={330} y={238} ancho={300} tipo="verde" />
            <Planta x={40} y={176} tipo="frondosa" />
            <Planta x={884} y={176} tipo="sanseviera" />
          </>
        );
      default:
        return (
          <>
            <Ventana x={400} y={26} ancho={160} alto={130} />
            <Reloj x={598} y={40} />
            <Pizarra x={40} y={58} ancho={140} />
            <Planta x={884} y={176} tipo="cactus" />
          </>
        );
    }
  }

  switch (tipo) {
    case "direccion":
      return (
        <>
          <Ventana x={320} y={20} ancho={320} alto={150} />
          <EstanteriaDelDirector x={34} y={56} ancho={124} edificio={edificio} abierto={panelAbierto}>
            <Estanteria x={0} y={0} baldas={3} ancho={124} trofeos />
          </EstanteriaDelDirector>
          <CuadroNombre x={186} y={74} {...letrero} />
          <Reloj x={676} y={34} />
          <Cuadro x={820} y={34} tipo="molino" ancho={58} alto={46} />
          <LamparaColgante x={250} cable={34} />
          <LamparaColgante x={760} cable={48} />
          <Alfombra x={290} y={238} ancho={380} tipo="persa" />
          <Cafetera x={790} y={190} />
          <Planta x={884} y={164} tipo="ficus" />
          <Planta x={182} y={176} tipo="sanseviera" />
          <Papelera x={656} y={226} />
        </>
      );
    case "redes":
      return (
        <>
          <Ventana x={400} y={26} ancho={160} alto={130} />
          <Cuadro x={40} y={66} tipo="paisaje" ancho={70} alto={52} />
          <Cuadro x={126} y={92} tipo="abstracto" ancho={46} alto={58} />
          <Cuadro x={830} y={92} tipo="molino" ancho={56} alto={44} />
          <Cuadro x={896} y={58} tipo="retrato" ancho={48} alto={60} />
          <Reloj x={598} y={40} />
          <LamparaColgante x={480} cable={14} />
          <Planta x={350} y={176} tipo="frondosa" />
          <Planta x={550} y={176} tipo="sanseviera" />
          <Planta x={14} y={164} tipo="ficus" />
          <Planta x={900} y={186} tipo="cactus" />
          <Papelera x={426} y={228} />
        </>
      );
    default:
      return (
        <>
          <Ventana x={400} y={26} ancho={160} alto={130} />
          <Reloj x={598} y={40} />
          <Planta x={14} y={176} tipo="frondosa" />
          <Planta x={900} y={186} tipo="cactus" />
        </>
      );
  }
}

function Piso({ etiqueta, numero, alto, tipo, children }: { etiqueta: string; numero: string; alto: number; tipo: Tipo | "recepcion"; children: ReactNode }) {
  return (
    <div className={`piso piso-${tipo}`} style={{ height: alto } as CSSProperties} role="group" aria-label={etiqueta}>
      <span className="piso-numero" aria-hidden="true">
        {numero}
      </span>
      <div className="piso-interior">
        <div className="piso-pared" aria-hidden="true">
          <span className="zocalo" />
        </div>
        <div className="piso-suelo" aria-hidden="true" />
        {children}
        <span className="piso-noche" aria-hidden="true" />
      </div>
      <p className="piso-etiqueta">{etiqueta}</p>
    </div>
  );
}

/** El edificio en corte: un piso por departamento y la recepción abajo. Sirve para cualquier proyecto. */
export default function Interior({ datos, agenteSeleccionado, panelAbierto = false }: { datos: DatosOficina; agenteSeleccionado?: string; panelAbierto?: boolean }) {
  const { edificio } = datos;
  const total = datos.departamentos.length;
  const estilo = estiloDe(edificio);
  const letrero = letreroDe(edificio);
  return (
    <Ambiente
      inicial={momentoEspana()}
      className={`corte estilo-${estilo}`}
      style={{ "--edificio": edificio.color, "--encaje": encaje(total) } as CSSProperties}
    >
      <div className="corte-tejado" aria-hidden="true">
        <span className="letrero">
          <span style={{ color: letrero.color }}>{letrero.principal}</span>
          {letrero.secundario && <span style={{ color: letrero.colorSecundario }}> {letrero.secundario}</span>}
        </span>
      </div>
      <div className="corte-pisos">
        {datos.departamentos.map((dep, i) => {
          const tipo = tipoPiso(dep.nombre, dep.agentes);
          return (
            <Piso
              key={dep.id}
              etiqueta={`${dep.nombre} · ${plural(dep.agentes.length, "agente", "agentes")}`}
              numero={`Piso ${total - i}`}
              alto={ALTO_PISO}
              tipo={tipo}
            >
              <DecoracionPiso tipo={tipo} estilo={estilo} edificio={edificio} panelAbierto={panelAbierto} />
              {dep.agentes.map((agente, j) => (
                <Puesto
                  key={agente.id}
                  agente={agente}
                  edificio={edificio}
                  tipo={tipo}
                  x={xPuesto(j, dep.agentes.length)}
                  i={j}
                  seleccionado={agente.id === agenteSeleccionado}
                />
              ))}
            </Piso>
          );
        })}
        <Piso etiqueta="Recepción" numero="Planta baja" alto={ALTO_RECEPCION} tipo="recepcion">
          <span className="hueco" style={{ left: 40 }}>
            + Próximo departamento
          </span>
          <Planta x={290} y={122} tipo="sanseviera" />
          <Lampara x={360} y={40} />
          <PuertaEntrada x={420} y={12} />
          <Sofa x={562} y={128} color={edificio.color} />
          <span className="hueco" style={{ left: 720 }}>
            + Próximo departamento
          </span>
        </Piso>
      </div>
    </Ambiente>
  );
}
