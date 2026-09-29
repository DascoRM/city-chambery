/**
 * Position réelle du soleil (formules de l'algorithme « SunCalc », d'après les Astronomical Algorithms
 * de J. Meeus ; précision de l'ordre de quelques dixièmes de degré, largement suffisante ici).
 */
const RAD = Math.PI / 180, DAY_MS = 86400000, J1970 = 2440588, J2000 = 2451545;
const OBLIQUITY = RAD * 23.4397;

/** Élévation au-dessus de l'horizon et azimut compté depuis le nord, vers l'est (radians). */
export function sunPosition(at: Date, lat: number, lon: number): { elevation: number; azimuth: number } {
  const d = at.valueOf() / DAY_MS - 0.5 + J1970 - J2000;
  const M = RAD * (357.5291 + 0.98560028 * d); // anomalie moyenne
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + RAD * 102.9372 + Math.PI; // longitude écliptique
  const dec = Math.asin(Math.sin(OBLIQUITY) * Math.sin(L));
  const ra = Math.atan2(Math.sin(L) * Math.cos(OBLIQUITY), Math.cos(L));
  const H = RAD * (280.16 + 360.9856235 * d) + RAD * lon - ra; // angle horaire
  const phi = RAD * lat;
  const elevation = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const azSouth = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  return { elevation, azimuth: (azSouth + Math.PI) % (2 * Math.PI) };
}

/**
 * Heures (décimales, heure locale fournie par `instantOf`) du lever et du coucher du soleil :
 * passage du centre du disque à −0,833° (réfraction + demi-diamètre). Recherche par pas de 2 minutes.
 */
export function sunTimes(instantOf: (hour: number) => Date, lat: number, lon: number): { rise: number | null; set: number | null } {
  const limit = -0.833 * RAD;
  let rise: number | null = null, set: number | null = null;
  let prev = sunPosition(instantOf(0), lat, lon).elevation - limit;
  for (let k = 1; k <= 720; k++) {
    const h = k / 30;
    const cur = sunPosition(instantOf(h), lat, lon).elevation - limit;
    if (prev < 0 && cur >= 0 && rise === null) rise = h - (cur / (cur - prev)) / 30;
    if (prev >= 0 && cur < 0 && set === null) set = h - (cur / (cur - prev)) / 30;
    prev = cur;
  }
  return { rise, set };
}
