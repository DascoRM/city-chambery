import type { ParkingKind } from '../../../contrat/parkings.js';

/**
 * Formats propres à l'administration. Ceux de l'API sont dans le contrat partagé avec le back (`contrat/`, EP010-US007).
 */

/** Parking tel que la carte l'a dans /data/city.json (seuls les champs lus par l'admin) : données de la carte, pas de l'API */
export interface CityParking {
  id: string;
  kind: ParkingKind;
  name?: string;
  fee?: boolean;
  capacity?: number;
  /** Places estimées d'après la surface, quand OSM ne donne pas la capacité */
  est?: number;
  pos: [number, number];
}
