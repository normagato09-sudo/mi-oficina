"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { toPng } from "html-to-image";
import Cartel from "@/components/carteles/Cartel";
import { PLANTILLAS, TAMANOS, type CartelDiseñador, type MarcaCartel } from "@/lib/carteles";
import type { EncargoVista } from "@/lib/encargos";
import { textoDeResultado, type Resultado, type Riesgo } from "@/lib/trabajos";

type Props = {
  resultado: Resultado;
  /** El encargo de la tarea: sus imágenes (Instagram, Diseñador) y su proyecto (colores del cartel). */
  encargo: EncargoVista;
  /** Texto editado por la CEO (resultados sin campos propios): se muestra en lugar del original. */
  textoEditado?: string | null;
  /** Solo el Diseñador: el botón pasa a ser "Descargar PNG y aprobar" y esto se llama tras descargar. */
  alDescargarCartel?: () => Promise<void>;
};

/** Botón "Copiar" (texto al portapapeles) con confirmación. */
export function BotonCopiar({ texto, etiqueta = "Copiar" }: { texto: string; etiqueta?: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      className="min-h-9 shrink-0 rounded-md border border-line px-3 text-xs font-semibold hover:border-muted"
      onClick={async () => {
        await navigator.clipboard.writeText(texto);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 1800);
      }}
    >
      <span aria-live="polite">{copiado ? "¡Copiado!" : etiqueta}</span>
    </button>
  );
}

/** Imágenes adjuntas del encargo, en orden (la "imagen nº N" del agente es la N-ésima de estas). */
function imagenesDe(encargo: EncargoVista) {
  return encargo.adjuntos.flatMap((a) => (a.tipo === "imagen" ? [a] : []));
}

/* ───────────── Texto con formato (Markdown sencillo del Redactor) ───────────── */

function enLinea(texto: string): ReactNode[] {
  // **negrita**
  return texto.split(/(\*\*[^*]+\*\*)/g).map((trozo, i) =>
    trozo.startsWith("**") && trozo.endsWith("**") ? <strong key={i}>{trozo.slice(2, -2)}</strong> : <Fragment key={i}>{trozo}</Fragment>,
  );
}

/** Títulos (#), listas (- o 1.), negritas y párrafos. Sin HTML: nunca se inyecta nada. */
export function TextoConFormato({ texto }: { texto: string }) {
  const bloques: ReactNode[] = [];
  let lista: { ordenada: boolean; items: string[] } | null = null;
  let parrafo: string[] = [];
  const cerrar = () => {
    if (parrafo.length) bloques.push(<p key={bloques.length}>{enLinea(parrafo.join(" "))}</p>);
    parrafo = [];
    if (lista) {
      const items = lista.items.map((it, i) => <li key={i}>{enLinea(it)}</li>);
      bloques.push(
        lista.ordenada ? (
          <ol key={bloques.length} className="list-decimal pl-5">
            {items}
          </ol>
        ) : (
          <ul key={bloques.length} className="list-disc pl-5">
            {items}
          </ul>
        ),
      );
    }
    lista = null;
  };
  for (const linea of texto.split("\n")) {
    const t = linea.trim();
    const titulo = /^(#{1,3})\s+(.*)$/.exec(t);
    const vineta = /^[-*•]\s+(.*)$/.exec(t);
    const numero = /^\d+[.)]\s+(.*)$/.exec(t);
    if (!t) cerrar();
    else if (titulo) {
      cerrar();
      const nivel = titulo[1]!.length;
      bloques.push(
        <p key={bloques.length} className={`font-display font-extrabold ${nivel === 1 ? "text-lg" : "text-base"}`}>
          {enLinea(titulo[2]!)}
        </p>,
      );
    } else if (vineta || numero) {
      const ordenada = Boolean(numero);
      if (parrafo.length || (lista && lista.ordenada !== ordenada)) cerrar();
      lista ??= { ordenada, items: [] };
      lista.items.push((vineta ?? numero)![1]!);
    } else {
      if (lista) cerrar();
      parrafo.push(t);
    }
  }
  cerrar();
  return <div className="flex flex-col gap-2 text-sm leading-relaxed">{bloques}</div>;
}

