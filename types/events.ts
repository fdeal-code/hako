// HAKO — Événements sur place (cache `trip_events`, rempli par fetch-trip-events)

export interface TripEvent {
  id: string;
  trip_id: string;
  stop_id: string | null;
  source: string;
  external_id: string;
  title: string;
  category: string | null;
  starts_at: string | null;   // ISO
  local_date: string | null;  // "YYYY-MM-DD"
  venue_name: string | null;
  lat: number | null;
  lng: number | null;
  price_min: number | null;
  currency: string | null;
  image_url: string | null;
  ticket_url: string | null;
  fetched_at: string;
}
