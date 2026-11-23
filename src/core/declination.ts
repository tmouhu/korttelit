import geomagnetism from 'geomagnetism';
import { type TM35, tm35ToLonLat, trueNorthGridBearingDeg } from './projection';

/** Magnetic declination in degrees, positive = magnetic north is east of true north. WMM, offline. */
export function declinationDeg(p: TM35, date: Date = new Date()): number {
  const { lon, lat } = tm35ToLonLat(p);
  return geomagnetism.model(date, { allowOutOfBoundsModel: true }).point([lat, lon]).decl;
}

export interface NorthInfo {
  declinationDeg: number;
  /** Grid bearing of true north (negative east of 27°E). */
  trueNorthGridBearingDeg: number;
  /**
   * Grid bearing (clockwise from grid north) of magnetic north = declination + true-north grid bearing
   * (= D − γ where γ is the meridian convergence). The paper map is rotated counter-clockwise by this
   * angle so that magnetic north points up.
   */
  magneticNorthGridBearingDeg: number;
}

export function northInfo(p: TM35, date: Date = new Date()): NorthInfo {
  const d = declinationDeg(p, date);
  const t = trueNorthGridBearingDeg(p);
  return { declinationDeg: d, trueNorthGridBearingDeg: t, magneticNorthGridBearingDeg: d + t };
}