/* ───────────── Cartel del Diseñador ───────────── */

const ANCHO_PREVIA = 340;

function nombreArchivo(...partes: string[]): string {
  return `${partes
    .join("-")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)}.png`;
}

/** El cartel ya montado con su plantilla, los colores del proyecto y (si la lleva) la foto adjunta. */
function CartelListo({ cartel, encargo, alDescargar }: { cartel: CartelDiseñador; encargo: EncargoVista; alDescargar?: () => Promise<void> }) {
  const nodo = useRef<HTMLDivElement>(null);
  const [foto, setFoto] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ error?: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const { ancho, alto } = TAMANOS[cartel.tamano];
  const escala = ANCHO_PREVIA / ancho;
  const urlFoto = cartel.plantilla === "foto" && cartel.foto !== null ? (imagenesDe(encargo)[cartel.foto]?.url ?? null) : null;
  const marca: MarcaCartel = {
    nombre: encargo.proyecto.letrero,
    secundario: encargo.proyecto.letreroSecundario,
    color: encargo.proyecto.color,
    colorSecundario: encargo.proyecto.colorSecundario,
  };

  // La foto se convierte en data URL: así el PNG no depende de otro dominio.
  useEffect(() => {
    if (!urlFoto) return;
    let vigente = true;
    fetch(urlFoto)
      .then((r) => r.blob())
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const lector = new FileReader();
            lector.onload = () => resolve(String(lector.result));
            lector.onerror = () => reject(lector.error);
            lector.readAsDataURL(blob);
          }),
      )
      .then((dataUrl) => vigente && setFoto(dataUrl))
      .catch(() => vigente && setMensaje({ error: true, texto: "No se pudo cargar la foto del encargo." }));
    return () => {
      vigente = false;
    };
  }, [urlFoto]);

  async function descargar() {
    if (!nodo.current) return;
    setOcupado(true);
    setMensaje(null);
    try {
      await document.fonts?.ready;
      const png = await toPng(nodo.current, { width: ancho, height: alto, pixelRatio: 1, cacheBust: true });
      const enlace = document.createElement("a");
      enlace.href = png;
      enlace.download = nombreArchivo(marca.nombre, PLANTILLAS[cartel.plantilla], `${ancho}x${alto}`);
      enlace.click();
      setMensaje({ texto: "Cartel descargado." });
      await alDescargar?.();
    } catch (e) {
      setMensaje({ error: true, texto: `No se pudo crear el PNG (${e instanceof Error ? e.message : String(e)}).` });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted">
        {PLANTILLAS[cartel.plantilla]} · {TAMANOS[cartel.tamano].nombre}
      </p>
      <div className="overflow-hidden rounded-lg border border-line" style={{ width: ANCHO_PREVIA, height: alto * escala }} role="img" aria-label="Cartel del Diseñador">
        <div style={{ width: ancho, height: alto, transform: `scale(${escala})`, transformOrigin: "top left" }}>
          <Cartel ref={nodo} plantilla={cartel.plantilla} tamano={cartel.tamano} textos={cartel.textos} marca={marca} foto={foto} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className="btn-primary" onClick={descargar} disabled={ocupado || (Boolean(urlFoto) && !foto)}>
          {ocupado ? "Un momento…" : alDescargar ? "Descargar PNG y aprobar" : "Descargar PNG"}
        </button>
        <p role="status" aria-live="polite" className={`text-sm ${mensaje?.error ? "text-red-400" : "text-muted"}`}>
          {mensaje?.texto}
        </p>
      </div>
    </div>
  );
}

/* ───────────── Cada tipo de resultado ───────────── */

