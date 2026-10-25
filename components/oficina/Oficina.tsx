import Link from "next/link";
import type { DatosOficina } from "@/lib/datos";
import { COLOR_TONO, estadoAgente, plural } from "@/lib/estado";

type Props = {
  datos: DatosOficina;
  agenteSeleccionado?: string;
};

/** Planta del edificio: se desliza en horizontal. */
export default function Oficina({ datos, agenteSeleccionado }: Props) {
  return (
    <section
      aria-label={`Planta de ${datos.edificio.nombre}`}
      className="planta overflow-x-auto rounded-2xl border border-line"
      tabIndex={0}
    >
      <div className="flex w-max gap-8 p-8 pt-14">
        {datos.departamentos.map((dep) => (
          <div key={dep.id} className="sala">
            <div className="sala-pared" aria-hidden="true">
              <span className="sala-ventana" />
            </div>
            <p className="sala-placa">
              {dep.nombre} · {plural(dep.agentes.length, "agente", "agentes")}
            </p>
            <div className="sala-suelo" aria-hidden="true" />
            <div className="sala-alfombra" aria-hidden="true" />
            <div className="planta-maceta" aria-hidden="true">
              <span className="hoja" />
              <span className="hoja" />
              <span className="hoja" />
              <span className="hoja" />
              <span className="maceta" />
            </div>

            {dep.agentes.map((agente) => {
              const estado = estadoAgente(agente.estados);
              const seleccionado = agente.id === agenteSeleccionado;
              return (
                <Link
                  key={agente.id}
                  href={seleccionado ? "/" : `/?agente=${agente.id}`}
                  scroll={false}
                  aria-current={seleccionado ? "true" : undefined}
                  aria-label={`${agente.nombre}: ${estado.texto}. ${seleccionado ? "Cerrar" : "Abrir"} ficha`}
                  className={`puesto${estado.trabajando ? " trabajando" : ""}`}
                >
                  <span className="burbuja" aria-hidden="true">
                    <span className="punto" style={{ background: COLOR_TONO[estado.tono] }} />
                    {agente.nombre} · {estado.texto}
                  </span>
                  <span className="silla" aria-hidden="true" />
                  <span className="personaje" aria-hidden="true">
                    <span className="brazo izq" />
                    <span className="brazo der" />
                    <span className="cuerpo" />
                    <span className="cabeza">
                      <span className="pelo" />
                      <span className="ojo izq" />
                      <span className="ojo der" />
                      <span className="moflete izq" />
                      <span className="moflete der" />
                    </span>
                  </span>
                  <span className="escritorio" aria-hidden="true" />
                  <span className="portatil" aria-hidden="true">
                    <span className="brillo" />
                  </span>
                  <span className="papel" aria-hidden="true" />
                  <span className="taza" aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        ))}

        {[0, 1].map((i) => (
          <div key={i} className="sala-vacia flex flex-col items-center justify-center gap-2 text-muted">
            <span aria-hidden="true" className="text-3xl leading-none opacity-60">
              +
            </span>
            <span className="text-sm font-medium">Próximamente</span>
          </div>
        ))}
      </div>
    </section>
  );
}
