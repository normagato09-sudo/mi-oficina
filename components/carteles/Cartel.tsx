"use client";

import { forwardRef, useLayoutEffect, useRef, type CSSProperties } from "react";
import { TAMANOS, type MarcaCartel, type Plantilla, type Tamano } from "@/lib/carteles";

type Props = {
  plantilla: Plantilla;
  tamano: Tamano;
  textos: Record<string, string>;
  marca: MarcaCartel;
  /** Foto de fondo (data URL) para la plantilla "Anuncio con foto". */
  foto?: string | null;
};

const PADDING = 80;
const FUENTE_TITULOS = "var(--font-archivo), var(--font-inter), system-ui, sans-serif";
const FUENTE_TEXTO = "var(--font-inter), system-ui, sans-serif";

/* ───────────── Colores ───────────── */

function rgb(hex: string): [number, number, number] {
  const h = /^#?([0-9a-f]{6})$/i.exec(hex)?.[1] ?? "3f60de";
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function rgba(hex: string, alfa: number): string {
  return `rgba(${rgb(hex).join(", ")}, ${alfa})`;
}

/** Texto blanco o casi negro, el que más contraste tenga con el fondo. */
function tintaSobre(hex: string): string {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (1.05 / (l + 0.05)) >= ((l + 0.05) / 0.05) ? "#ffffff" : "#14182a";
}

/* ───────────── Texto que se encoge solo ───────────── */

type TextoProps = {
  texto: string;
  /** Tamaño de letra máximo y mínimo (px del cartel). */
  max: number;
  min: number;
  /** Alto de la caja; sin él, ocupa el espacio libre (flex: 1). */
  alto?: number;
  /** Una sola línea. */
  linea?: boolean;
  alinear?: "start" | "center" | "end";
  style?: CSSProperties;
};

/**
 * Caja de texto que reduce su letra hasta que el texto quepa (búsqueda binaria entre max y min).
 * Si ni con la letra mínima cabe, la caja lo recorta: nunca se sale del cartel.
 */
function TextoAjustable({ texto, max, min, alto, linea = false, alinear = "start", style }: TextoProps) {
  const caja = useRef<HTMLDivElement>(null);
  const interior = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const c = caja.current;
    const t = interior.current;
    if (!c || !t) return;
    const ajustar = () => {
      const cabe = (px: number) => {
        t.style.fontSize = `${px}px`;
        return t.scrollHeight <= c.clientHeight + 1 && t.scrollWidth <= c.clientWidth + 1;
      };
      let lo = min;
      let hi = max;
      if (cabe(hi)) return;
      while (hi - lo > 1) {
        const medio = Math.floor((lo + hi) / 2);
        if (cabe(medio)) lo = medio;
        else hi = medio;
      }
      t.style.fontSize = `${lo}px`;
    };
    ajustar();
    // Cuando terminan de cargar las fuentes, cambian las medidas.
    let vivo = true;
    document.fonts?.ready.then(() => vivo && ajustar());
    return () => {
      vivo = false;
    };
  }, [texto, max, min, alto, linea]);

  return (
    <div
      ref={caja}
      style={{
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: alinear === "start" ? "flex-start" : alinear === "end" ? "flex-end" : "center",
        ...(alto ? { height: alto, flexShrink: 0 } : { flex: 1, minHeight: 0 }),
      }}
    >
      <div
        ref={interior}
        style={{
          fontSize: max,
          lineHeight: 1.12,
          whiteSpace: linea ? "nowrap" : "pre-line",
          overflowWrap: "anywhere",
          ...style,
        }}
      >
        {texto}
      </div>
    </div>
  );
}

/* ───────────── Piezas comunes ───────────── */

