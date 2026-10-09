/**
 * Formats des réponses de l'API lus par l'administration. Provisoire : ils passeront dans `contrat/` (EP010-US007),
 * partagés avec le back qui les produit (aujourd'hui `backend/src/app.ts`, `backend/src/db/stats.ts`, `backend/src/parkings.ts`).
 */

export type DbState = 'ok' | 'non-configuree' | 'desactivee-en-previsualisation' | 'erreur';

/** GET /api/admin/status */
export interface AdminStatus {
  version: string;
  env: string;
  node: string;
  region: string | null;
  db: {
    status: DbState;
    sizeBytes?: number;
    tables?: { name: string; rows: number }[];
    /** Tables attendues par le code mais absentes de la base (migrations non appliquées) */
    missing?: string[];
  };
}

/** Corps d'une réponse en erreur de l'API */
export interface ApiErrorBody {
  error?: string;
  code?: string;
  issues?: { path?: (string | number)[]; message: string }[];
}

// --- Parkings (EP008-US006) ---------------------------------------------------------------------------

export type ParkingKind = 'underground' | 'multi-storey' | 'surface' | 'street';

/** Parking tel que la carte l'a dans /data/city.json (seuls les champs lus par l'admin) */
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

/** Retouche d'un parking d'OpenStreetMap : seuls les champs présents changent ; la source est obligatoire */
export interface ParkingOverride {
  hide?: boolean;
  name?: string;
  fee?: boolean;
  capacity?: number;
  kind?: ParkingKind;
  pos?: [number, number];
  note?: string;
  source: string;
}

/** Parking absent d'OpenStreetMap, ajouté à la main (identifiant `custom/…`) */
export interface AddedParking {
  id: string;
  kind: ParkingKind;
  pos: [number, number];
  name?: string;
  fee?: boolean;
  capacity?: number;
  note?: string;
  source: string;
}

export interface EditLogEntry {
  id: number;
  target: string;
  action: string;
  source: string | null;
  at: string;
}

/** GET /api/admin/parkings/edits */
export interface AdminParkingEdits {
  overrides: Record<string, ParkingOverride>;
  added: AddedParking[];
  updatedAt: string | null;
  log: EditLogEntry[];
}
