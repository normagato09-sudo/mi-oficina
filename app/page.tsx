import { connection } from "next/server";
import Header from "@/components/Header";
import Oficina from "@/components/oficina/Oficina";
import FichaAgente from "@/components/ficha/FichaAgente";
import PanelProyecto from "@/components/panel/PanelProyecto";
import NuevoEncargo from "@/components/encargos/NuevoEncargo";
import HistorialEncargos from "@/components/encargos/HistorialEncargos";
import { cargarEncargos, type EncargoVista } from "@/lib/encargos";
import { cargarCiudad, marcarVisto, type DatosOficina } from "@/lib/datos";
import { plural } from "@/lib/estado";

export default async function Home({ searchParams }: PageProps<"/">) {
  await connection();
  const params = await searchParams;
  const agenteId = typeof params.agente === "string" ? params.agente : undefined;
  const proyectoId = typeof params.proyecto === "string" ? params.proyecto : undefined;

  let ciudad: DatosOficina[];
  try {
    ciudad = await cargarCiudad();
  } catch (e) {
    return (
      <>
        <Header proyectos={[]} />
        <main className="mx-auto max-w-2xl px-4 py-16">
          <div role="alert" className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6">
            <h1 className="font-display text-xl font-extrabold">No se pudo abrir la oficina</h1>
            <p className="mt-2 text-muted">{e instanceof Error ? e.message : String(e)}</p>
          </div>
        </main>
      </>
    );
  }

  // El agente abierto decide el proyecto; si no, el de la URL; si no, el primero.
  const proyectoDelAgente = ciudad.find((d) => d.agentes.some((a) => a.id === agenteId));
  const proyecto = proyectoDelAgente ?? ciudad.find((d) => d.edificio.id === proyectoId) ?? ciudad[0];
  const agente = proyectoDelAgente?.agentes.find((a) => a.id === agenteId);
  if (agente) {
    // Abrir la ficha cuenta como "visto": su luz verde se apaga.
    await marcarVisto(agente.id);
    agente.sinVer = 0;
  }
  // Panel de la estantería del Director: ficha del proyecto y perfiles de sus agentes.
  const panelAbierto = !agente && params.panel === "proyecto";
  const dentro = params.vista === "edificio" || Boolean(agente) || panelAbierto;

  // Ficha del Director: recibe encargos (y elige dónde publicar si el edificio tiene agentes de redes).
  const esDirector = agente?.tipo === "direccion" && agente.activo !== false;
  const redes = esDirector
    ? proyecto.agentes.filter((a) => a.tipo === "redes" && a.activo !== false).map((a) => ({ id: a.id, nombre: a.nombre }))
    : [];
  let encargos: EncargoVista[] = [];
  let errorEncargos: string | null = null;
  if (esDirector) {
    try {
      encargos = await cargarEncargos(agente.id, new Map(proyecto.agentes.map((a) => [a.id, a.nombre])));
    } catch (e) {
      errorEncargos = e instanceof Error ? e.message : String(e);
    }
  }
  const numAgentes = ciudad.reduce((n, d) => n + d.agentes.length, 0);

  return (
    <>
      <Header
        proyectos={ciudad.map((d) => d.edificio)}
        actual={dentro ? proyecto.edificio.id : undefined}
      />
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <main className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Mis proyectos</h1>
          <p className="mt-1 text-muted">
            {plural(ciudad.length, "proyecto", "proyectos")} · {plural(numAgentes, "agente", "agentes")}
          </p>
          <div className="mt-6">
            <Oficina
              ciudad={ciudad}
              actual={proyecto.edificio.id}
              dentro={dentro}
              agenteSeleccionado={agente?.id}
              panelAbierto={panelAbierto}
            />
          </div>
        </main>

        {panelAbierto && <PanelProyecto datos={proyecto} />}

        {agente && (
          <FichaAgente agente={agente} edificio={proyecto.edificio}>
            {agente.activo === false ? (
              <p className="mt-6 rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
                Este agente todavía no está trabajando.
              </p>
            ) : esDirector ? (
              <>
                <NuevoEncargo key={agente.id} agenteId={agente.id} redes={redes} />
                {errorEncargos ? (
                  <p role="alert" className="mt-8 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
                    {errorEncargos}. ¿Has ejecutado la migración 0006?
                  </p>
                ) : (
                  <HistorialEncargos encargos={encargos} />
                )}
              </>
            ) : (
              <>
                <div className="mt-6">
                  <button
                    type="button"
                    className="btn-primary w-full"
                    disabled
                    title="Disponible en el siguiente paso"
                  >
                    Nueva publicación
                  </button>
                </div>
                <section aria-labelledby="pubs-titulo" className="mt-8">
                  <h3 id="pubs-titulo" className="font-display text-lg font-extrabold">
                    Publicaciones
                  </h3>
                  <p className="mt-3 rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
                    Aún no hay publicaciones.
                  </p>
                </section>
              </>
            )}
          </FichaAgente>
        )}
      </div>
    </>
  );
}
