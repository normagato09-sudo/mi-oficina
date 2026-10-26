import { connection } from "next/server";
import Header from "@/components/Header";
import Oficina, { estiloAgente, letreroDe } from "@/components/oficina/Oficina";
import FichaAgente from "@/components/ficha/FichaAgente";
import PanelProyecto from "@/components/panel/PanelProyecto";
import NuevoEncargo from "@/components/encargos/NuevoEncargo";
import ColaDirector from "@/components/encargos/ColaDirector";
import HistorialEncargos from "@/components/encargos/HistorialEncargos";
import { cargarCola, cargarHistorial, resumenCola, type EncargoVista } from "@/lib/encargos";
import { cargarAvisos, cargarOficina, marcarVisto, type DatosOficina } from "@/lib/datos";
import { plural } from "@/lib/estado";
import type { Aviso } from "@/lib/tipos";

export default async function Home({ searchParams }: PageProps<"/">) {
  await connection();
  const params = await searchParams;
  const agenteId = typeof params.agente === "string" ? params.agente : undefined;

  let datos: DatosOficina;
  try {
    datos = await cargarOficina();
  } catch (e) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-2xl px-4 py-16">
          <div role="alert" className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6">
            <h1 className="font-display text-xl font-extrabold">No se pudo abrir la oficina</h1>
            <p className="mt-2 text-muted">{e instanceof Error ? e.message : String(e)}</p>
          </div>
        </main>
      </>
    );
  }

  const director = datos.agentes.find((a) => a.despacho === "direccion" && a.tipo === "direccion");
  const [cola, avisos] = await Promise.all([
    resumenCola(),
    cargarAvisos().catch((): Aviso[] => []),
  ]);
  // El cartel de Dirección es el del proyecto del primer encargo de la cola (o el del primer proyecto).
  const proyectoCartel = datos.proyectos.find((p) => p.id === cola.primerProyecto) ?? datos.proyectos[0];

  const agente = datos.agentes.find((a) => a.id === agenteId);
  if (agente) {
    // Abrir la ficha cuenta como "visto": su luz verde se apaga.
    await marcarVisto(agente.id);
    agente.sinVer = 0;
  }

  // Carpetas de la estantería del Director: la ficha de un proyecto o los perfiles del equipo.
  const panel = agente ? undefined : params.panel;
  const proyectoPanel =
    panel === "proyecto" ? datos.proyectos.find((p) => p.id === params.proyecto) : undefined;
  const carpetaAbierta = proyectoPanel ? proyectoPanel.id : panel === "equipo" ? "equipo" : undefined;

  const esDirector = agente !== undefined && agente.id === director?.id;
  let colaDirector: EncargoVista[] = [];
  let historial: EncargoVista[] = [];
  let errorCola: string | null = null;
  if (esDirector) {
    try {
      [colaDirector, historial] = await Promise.all([cargarCola(), cargarHistorial()]);
    } catch (e) {
      errorCola = e instanceof Error ? e.message : String(e);
    }
  }
  const corbata = proyectoCartel ? letreroDe(proyectoCartel).colorSecundario : "#F5B841";

  return (
    <>
      <Header directorId={director?.id} avisos={avisos} />
      <div className="mx-auto flex max-w-[1600px] items-start gap-6 px-6 py-6">
        <main className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Mi Oficina</h1>
          <p className="mt-1 text-muted">
            {plural(datos.agentes.length, "agente", "agentes")} · trabajando para{" "}
            {datos.proyectos.length === 1 ? datos.proyectos[0]!.nombre : plural(datos.proyectos.length, "proyecto", "proyectos")}
          </p>
          <div className="mt-6">
            <Oficina
              datos={datos}
              enCola={cola.total}
              proyectoCartel={proyectoCartel}
              agenteSeleccionado={agente?.id}
              carpetaAbierta={carpetaAbierta}
            />
          </div>
        </main>

        {proyectoPanel && <PanelProyecto tipo="proyecto" proyecto={proyectoPanel} />}
        {carpetaAbierta === "equipo" && <PanelProyecto tipo="equipo" agentes={datos.agentes} />}

        {agente && (
          <FichaAgente
            agente={agente}
            color={estiloAgente(agente, corbata).aspecto.camiseta}
            enCola={esDirector ? cola.total : 0}
          >
            {esDirector ? (
              <>
                <NuevoEncargo
                  key={`${agente.id}-${params.nuevo === "1"}`}
                  agenteId={agente.id}
                  proyectos={datos.proyectos.map((p) => ({ id: p.id, nombre: p.nombre }))}
                  abiertoInicial={params.nuevo === "1"}
                />
                {errorCola ? (
                  <p role="alert" className="mt-8 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
                    {errorCola}
                  </p>
                ) : (
                  <>
                    <ColaDirector cola={colaDirector} />
                    <HistorialEncargos encargos={historial} />
                  </>
                )}
              </>
            ) : (
              <section aria-labelledby="trabajos-titulo" className="mt-8">
                <h3 id="trabajos-titulo" className="font-display text-lg font-extrabold">
                  {agente.despacho === "traduccion" ? "Traducciones" : "Publicaciones"}
                </h3>
                <p className="mt-3 rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
                  Todavía no tiene trabajos. Le llegarán del Director cuando reparta los encargos.
                </p>
              </section>
            )}
          </FichaAgente>
        )}
      </div>
    </>
  );
}
