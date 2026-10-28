import { cookies } from "next/headers";
import { after, connection } from "next/server";
import AutoRefresco from "@/components/AutoRefresco";
import Header from "@/components/Header";
import VistaOficina from "@/components/juego/VistaOficina";
import Oficina, { estiloAgente, letreroDe } from "@/components/oficina/Oficina";
import PanelFicha from "@/components/ficha/PanelFicha";
import { SinFicha } from "@/components/ficha/navegacion";
import PanelEquipo from "@/components/panel/PanelEquipo";
import PanelOrganizaciones from "@/components/panel/PanelOrganizaciones";
import { avanzarCola } from "@/lib/cola";
import { cargarAprendizajesEquipo } from "@/lib/aprendizajes";
import { cargarOficina, cargarTodasLasOrganizaciones, type DatosOficina } from "@/lib/datos";
import { estadoAgente, plural } from "@/lib/estado";
import { plantaDe } from "@/lib/plantas";
import type { Edificio } from "@/lib/tipos";

/** La cola del Director corre en segundo plano (after) en la página y en sus acciones: hasta 60 s. */
export const maxDuration = 60;

export default async function Home({ searchParams }: PageProps<"/">) {
  await connection();
  const [params, galletas] = await Promise.all([searchParams, cookies()]);
  // La última vista elegida (juego o clásica); la primera vez, el juego.
  const vista = galletas.get("vista")?.value === "clasica" ? "clasica" : "juego";
  // La ficha de un agente se abre y se cierra en el navegador (PanelFicha): aquí solo importa para no abrir otros paneles.
  const hayFicha = typeof params.agente === "string";
  const panel = hayFicha ? undefined : params.panel;

  let datos: DatosOficina;
  let todasLasOrganizaciones: Edificio[] | undefined;
  let aprendizajes: Awaited<ReturnType<typeof cargarAprendizajesEquipo>> = {};
  let errorOrganizaciones: string | null = null;
  try {
    // Todo a la vez: la oficina y, si están abiertos, el panel "Organizaciones" o la carpeta "Equipo".
    [datos, todasLasOrganizaciones, aprendizajes] = await Promise.all([
      cargarOficina(),
      panel === "organizaciones"
        ? cargarTodasLasOrganizaciones().catch((e: unknown) => {
            errorOrganizaciones = e instanceof Error ? e.message : String(e);
            return undefined;
          })
        : undefined,
      panel === "equipo" ? cargarAprendizajesEquipo() : {},
    ]);
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

  // Al abrir la oficina la cola sigue avanzando (empieza el siguiente o continúa el que espera), sin hacer esperar a la página.
  after(avanzarCola);

  const director = datos.agentes.find((a) => a.despacho === "direccion" && a.tipo === "direccion");
  // El cartel de Dirección: la organización del encargo en curso o, si no hay ninguno, "MI OFICINA".
  const organizacionCartel = datos.organizaciones.find((p) => p.id === datos.organizacionEnCurso);
  const corbata = organizacionCartel ? letreroDe(organizacionCartel).colorSecundario : "#F5B841";
  const equipoAbierto = panel === "equipo";

  return (
    <>
      {/* Mientras el Director trabaja (o hay cola que puede empezar), se mira si algo cambia. */}
      <AutoRefresco activo={datos.hayEnCurso} firma={datos.firma} />
      <Header directorId={director?.id} avisos={datos.avisos} panel={panel === "organizaciones" ? "organizaciones" : undefined} />
      <div className="mx-auto flex max-w-[1600px] items-start gap-6 px-6 py-4">
        <main className="min-w-0 flex-1">
          <VistaOficina
            inicial={vista}
            titulo={
              <div className="flex flex-wrap items-baseline gap-x-3">
                <h1 className="font-display text-xl font-extrabold tracking-tight">Mi Oficina</h1>
                <p className="text-sm text-muted">
                  {plural(datos.agentes.length, "agente", "agentes")} · trabajando para{" "}
                  {datos.organizaciones.length === 1 ? datos.organizaciones[0]!.nombre : plural(datos.organizaciones.length, "organización", "organizaciones")}
                </p>
              </div>
            }
            clasica={<Oficina datos={datos} enCola={datos.enCola} organizacionCartel={organizacionCartel} equipoAbierto={equipoAbierto} />}
            agentes={datos.agentes.map((a) => {
              const estado = estadoAgente(a, a.despacho === "direccion" ? datos.enCola : 0);
              return {
                id: a.id,
                nombre: a.nombre,
                despacho: a.despacho,
                planta: plantaDe(a),
                jefe: a.despacho === "jefatura" || (a.despacho === "direccion" && a.tipo === "direccion"),
                luz: estado.luz,
                texto: estado.texto,
                trabajando: estado.trabajando,
                inactivo: estado.inactivo,
                aspecto: estiloAgente(a, corbata).aspecto,
              };
            })}
          />
        </main>

        <SinFicha>
          {todasLasOrganizaciones && (
            <PanelOrganizaciones
              organizaciones={todasLasOrganizaciones}
              seleccionado={typeof params.organizacion === "string" ? params.organizacion : undefined}
            />
          )}
          {errorOrganizaciones && (
            <p role="alert" className="w-[460px] shrink-0 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
              {errorOrganizaciones}
            </p>
          )}
          {equipoAbierto && <PanelEquipo agentes={datos.agentes} aprendizajes={aprendizajes} />}
        </SinFicha>

        <PanelFicha
          agentes={datos.agentes}
          colores={Object.fromEntries(datos.agentes.map((a) => [a.id, estiloAgente(a, corbata).aspecto.camiseta]))}
          proyectos={datos.organizaciones.map((p) => {
            const l = letreroDe(p);
            return { id: p.id, nombre: l.principal, secundario: l.secundario, color: l.color, colorSecundario: l.colorSecundario };
          })}
          enCola={datos.enCola}
          firma={datos.firma}
        />
      </div>
    </>
  );
}
