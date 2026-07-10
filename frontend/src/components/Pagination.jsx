import { useEffect, useState } from "react";

export default function Pagination({ page, totalPages, onPageChange }) {
  const [pageInput, setPageInput] = useState(String(page));

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  if (totalPages <= 1) return null;

  function goToPage(event) {
    event.preventDefault();
    const nextPage = Number(pageInput);
    if (!Number.isInteger(nextPage)) return;
    onPageChange(Math.min(Math.max(nextPage, 1), totalPages));
  }

  return (
    <div className="flex flex-col gap-3 border-t border-emerald-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <button
        className="rounded-lg border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </button>
      <span className="text-sm font-medium text-gray-600">
        Page {page} of {totalPages}
      </span>
      <form className="flex items-center justify-center gap-2" onSubmit={goToPage}>
        <label className="text-sm font-medium text-gray-600" htmlFor="go-to-page">
          Go to
        </label>
        <input
          id="go-to-page"
          className="h-10 w-20 rounded-lg border border-emerald-100 px-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          min="1"
          max={totalPages}
          type="number"
          value={pageInput}
          onChange={(event) => setPageInput(event.target.value)}
        />
        <button className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700" type="submit">
          Go
        </button>
      </form>
      <button
        className="rounded-lg border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={page === totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
    </div>
  );
}
