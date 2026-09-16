export function ComingSoon({ title }: { title: string }) {
  return (
    <div>
      <h1 className="font-serif text-2xl text-ink mb-2">{title}</h1>
      <p className="text-[13.5px] text-ink-soft">
        This screen isn't built yet in this scaffold — see the backend API for the endpoints it will use.
      </p>
    </div>
  );
}
