export default function Logo() {
  return (
    <span
      aria-hidden="true"
      className="grid size-9 shrink-0 grid-cols-2 gap-1 rounded-lg bg-accent p-1.5 shadow-[0_2px_0_#b8862a]"
    >
      <span className="rounded-[2px] bg-ink" />
      <span className="rounded-[2px] bg-ink/70" />
      <span className="rounded-[2px] bg-ink/70" />
      <span className="rounded-[2px] bg-ink" />
    </span>
  );
}
