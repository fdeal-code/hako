// HAKO — Cadrage de carte (fonctions pures)

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface Region extends LatLng {
  latitudeDelta: number;
  longitudeDelta: number;
}

const PADDING_FACTOR = 1.6;   // marge autour des points
const MIN_DELTA = 0.3;        // zoom max quand il n'y a qu'un point (ou des points très proches)

/** Région qui englobe tous les points (null si aucun). */
export function regionForPoints(points: readonly LatLng[]): Region | null {
  if (points.length === 0) return null;
  const lats = points.map(p => p.latitude);
  const lngs = points.map(p => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(MIN_DELTA, (maxLat - minLat) * PADDING_FACTOR),
    longitudeDelta: Math.max(MIN_DELTA, (maxLng - minLng) * PADDING_FACTOR),
  };
}

/** Points géolocalisés d'une liste d'étapes (celles sans coordonnées sont ignorées). */
export function stopPoints<T extends { lat: number | null; lng: number | null }>(stops: readonly T[]): LatLng[] {
  return stops.flatMap(s => (s.lat !== null && s.lng !== null ? [{ latitude: s.lat, longitude: s.lng }] : []));
}
