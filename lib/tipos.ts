export type EstadoPublicacion = "preparando" | "lista" | "publicando" | "publicada" | "error";

/** Un proyecto (cliente de la oficina). La tabla sigue llamándose "edificios". */
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
  /** Ficha del proyecto: qué es, tono y reglas. La leen los agentes cuando trabajan en un encargo suyo. */
  ficha?: string;
  /** false = proyecto oculto (migración 0007). */
  activo?: boolean;
  /** Cuenta de Instagram del proyecto (más adelante). */
  instagram?: string | null;
};

/** Despachos de la oficina (migración 0007). */
export type Despacho =
  | "direccion"
  | "redes"
  | "traduccion"
  | "redaccion"
  | "programacion"
  | "ciberseguridad"
  | "secretaria"
  | "diseno"
  | "informes"
  // Migración 0014:
  | "planificacion"
  | "comunidad"
  | "revision"
  | "web"
  | "rrhh"
  | "agenda"
  | "estrategia"
  | "finanzas"
  /** Jefe de una planta (migración 0013): de momento no trabaja (oculto). */
  | "jefatura";

export type Departamento = {
  id: string;
  edificio_id: string;
  nombre: string;
  orden: number;
};

export type Agente = {
  id: string;
  /** Restos de la estructura por edificios: los agentes de la oficina ya no tienen departamento. */
  departamento_id: string | null;
  /** Despacho de la oficina donde trabaja (migración 0007). */
  despacho?: Despacho | null;
  /** Planta del edificio (migración 0013; si falta, la de su despacho: ver lib/plantas.ts). */
  planta?: number | null;
  nombre: string;
  tipo: "redes" | "direccion" | "comunicacion" | "administracion" | Despacho;
  instrucciones: string;
  creado_en: string;
  /** Última vez que se abrió su ficha (migración 0003; puede faltar si aún no se ha ejecutado). */
  visto_en?: string;
  /** false = aún no trabaja: se ve en gris y "Próximamente" (migración 0004). */
  activo?: boolean;
  /** Aviso de la IA (p. ej. límite gratuito alcanzado): pone al agente en rojo (migración 0005). */
  aviso_ia?: string | null;
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