const COLOR_RIESGO: Record<Riesgo, string> = {
  alto: "border-red-500/60 bg-red-500/10",
  medio: "border-amber-400/60 bg-amber-400/10",
  bajo: "border-emerald-400/50 bg-emerald-400/10",
};
const ETIQUETA_RIESGO: Record<Riesgo, string> = { alto: "Riesgo alto", medio: "Riesgo medio", bajo: "Riesgo bajo" };

function Lista({ titulo, items }: { titulo: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{titulo}</p>
      {items.length ? (
        <ul className="mt-1 list-disc pl-5 text-sm leading-relaxed">
          {items.map((i, n) => (
            <li key={n}>{i}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted">—</p>
      )}
    </div>
  );
}

/** El resultado de un agente bien presentado según su tipo, con su botón "Copiar". */
export default function ResultadoTrabajo({ resultado, encargo, textoEditado, alDescargarCartel }: Props) {
  // Si edité el texto entero (código, informes…), se ve mi versión con formato.
  if (textoEditado) {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-line bg-ink/60 p-3">
          <TextoConFormato texto={textoEditado} />
        </div>
        <div className="flex">
          <BotonCopiar texto={textoEditado} />
        </div>
      </div>
    );
  }
  const copiarTodo = <BotonCopiar texto={textoDeResultado(resultado)} />;
  switch (resultado.tipo) {
    case "redes": {
      const imagenes = imagenesDe(encargo);
      const { caption, hashtags } = resultado.datos;
      // Solo las imágenes que existen de verdad en el encargo.
      const elegidas = resultado.datos.imagenes.filter((img) => imagenes[img.numero]);
      return (
        <div className="flex flex-col gap-3">
          {elegidas.length > 0 && (
            <ol className="flex gap-2 overflow-x-auto" aria-label="Imágenes de la publicación, en orden">
              {elegidas.map((img, i) => {
                const adjunto = imagenes[img.numero];
                return (
                  <li key={i} className="shrink-0">
                    {adjunto?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- miniatura firmada de Storage
                      <img src={adjunto.url} alt={img.alt} className="h-28 w-auto rounded-md border border-line object-cover" />
                    ) : (
                      <span className="block rounded-md border border-line p-2 text-xs text-muted">Imagen nº {img.numero}</span>
                    )}
                    <p className="mt-1 max-w-40 text-xs text-muted" title={img.alt}>
                      {i + 1}. Alt: {img.alt}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
          <div className="rounded-lg border border-line bg-ink/60 p-3">
            <p className="whitespace-pre-line text-sm leading-relaxed">{caption}</p>
            {hashtags.length > 0 && <p className="mt-2 text-sm text-accent">{hashtags.join(" ")}</p>}
          </div>
          <div className="flex gap-2">
            <BotonCopiar texto={`${caption}${hashtags.length ? `\n\n${hashtags.join(" ")}` : ""}`} etiqueta="Copiar texto" />
          </div>
        </div>
      );
    }
    case "diseno":
      return <CartelListo cartel={resultado.datos} encargo={encargo} alDescargar={alDescargarCartel} />;
    case "traduccion":
      return (
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-line bg-ink/60 p-3">
            {resultado.datos.idioma && <p className="mb-1 text-xs text-muted">{resultado.datos.idioma}</p>}
            <p className="whitespace-pre-line text-sm leading-relaxed">{resultado.datos.texto}</p>
          </div>
          <div className="flex">
            <BotonCopiar texto={resultado.datos.texto} etiqueta="Copiar texto" />
          </div>
          {resultado.datos.cambios.length > 0 && <Lista titulo="Cambios" items={resultado.datos.cambios} />}
        </div>
      );
    case "redaccion":
      return (
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-line bg-ink/60 p-3">
            {resultado.datos.titulo && <p className="mb-2 font-display text-lg font-extrabold">{resultado.datos.titulo}</p>}
            <TextoConFormato texto={resultado.datos.texto} />
          </div>
          <div className="flex">{copiarTodo}</div>
        </div>
      );
    case "programacion":
      return (
        <div className="flex flex-col gap-3">
          <p className="text-sm leading-relaxed">{resultado.datos.explicacion}</p>
          {resultado.datos.bloques.map((b, i) => (
            <div key={i} className="overflow-hidden rounded-lg border border-line">
              <div className="flex items-center justify-between gap-2 border-b border-line bg-panel-2 px-3 py-1.5">
                <span className="text-xs text-muted">
                  {b.lenguaje || "código"}
                  {b.descripcion && ` · ${b.descripcion}`}
                </span>
                <BotonCopiar texto={b.codigo} />
              </div>
              <pre className="max-h-80 overflow-auto bg-ink p-3 text-xs leading-relaxed">
                <code>{b.codigo}</code>
              </pre>
            </div>
          ))}
        </div>
      );
    case "ciberseguridad":
      return (
        <div className="flex flex-col gap-3">
          {resultado.datos.resumen && <p className="text-sm leading-relaxed">{resultado.datos.resumen}</p>}
          {resultado.datos.problemas.length === 0 && <p className="text-sm text-muted">No ha encontrado problemas.</p>}
          {resultado.datos.problemas.map((p, i) => (
            <div key={i} className={`rounded-lg border p-3 ${COLOR_RIESGO[p.riesgo]}`}>
              <p className="text-xs font-bold uppercase tracking-wide">{ETIQUETA_RIESGO[p.riesgo]}</p>
              <p className="mt-0.5 font-semibold">{p.titulo}</p>
              <p className="mt-1 text-sm leading-relaxed">{p.explicacion}</p>
              {p.pasos.length > 0 && (
                <ol className="mt-2 list-decimal pl-5 text-sm leading-relaxed">
                  {p.pasos.map((paso, n) => (
                    <li key={n}>{paso}</li>
                  ))}
                </ol>
              )}
            </div>
          ))}
          <div className="flex">{copiarTodo}</div>
        </div>
      );
    case "secretaria": {
      const f = resultado.datos.ficha;
      const filas: [string, string][] = [
        ["Nombre", f.nombre],
        ["Discord", f.discord],
        ["País", f.pais],
        ["Correo", f.correo],
        ["Cumpleaños", f.cumpleanos],
        ["Cursos", f.cursos.join(", ")],
      ];
      return (
        <div className="flex flex-col gap-3">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg border border-line bg-ink/60 p-3 text-sm">
            {filas.map(([k, v]) => (
              <Fragment key={k}>
                <dt className="text-muted">{k}</dt>
                <dd>{v || <span className="text-red-300">falta</span>}</dd>
              </Fragment>
            ))}
          </dl>
          {resultado.datos.faltan.length > 0 && <Lista titulo="Datos que faltan" items={resultado.datos.faltan} />}
          <div className="flex">{copiarTodo}</div>
        </div>
      );
    }
    case "informes":
      return (
        <div className="flex flex-col gap-4">
          {resultado.datos.proyectos.map((p, i) => (
            <div key={i} className="rounded-lg border border-line bg-ink/60 p-3">
              <p className="font-display font-extrabold">{p.proyecto}</p>
              <div className="mt-2 flex flex-col gap-2">
                <Lista titulo="Hecho" items={p.hecho} />
                <Lista titulo="Pendiente" items={p.pendiente} />
                <Lista titulo="Esperando a la CEO" items={p.espera_ceo} />
              </div>
            </div>
          ))}
          {resultado.datos.prioridades.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Prioridades</p>
              <ol className="mt-1 list-decimal pl-5 text-sm leading-relaxed">
                {resultado.datos.prioridades.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ol>
            </div>
          )}
          <div className="flex">{copiarTodo}</div>
        </div>
      );
  }
}
