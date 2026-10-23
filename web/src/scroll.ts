export interface ScrollAnchor { source: number; target: number }

/** Piecewise proportional mapping, clamped at the document boundaries. */
export function interpolate(value: number, anchors: ScrollAnchor[]): number {
  const points = anchors.filter(point => Number.isFinite(point.source) && Number.isFinite(point.target))
    .sort((a, b) => a.source - b.source);
  const unique: ScrollAnchor[] = [];
  for (const point of points) {
    if (unique.at(-1)?.source === point.source) unique[unique.length - 1] = point;
    else unique.push(point);
  }
  if (!unique.length) return Number.isFinite(value) ? value : 0;
  if (!Number.isFinite(value) || value <= unique[0].source) return unique[0].target;
  const last = unique[unique.length - 1];
  if (value >= last.source) return last.target;
  let low = 0;
  let high = unique.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >>> 1;
    if (unique[middle].source <= value) low = middle;
    else high = middle;
  }
  const a = unique[low];
  const b = unique[high];
  return a.target + (b.target - a.target) * (value - a.source) / (b.source - a.source);
}
