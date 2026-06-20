import { useMemo, useState } from "react";
import { DEFAULT_SORT } from "../constants";
import { sortResults } from "../utils";

export function useSortableResults(results = []) {
  const [sortCol, setSortCol] = useState(DEFAULT_SORT.column);
  const [sortDir, setSortDir] = useState(DEFAULT_SORT.direction);

  const toggleSort = (column) => {
    if (sortCol === column) {
      setSortDir((direction) => (direction === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(column);
      setSortDir("desc");
    }
  };

  const sortedResults = useMemo(
    () => sortResults(results, sortCol, sortDir),
    [results, sortCol, sortDir]
  );

  return {
    sortCol,
    sortDir,
    sortedResults,
    toggleSort,
  };
}
