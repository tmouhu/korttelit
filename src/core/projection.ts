import proj4 from 'proj4';

/** EUREF-FIN / TM35FIN (EPSG:3067). Units: metres. */
export const EPSG3067 = '+proj=utm +zone=35 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';
export const TM35FIN_CODE = 'EPSG:3067';
proj4.defs(TM35FIN_CODE, EPSG3067);

export interface TM35 { e: number; n: number }
export interface LonLat { lon: number; lat: number }

export function lonLatToTM35(p: LonLat): TM35 {
  const [e, n] = proj4('EPSG:4326', TM35FIN_CODE, [p.lon, p.lat]) as [number, number];
  return { e, n };
}

export function tm35ToLonLat(p: TM35): LonLat {
  const [lon, lat] = proj4(TM35FIN_CODE, 'EPSG:4326', [p.e, p.n]) as [number, number];
  return { lon, lat };
}

/**
 * Grid bearing (degrees clockwise from grid north) of true north at the point.
 * East of the central meridian (27°E) this is negative: ≈ -(Δλ · sin φ).
 */
export function trueNorthGridBearingDeg(p: TM35): number {
  const { lon, lat } = tm35ToLonLat(p);
  const a = lonLatToTM35({ lon, lat });
  const b = lonLatToTM35({ lon, lat: lat + 0.001 });
  return (Math.atan2(b.e - a.e, b.n - a.n) * 180) / Math.PI;
}

export const deg2rad = (d: number): number => (d * Math.PI) / 180;
export const rad2deg = (r: number): number => (r * 180) / Math.PI;
