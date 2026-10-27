import { after, connection } from "next/server";
import AutoRefresco from "@/components/AutoRefresco";
import Header from "@/components/Header";
import Oficina, { estiloAgente, letreroDe } from "@/components/oficina/Oficina";
import FichaAgente from "@/components/ficha/FichaAgente";
import PanelProyecto from "@/components/panel/PanelProyecto";
import PanelProyectos from "@/components/panel/PanelProyectos";
import NuevoEncargo from "@/components/encargos/NuevoEncargo";
import ColaDirector from "@/components/encargos/ColaDirector";
import HistorialEncargos from "@/components/encargos/HistorialEncargos";
import RepartoDirector from "@/components/encargos/RepartoDirector";
import TareasAgente from "@/components/encargos/TareasAgente";
import PlantillasCartel, { type FotoEncargo } from "@/components/carteles/PlantillasCartel";
import {
  cargarActivos,
  cargarCola,
  cargarHistorial,
  cargarTareasPendientes,
  estaAtascado,
  proyectoEnCurso,
  resumenCola,
  type EncargoVista,
  type TareaVista,
} from "@/lib/encargos";
import { avanzarCola } from "@/lib/reparto";
import { cargarAvisos, cargarOficina, cargarTodosLosProyectos, marcarVisto, type DatosOficina } from "@/lib/datos";
import { plural } from "@/lib/estado";
import type { Aviso, Edificio } from "@/lib/tipos";

/** La cola del Director corre en segundo plano (after) en la página y en sus acciones: hasta 60 s. */
export const maxDuration = 60;

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

  // Al abrir (y en cada refresco) la cola sigue avanzando: empieza el siguiente o continúa el que espera.
  after(avanzarCola);

  const director = datos.agentes.find((a) => a.despacho === "direccion" && a.tipo === "direccion");
  const [cola, enCurso, avisos] = await Promise.all([
    resumenCola(),
    proyectoEnCurso(),
    cargarAvisos().catch((): Aviso[] => []),
  ]);
  // El cartel de Dirección: el proyecto del encargo en curso o, si no hay ninguno, "MI OFICINA".
  const proyectoCartel = datos.proyectos.find((p) => p.id === enCurso);

  const agente = datos.agentes.find((a) => a.id === agenteId);
  if (agente) {
    // Abrir la ficha cuenta como "visto": su luz verde se apaga.
    await marcarVisto(agente.id);
    agente.sinVer = 0;
  }

  // Paneles: "Proyectos" (botón de la cabecera) o la carpeta "Equipo" de la estantería del Director.
  const panel = agente ? undefined : params.panel;
  const equipoAbierto = panel === "equipo";
  let todosLosProyectos: Edificio[] | undefined;
  let errorProyectos: string | null = null;
  if (panel === "proyectos") {
    try {
      todosLosProyectos = await cargarTodosLosProyectos();
    } catch (e) {
      errorProyectos = e instanceof Error ? e.message : String(e);
    }
  }

  const esDirector = agente !== undefined && agente.id === director?.id;
  let colaDirector: EncargoVista[] = [];
  let historial: EncargoVista[] = [];
  let activos: EncargoVista[] = [];
  let errorCola: string | null = null;
  if (esDirector) {
    try {
      [colaDirector, historial, activos] = await Promise.all([cargarCola(), cargarHistorial(), cargarActivos()]);
    } catch (e) {
      errorCola = e instanceof Error ? e.message : String(e);
    }
  }
  // Los demás agentes: sus tareas pendientes.
  let tareas: TareaVista[] = [];
  let errorTareas: string | null = null;
  if (agente && !esDirector) {
    try {
      tareas = await cargarTareasPendientes(agente.id);
    } catch (e) {
      errorTareas = e instanceof Error ? e.message : String(e);
    }
  }
  // El Diseñador puede usar en sus plantillas las fotos adjuntas a los encargos.
  let fotosEncargos: FotoEncargo[] = [];
  if (agente?.despacho === "diseno") {
    const encargos = await Promise.all([cargarCola(), cargarHistorial()]).then((r) => r.flat()).catch((): EncargoVista[] => []);
    fotosEncargos = encargos.flatMap((e) =>
      e.adjuntos.flatMap((a) => (a.tipo === "imagen" && a.url ? [{ url: a.url, nombre: a.nombre, proyecto: e.proyecto.nombre }] : [])),
    );
  }
  const corbata = proyectoCartel ? letreroDe(proyectoCartel).colorSecundario : "#F5B841";

  return (
    <>
      {/* Mientras el Director trabaja (o hay cola que puede empezar), la página se refresca sola. */}
      <AutoRefresco activo={datos.hayEnCurso || (cola.total > 0 && !director?.reparto?.error)} />
      <Header directorId={director?.id} avisos={avisos} proyectosAbierto={panel === "proyectos"} />
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
              equipoAbierto={equipoAbierto}
            />
          </div>
        </main>

        {todosLosProyectos && (
          <PanelProyectos
            proyectos={todosLosProyectos}
            seleccionado={typeof params.proyecto === "string" ? params.proyecto : undefined}
          />
        )}
        {errorProyectos && (
          <p role="alert" className="w-[460px] shrink-0 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
            {errorProyectos}
          </p>
        )}
        {equipoAbierto && <PanelProyecto agentes={datos.agentes} />}

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
                    <RepartoDirector activos={activos.map((e) => ({ ...e, atascado: estaAtascado(e) }))} />
                    <ColaDirector cola={colaDirector} />
                    <HistorialEncargos encargos={historial} />
                  </>
                )}
              </>
            ) : (
              <>
                <TareasAgente tareas={tareas} error={errorTareas} />
                {agente.despacho === "diseno" && (
                  <PlantillasCartel
                    proyectos={datos.proyectos.map((p) => {
                      const l = letreroDe(p);
                      return { id: p.id, nombre: l.principal, secundario: l.secundario, color: l.color, colorSecundario: l.colorSecundario };
                    })}
                    fotos={fotosEncargos}
                  />
                )}
              </>
            )}
          </FichaAgente>
        )}
      </div>
    </>
  );
}
