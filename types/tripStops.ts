// HAKO — Voyages multi-étapes : types & interfaces

// ─── Étape (ligne `trip_stops`) ──────────────────────────────────────────────
export interface TripStop {
  id: string;
  trip_id: string;
  position: number;        // 0 = première étape
  place_name: string;      // ex. "Florence"
  place_id: string | null; // Google place_id
  lat: number | null;
  lng: number | null;
  country_code: string | null;
  start_date: string;      // "YYYY-MM-DD" — jour d'arrivée
  end_date: string;        // "YYYY-MM-DD" — jour de départ (= arrivée de l'étape suivante)
  created_at: string;
}

// ─── Brouillon d'étape (formulaire de création) ──────────────────────────────
// Les dates ne sont connues qu'après l'étape « Quand ? » : on stocke le
// nombre de nuits, les dates sont dérivées par splitDatesIntoStops().
export interface StopDraft {
  place_name: string;      // "Florence" (texte principal Google)
  description: string;     // "Florence, Métropole de Florence, Italie" — sert au géocodage
  secondary_text: string;  // "Italie" — affichage
  place_id: string | null;
  country_code: string | null;
  nights: number;
}

// ─── Insertion ───────────────────────────────────────────────────────────────
export interface NewTripStop {
  place_name: string;
  place_id: string | null;
  lat: number | null;
  lng: number | null;
  country_code: string | null;
  start_date: string;
  end_date: string;
}

export type TripStopUpdate = Partial<Omit<NewTripStop, 'place_id'>> & {
  place_id?: string | null;
};
