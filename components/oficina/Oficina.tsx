import type { DatosOficina } from "@/lib/datos";
import { plural } from "@/lib/estado";
import Escena from "./Escena";
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

  return (
    <Escena
      nombre={datos.edificio.nombre}
      resumen={`${plural(datos.agentes.length, "agente", "agentes")} · ${plural(pisos, "departamento", "departamentos")}`}
      estado={estado}
      alto={Math.max(900, altoInterior)}
      dentroInicial={dentro}
      hayFicha={Boolean(agenteSeleccionado)}
      interior={<Interior datos={datos} agenteSeleccionado={agenteSeleccionado} />}
    />
  );
}