/** Nombre del proyecto en una esquina. */
function Marca({ marca, tinta, fondo }: { marca: MarcaCartel; tinta: string; fondo: string }) {
  return (
    <div
      style={{
        position: "absolute",
        left: PADDING,
        top: PADDING - 20,
        maxWidth: 620,
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "14px 26px",
        borderRadius: 999,
        background: fondo,
        color: tinta,
      }}
    >
      <span style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, background: marca.colorSecundario, boxShadow: `0 0 0 3px ${tinta}` }} />
      <div style={{ maxWidth: 520, minWidth: 0 }}>
        <TextoAjustable
          texto={marca.secundario ? `${marca.nombre} · ${marca.secundario}` : marca.nombre}
          max={32}
          min={16}
          alto={40}
          linea
          alinear="center"
          style={{ fontFamily: FUENTE_TITULOS, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase" }}
        />
      </div>
    </div>
  );
}

/* ───────────── Las tres plantillas ───────────── */

function Convocatoria({ textos, marca, alto }: { textos: Record<string, string>; marca: MarcaCartel; alto: number }) {
  const tinta = tintaSobre(marca.color);
  const tintaCta = tintaSobre(marca.colorSecundario);
  const datos = [
    ["FECHA", textos.fecha],
    ["HORA", textos.hora],
    ["LUGAR", textos.lugar],
  ].filter(([, v]) => v?.trim());
  return (
    <div style={{ position: "absolute", inset: 0, background: marca.color, color: tinta, overflow: "hidden" }}>
      {/* Franja diagonal con el color secundario */}
      <div
        style={{
          position: "absolute",
          right: -330,
          top: -200,
          width: 520,
          height: alto + 400,
          background: marca.colorSecundario,
          opacity: 0.9,
          transform: "rotate(18deg)",
        }}
      />
      <div style={{ position: "absolute", right: 0, bottom: 0, width: 360, height: 360, borderRadius: "50%", background: rgba(tinta, 0.08), transform: "translate(35%, 35%)" }} />
      <Marca marca={marca} tinta={tinta} fondo={rgba(tinta === "#ffffff" ? "#000000" : "#ffffff", 0.18)} />

      <div style={{ position: "absolute", inset: PADDING, top: PADDING + 90, display: "flex", flexDirection: "column", gap: 28 }}>
        <TextoAjustable
          texto={textos.titulo || " "}
          max={150}
          min={44}
          alinear="end"
          style={{ fontFamily: FUENTE_TITULOS, fontWeight: 800, lineHeight: 1.02, letterSpacing: "-0.02em", maxWidth: 800 }}
        />
        {textos.subtitulo?.trim() && (
          <TextoAjustable texto={textos.subtitulo} max={50} min={24} alto={alto > 1100 ? 170 : 130} style={{ fontFamily: FUENTE_TEXTO, fontWeight: 500, opacity: 0.92, maxWidth: 760 }} />
        )}
        {datos.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 800, paddingTop: 22, borderTop: `4px solid ${rgba(tinta, 0.35)}` }}>
            {datos.map(([etiqueta, valor]) => (
              <div key={etiqueta} style={{ display: "flex", alignItems: "center", gap: 22 }}>
                <span style={{ width: 120, flexShrink: 0, fontFamily: FUENTE_TEXTO, fontSize: 22, fontWeight: 700, letterSpacing: "0.12em", opacity: 0.75 }}>{etiqueta}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <TextoAjustable texto={valor!} max={42} min={18} alto={60} alinear="center" style={{ fontFamily: FUENTE_TEXTO, fontWeight: 700 }} />
                </div>
              </div>
            ))}
          </div>
        )}
        {textos.llamada?.trim() && (
          <div style={{ alignSelf: "flex-start", maxWidth: "100%", padding: "18px 36px", borderRadius: 999, background: marca.colorSecundario, color: tintaCta, boxShadow: "0 8px 0 rgba(0,0,0,0.2)" }}>
            <div style={{ width: 760, maxWidth: "100%" }}>
              <TextoAjustable texto={textos.llamada} max={40} min={18} alto={52} alinear="center" style={{ fontFamily: FUENTE_TITULOS, fontWeight: 800 }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Frase({ textos, marca, alto }: { textos: Record<string, string>; marca: MarcaCartel; alto: number }) {
  const tinta = tintaSobre(marca.color);
  return (
    <div style={{ position: "absolute", inset: 0, background: marca.color, color: tinta, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: -180, bottom: -180, width: 520, height: 520, borderRadius: "50%", background: marca.colorSecundario, opacity: 0.85 }} />
      <div style={{ position: "absolute", right: -120, top: -120, width: 340, height: 340, borderRadius: "50%", border: `40px solid ${rgba(tinta, 0.1)}` }} />
      <Marca marca={marca} tinta={tinta} fondo={rgba(tinta === "#ffffff" ? "#000000" : "#ffffff", 0.18)} />

      <div style={{ position: "absolute", inset: PADDING, top: PADDING + 110, bottom: PADDING + 40, display: "flex", flexDirection: "column", gap: 36 }}>
        <TextoAjustable
          texto={textos.frase || " "}
          max={alto > 1100 ? 240 : 210}
          min={44}
          alinear="center"
          style={{ fontFamily: FUENTE_TITULOS, fontWeight: 800, lineHeight: 1.02, letterSpacing: "-0.025em", textAlign: "center" }}
        />
        <div style={{ width: 140, height: 10, borderRadius: 5, alignSelf: "center", background: marca.colorSecundario, boxShadow: `0 0 0 3px ${rgba(tinta, 0.35)}` }} />
        {textos.contexto?.trim() && (
          <TextoAjustable texto={textos.contexto} max={46} min={22} alto={170} style={{ fontFamily: FUENTE_TEXTO, fontWeight: 500, textAlign: "center", opacity: 0.92 }} />
        )}
      </div>
    </div>
  );
}

function Foto({ textos, marca, foto, alto }: { textos: Record<string, string>; marca: MarcaCartel; foto?: string | null; alto: number }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: marca.color, color: "#ffffff", overflow: "hidden" }}>
      {foto ? (
        // eslint-disable-next-line @next/next/no-img-element -- se exporta a PNG: hace falta un <img> normal
        <img src={foto} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `repeating-linear-gradient(45deg, ${rgba("#ffffff", 0.06)} 0 40px, transparent 40px 80px), ${marca.color}`,
          }}
        />
      )}
      {/* Degradado: de transparente arriba al color del proyecto (oscurecido) abajo */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 38%, ${rgba(marca.color, 0.75)} 68%, rgba(8,10,20,0.94) 100%)`,
        }}
      />
      <Marca marca={marca} tinta="#ffffff" fondo={rgba("#000000", 0.4)} />

      <div style={{ position: "absolute", left: PADDING, right: PADDING, bottom: PADDING, height: alto * 0.5, display: "flex", flexDirection: "column", gap: 22 }}>
        <TextoAjustable
          texto={textos.titulo || " "}
          max={130}
          min={40}
          alinear="end"
          style={{ fontFamily: FUENTE_TITULOS, fontWeight: 800, lineHeight: 1.02, letterSpacing: "-0.02em", textShadow: "0 4px 18px rgba(0,0,0,0.45)" }}
        />
        <div style={{ width: 120, height: 10, borderRadius: 5, flexShrink: 0, background: marca.colorSecundario }} />
        {textos.texto?.trim() && (
          <TextoAjustable texto={textos.texto} max={44} min={22} alto={alto > 1100 ? 200 : 160} style={{ fontFamily: FUENTE_TEXTO, fontWeight: 500, textShadow: "0 2px 10px rgba(0,0,0,0.5)" }} />
        )}
      </div>
    </div>
  );
}

/** El cartel a tamaño real (1080 px de ancho). Para la vista previa, el padre lo escala. */
const Cartel = forwardRef<HTMLDivElement, Props>(function Cartel({ plantilla, tamano, textos, marca, foto }, ref) {
  const { ancho, alto } = TAMANOS[tamano];
  return (
    <div ref={ref} style={{ position: "relative", width: ancho, height: alto, overflow: "hidden" }}>
      {plantilla === "convocatoria" && <Convocatoria textos={textos} marca={marca} alto={alto} />}
      {plantilla === "frase" && <Frase textos={textos} marca={marca} alto={alto} />}
      {plantilla === "foto" && <Foto textos={textos} marca={marca} foto={foto} alto={alto} />}
    </div>
  );
});

export default Cartel;
