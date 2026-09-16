export function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex items-center justify-between mt-4 text-[12.5px] text-ink-soft">
      <span>
        {from}–{to} of {total}
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="border border-border rounded px-2.5 py-1 disabled:opacity-40 hover:bg-track"
        >
          Previous
        </button>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className="border border-border rounded px-2.5 py-1 disabled:opacity-40 hover:bg-track"
        >
          Next
        </button>
      </div>
    </div>
  );
}
