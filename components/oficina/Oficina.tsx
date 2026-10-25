import type { DatosOficina } from "@/lib/datos";
import { estadoAgente, plural } from "@/lib/estado";
import Escena, { type ProyectoCiudad } from "./Escena";
import Interior, { ALTO_LIENZO, letreroDe } from "./Interior";

type Props = {
  ciudad: DatosOficina[];
  /** Proyecto en el que se entra (o el último en el que se estuvo). */
  actual: string;
  dentro: boolean;
  agenteSeleccionado?: string;
};

/** Resumen corto del estado de un proyecto, para su tarjeta. */
export function resumenEstado(datos: DatosOficina): string {
  const total = { preparando: 0, publicando: 0, lista: 0, error: 0 };
  for (const a of datos.agentes) {
    total.preparando += a.estados.preparando;
    total.publicando += a.estados.publicando;
    total.lista += a.estados.lista;
    total.error += a.estados.error;
  }
  if (total.preparando + total.publicando > 0) return "Trabajando…";
  if (total.error > 0) return plural(total.error, "error", "errores");
  if (total.lista > 0) return plural(total.lista, "publicación lista", "publicaciones listas");
  return "Todo en calma";
}

/** La ciudad con un edificio por proyecto y, al entrar, el interior del elegido. */
export default function Oficina({ ciudad, actual, dentro, agenteSeleccionado }: Props) {
  const proyectos: ProyectoCiudad[] = ciudad.map((datos) => {
    // Fachada: un piso por departamento (de arriba abajo) y una ventana por agente.
    const fachada = datos.departamentos.map((dep) => ({
      id: dep.id,
      ventanas: dep.agentes.map((a) => {
        const e = estadoAgente(a);
        return { id: a.id, nombre: a.nombre, texto: e.texto, luz: e.luz };
      }),
    }));
    const necesitan = fachada.flatMap((p) => p.ventanas).filter((v) => v.luz === "rojo").length;
    return {
      id: datos.edificio.id,
      nombre: datos.edificio.nombre,
      letrero: letreroDe(datos.edificio),
      resumen: `${plural(datos.agentes.length, "agente", "agentes")} · ${plural(datos.departamentos.length, "departamento", "departamentos")}`,
      estado: resumenEstado(datos),
      aviso: necesitan > 0 ? `⚠ ${necesitan} ${necesitan === 1 ? "agente te necesita" : "agentes te necesitan"}` : undefined,
      fachada,
    };
  });

  const interiores = Object.fromEntries(
    ciudad.map((datos) => [datos.edificio.id, <Interior key={datos.edificio.id} datos={datos} agenteSeleccionado={agenteSeleccionado} />]),
  );

  return (
    <Escena
      proyectos={proyectos}
      interiores={interiores}
      alto={ALTO_LIENZO}
      dentroInicial={dentro}
      actualInicial={actual}
      hayFicha={Boolean(agenteSeleccionado)}
    />
  );
}
