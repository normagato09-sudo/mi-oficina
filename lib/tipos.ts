export type EstadoPublicacion = "preparando" | "lista" | "publicando" | "publicada" | "error";

/** Un proyecto: se dibuja como un edificio en la ciudad. */
export type Edificio = {
  id: string;
  nombre: string;
  color: string;
  creado_en: string;
  // Migración 0004 (pueden faltar si aún no se ha ejecutado):
  /** Texto principal del letrero (si falta, el nombre). */
  letrero?: string | null;
  letrero_secundario?: string | null;
  color_secundario?: string | null;
  idioma?: string;
  /** Decoración del interior: "campo" (Defensem), "escuela" (CIFA)… */
  estilo?: string;
  orden?: number;
  /** Ficha del proyecto: qué es, tono y reglas. Solo la leen los agentes de este edificio. */
  ficha?: string;
};

export type Departamento = {
  id: string;
  edificio_id: string;
  nombre: string;
  orden: number;
};

export type Agente = {
  id: string;
  departamento_id: string;
  nombre: string;
  tipo: "redes" | "direccion" | "comunicacion" | "administracion";
  instrucciones: string;
  creado_en: string;
  /** Última vez que se abrió su ficha (migración 0003; puede faltar si aún no se ha ejecutado). */
  visto_en?: string;
  /** false = aún no trabaja: se ve en gris y "Próximamente" (migración 0004). */
  activo?: boolean;
};

export type Publicacion = {
  id: string;
  agente_id: string;
  estado: EstadoPublicacion;
  texto_original: string;
  notas: string;
  caption: string | null;
  imagenes: string[];
  instagram_media_id: string | null;
  permalink: string | null;
  error: string | null;
  creado_en: string;
  actualizado_en: string;
};

export type Aviso = {
  id: string;
  publicacion_id: string | null;
  mensaje: string;
  leido: boolean;
  creado_en: string;
};
