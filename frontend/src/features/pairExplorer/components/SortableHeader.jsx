function SortIcon({ column, sortCol, sortDir }) {
  if (column !== sortCol) return <span className="ml-1 opacity-20">↕</span>;
  return <span className="ml-1 opacity-70">{sortDir === "asc" ? "↑" : "↓"}</span>;
}

export default function SortableHeader({ column, sortCol, sortDir, onSort, children }) {
  return (
    <th
      className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-base-content/40 cursor-pointer select-none hover:text-base-content/70 transition-colors whitespace-nowrap"
      onClick={() => onSort(column)}
    >
      {children}
      <SortIcon column={column} sortCol={sortCol} sortDir={sortDir} />
    </th>
  );
}
