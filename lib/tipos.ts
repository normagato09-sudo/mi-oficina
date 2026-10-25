export type EstadoPublicacion = "preparando" | "lista" | "publicando" | "publicada" | "error";

export type Edificio = {
  id: string;
  nombre: string;
  color: string;
  creado_en: string;
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
  tipo: "redes" | "direccion";
  instrucciones: string;
  creado_en: string;
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
