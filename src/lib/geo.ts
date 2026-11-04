export type LatLon = [number, number];

export function insidePolygon([lat, lon]: LatLon, poly: LatLon[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i];
    const [yj, xj] = poly[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function centroid(poly: LatLon[]): LatLon {
  const n = poly.length || 1;
  return [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n];
}

/** Area of a small lat/lon polygon in hectares (local equirectangular projection). */
export function polygonHectares(poly: LatLon[]): number {
  if (poly.length < 3) return 0;
  const [lat0] = centroid(poly);
  const mPerDegLat = 111_320;
  const mPerDegLon = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  let sum = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = [poly[i][0] * mPerDegLat, poly[i][1] * mPerDegLon];
    const [yj, xj] = [poly[j][0] * mPerDegLat, poly[j][1] * mPerDegLon];
    sum += xj * yi - xi * yj;
  }
  return Math.abs(sum) / 2 / 10_000;
}

export const toAcres = (ha: number) => ha * 2.471;
