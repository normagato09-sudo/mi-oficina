import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { AgenteConEstado, DatosOficina } from "@/lib/datos";
import { COLOR_LUZ, estadoAgente, plural } from "@/lib/estado";
import { momentoEspana } from "@/lib/hora";
import Ambiente from "./Ambiente";
import Personaje, { type Aspecto } from "./Personaje";
import {
  Alfombra, Cafetera, CuadroDefensem, Cuadro, Estanteria, Lampara, LamparaColgante, Papelera, Planta,
  PuertaEntrada, Reloj, Sofa, Ventana,
} from "./Decor";

type Tipo = "direccion" | "redes" | "generico";

export const ALTO_PISO = 270;
export const ALTO_RECEPCION = 220;
export const ALTO_LOSA = 14;

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function tipoPiso(nombre: string): Tipo {
  const n = normalizar(nombre);
  if (n.includes("direccion")) return "direccion";
  if (n.includes("redes")) return "redes";
  return "generico";
}

/** Aspecto del muñeco y de su pantalla según el agente. */
function estiloAgente(agente: AgenteConEstado): { aspecto: Aspecto; marca: string } {
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
  if (agente.tipo === "direccion" || n.includes("director")) {
    return {
      marca: "direccion",
      aspecto: { camiseta: "#2c3e66", sombra: "#1f2c4a", pelo: "#8a8a8a", piel: "#e8b894", peinado: "corto", corbata: "#DA1415" },
    };
  }
  return { marca: "generico", aspecto: { camiseta: "#da1415", sombra: "#b10f10", pelo: "#3b2a20", piel: "#f1c7a1" } };
}

/** Puesto de trabajo: personaje, mesa y objetos. Es un enlace que abre la ficha del agente. */
function Puesto({ agente, tipo, x, seleccionado }: { agente: AgenteConEstado; tipo: Tipo; x: number; seleccionado: boolean }) {
  const estado = estadoAgente(agente.estados, agente.sinVer);
  const { aspecto, marca } = estiloAgente(agente);
  return (
    <Link
      href={seleccionado ? "/?vista=edificio" : `/?vista=edificio&agente=${agente.id}`}
      scroll={false}
      prefetch={false}
      aria-current={seleccionado ? "true" : undefined}
      aria-label={`${agente.nombre}: ${estado.texto}. ${seleccionado ? "Cerrar" : "Abrir"} ficha`}
      className={`puesto puesto-${tipo} marca-${marca} luz-${estado.luz}${estado.trabajando ? " trabajando" : ""}`}
      style={{ left: x, top: 176 }}
    >
      <span className="burbuja" aria-hidden="true">
        <span className="punto" style={{ background: COLOR_LUZ[estado.luz] }} />
        {agente.nombre} · {estado.texto}
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
          <span className="placa-mesa" aria-hidden="true" />
          <span className="telefono" aria-hidden="true" />
        </>
      ) : (
        <span className="papel" aria-hidden="true" />
      )}
      <span className="taza" aria-hidden="true" />
    </Link>
  );
}

/** Posición horizontal (centro) de cada puesto dentro del piso (960 px de ancho). */
function xPuesto(tipo: Tipo, i: number, total: number): number {
  if (tipo === "redes" && total === 2) return i === 0 ? 220 : 740;
  return 480 + (i - (total - 1) / 2) * 260;
}

function DecoracionPiso({ tipo }: { tipo: Tipo }) {
  switch (tipo) {
    case "direccion":
      return (
        <>
          <Ventana x={320} y={20} ancho={320} alto={150} />
          <Estanteria x={34} y={56} baldas={3} ancho={124} trofeos />
          <CuadroDefensem x={186} y={74} />
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

/** El edificio en corte: un piso por departamento y la recepción abajo. */
export default function Interior({ datos, agenteSeleccionado }: { datos: DatosOficina; agenteSeleccionado?: string }) {
  const total = datos.departamentos.length;
  return (
    <Ambiente inicial={momentoEspana()} className="corte">
      <div className="corte-tejado" aria-hidden="true">
        <span className="letrero">
          <span className="verde">DEFENSEM</span> <span className="rojo">L&apos;EMPORDANET</span>
        </span>
      </div>
      <div className="corte-pisos">
        {datos.departamentos.map((dep, i) => {
          const tipo = tipoPiso(dep.nombre);
          return (
            <Piso
              key={dep.id}
              etiqueta={`${dep.nombre} · ${plural(dep.agentes.length, "agente", "agentes")}`}
              numero={`Piso ${total - i}`}
              alto={ALTO_PISO}
              tipo={tipo}
            >
              <DecoracionPiso tipo={tipo} />
              {dep.agentes.map((agente, j) => (
                <Puesto
                  key={agente.id}
                  agente={agente}
                  tipo={tipo}
                  x={xPuesto(tipo, j, dep.agentes.length)}
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
          <Sofa x={562} y={128} color="#298d3b" />
          <span className="hueco" style={{ left: 720 }}>
            + Próximo departamento
          </span>
        </Piso>
      </div>
    </Ambiente>
  );
}
