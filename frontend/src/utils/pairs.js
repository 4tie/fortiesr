export function normalizePairs(pairs = []) {
  return [...new Set(
    pairs
      .map((pair) => String(pair || "").trim())
      .filter(Boolean)
  )];
}

export function pairsEqualUnordered(left = [], right = []) {
  const normalizedLeft = normalizePairs(left).map((pair) => pair.toUpperCase()).sort();
  const normalizedRight = normalizePairs(right).map((pair) => pair.toUpperCase()).sort();
  if (normalizedLeft.length !== normalizedRight.length) return false;
  return normalizedLeft.every((pair, index) => pair === normalizedRight[index]);
}
