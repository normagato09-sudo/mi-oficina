import Link from "next/link";
import Logo from "./Logo";
import Campana from "./Campana";
import { BotonNuevoEncargo } from "./ficha/navegacion";
import { logout } from "@/app/actions/auth";
import type { Aviso } from "@/lib/tipos";

type Props = {
  /** El Director: "+ Nuevo encargo" abre su formulario. */
  directorId?: string;
  avisos?: Aviso[];
  /** Panel de la cabecera que está abierto: su botón lo cierra. */
  panel?: "organizaciones";
};

export default function Header({ directorId, avisos = [], panel }: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-6 py-3">
        <Link href="/" className="flex min-h-11 shrink-0 items-center gap-2.5 rounded-lg pr-1">
          <Logo />
          <span className="font-display text-lg font-extrabold tracking-tight">Mi Oficina</span>
        </Link>

        <div className="flex-1" />

        <Link
          href={panel === "organizaciones" ? "/" : "/?panel=organizaciones"}
          scroll={false}
          aria-current={panel === "organizaciones" ? "true" : undefined}
          className="btn-secondary"
        >
          Organizaciones
        </Link>

        {directorId && <BotonNuevoEncargo directorId={directorId} />}

        <Campana avisos={avisos} />

        <form action={logout}>
          <button
            type="submit"
            className="min-h-11 min-w-11 rounded-lg px-2 text-sm text-muted hover:text-text"
            title="Cerrar sesión"
          >
            Salir
          </button>
        </form>
      </div>
    </header>
  );
}
