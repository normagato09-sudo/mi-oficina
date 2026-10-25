import type { DatosOficina } from "@/lib/datos";
import { estadoAgente, plural } from "@/lib/estado";
import Escena, { type PisoFachada } from "./Escena";
import Interior, { ALTO_LOSA, ALTO_PISO, ALTO_RECEPCION } from "./Interior";

type Props = {
  datos: DatosOficina;
  estado: string;
  dentro: boolean;
  agenteSeleccionado?: string;
};

/** La ciudad con el edificio del proyecto y, al entrar, su interior piso a piso. */
export default function Oficina({ datos, estado, dentro, agenteSeleccionado }: Props) {
  const pisos = datos.departamentos.length;
  // margen + tejado + pisos + recepción + suelo
  const altoInterior = 40 + 70 + pisos * (ALTO_PISO + ALTO_LOSA) + ALTO_RECEPCION + 40;

  // Fachada: un piso por departamento (de arriba abajo) y una ventana por agente.
  const fachada: PisoFachada[] = datos.departamentos.map((dep) => ({
    id: dep.id,
    ventanas: dep.agentes.map((a) => {
      const e = estadoAgente(a.estados, a.sinVer);
      return { id: a.id, nombre: a.nombre, texto: e.texto, luz: e.luz };
    }),
  }));
  const necesitan = fachada.flatMap((p) => p.ventanas).filter((v) => v.luz === "rojo").length;

  return (
    <Escena
      nombre={datos.edificio.nombre}
      resumen={`${plural(datos.agentes.length, "agente", "agentes")} · ${plural(pisos, "departamento", "departamentos")}`}
      estado={estado}
      aviso={necesitan > 0 ? `⚠ ${necesitan} ${necesitan === 1 ? "agente te necesita" : "agentes te necesitan"}` : undefined}
      fachada={fachada}
      alto={Math.max(900, altoInterior)}
      dentroInicial={dentro}
      hayFicha={Boolean(agenteSeleccionado)}
      interior={<Interior datos={datos} agenteSeleccionado={agenteSeleccionado} />}
    />
  );
}
