// ═════════════════════════════════════════════════════════════
// HAKO — Edge Function : fetch-trip-events
//
// POST { trip_id, force? } + JWT utilisateur (header Authorization)
// 1. Vérifie que l'utilisateur est membre du voyage (RLS sur trip_stops).
// 2. Pour chaque étape géolocalisée : événements Ticketmaster dans un
//    rayon autour de la ville, entre start_date et end_date de l'étape.
// 3. Upsert dans trip_events (service_role) — cache de 24 h par voyage.
//
// La clé TICKETMASTER_API_KEY ne quitte jamais le serveur.
// ═════════════════════════════════════════════════════════════

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

// ─────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────
const TICKETMASTER_URL = "https://app.ticketmaster.com/discovery/v2/events.json";
const SEARCH_RADIUS_KM = 30;
const EVENTS_PER_STOP = 40;
const CACHE_HOURS = 24;
const MS_PER_HOUR = 3_600_000;
const SOURCE = "ticketmaster";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
} as const;

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface StopRow {
  id: string;
  place_name: string;
  lat: number | null;
  lng: number | null;
  start_date: string;
  end_date: string;
}

interface TmImage { url: string; width: number; ratio?: string }
interface TmEvent {
  id: string;
  name: string;
  url?: string;
  dates?: { start?: { dateTime?: string; localDate?: string } };
  classifications?: { segment?: { name?: string } }[];
  priceRanges?: { min?: number; currency?: string }[];
  images?: TmImage[];
  _embedded?: { venues?: { name?: string; location?: { latitude?: string; longitude?: string } }[] };
}
interface TmResponse { _embedded?: { events?: TmEvent[] } }

interface EventRow {
  trip_id: string;
  stop_id: string;
  source: string;
  external_id: string;
  title: string;
  category: string | null;
  starts_at: string | null;
  local_date: string | null;
  venue_name: string | null;
  lat: number | null;
  lng: number | null;
  price_min: number | null;
  currency: string | null;
  image_url: string | null;
  ticket_url: string | null;
  fetched_at: string;
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

/** Image 16:9 la plus large (vignettes nettes sans charger d'énormes fichiers). */
function bestImage(images: TmImage[] | undefined): string | null {
  const wide = (images ?? []).filter(i => i.ratio === "16_9").sort((a, b) => b.width - a.width);
  return wide[0]?.url ?? images?.[0]?.url ?? null;
}

function toNumber(value: string | undefined): number | null {
  if (value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function fetchStopEvents(apiKey: string, tripId: string, stop: StopRow, now: string): Promise<EventRow[]> {
  if (stop.lat === null || stop.lng === null) return [];
  const params = new URLSearchParams({
    apikey: apiKey,
    latlong: `${stop.lat},${stop.lng}`,
    radius: String(SEARCH_RADIUS_KM),
    unit: "km",
    startDateTime: `${stop.start_date}T00:00:00Z`,
    endDateTime: `${stop.end_date}T23:59:59Z`,
    size: String(EVENTS_PER_STOP),
    sort: "date,asc",
    locale: "*",
  });
  const response = await fetch(`${TICKETMASTER_URL}?${params.toString()}`);
  if (!response.ok) return [];
  const json = (await response.json()) as TmResponse;
  return (json._embedded?.events ?? []).map((e): EventRow => {
    const venue = e._embedded?.venues?.[0];
    const price = e.priceRanges?.[0];
    return {
      trip_id: tripId,
      stop_id: stop.id,
      source: SOURCE,
      external_id: e.id,
      title: e.name,
      category: e.classifications?.[0]?.segment?.name ?? null,
      starts_at: e.dates?.start?.dateTime ?? null,
      local_date: e.dates?.start?.localDate ?? null,
      venue_name: venue?.name ?? null,
      lat: toNumber(venue?.location?.latitude),
      lng: toNumber(venue?.location?.longitude),
      price_min: price?.min ?? null,
      currency: price?.currency ?? null,
      image_url: bestImage(e.images),
      ticket_url: e.url ?? null,
      fetched_at: now,
    };
  });
}

// ─────────────────────────────────────────────
// HANDLER
// ─────────────────────────────────────────────
Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse(405, { error: "method_not_allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ticketmasterKey = Deno.env.get("TICKETMASTER_API_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return jsonResponse(500, { error: "server_misconfigured" });
  if (!ticketmasterKey) return jsonResponse(500, { error: "missing_ticketmaster_key" });

  let tripId: string | null = null;
  let force = false;
  try {
    const body = (await req.json()) as { trip_id?: unknown; force?: unknown };
    tripId = typeof body.trip_id === "string" ? body.trip_id : null;
    force = body.force === true;
  } catch {
    return jsonResponse(400, { error: "invalid_body" });
  }
  if (!tripId) return jsonResponse(400, { error: "invalid_body" });

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient: SupabaseClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return jsonResponse(401, { error: "unauthorized" });

  // RLS : un non-membre ne voit aucune étape → 403
  const { data: stops, error: stopsError } = await userClient
    .from("trip_stops")
    .select("id, place_name, lat, lng, start_date, end_date")
    .eq("trip_id", tripId)
    .order("position", { ascending: true });
  if (stopsError) return jsonResponse(500, { error: "stops_read_failed" });
  if (!stops || stops.length === 0) return jsonResponse(403, { error: "forbidden_or_no_stops" });

  const admin: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  // Cache 24 h
  if (!force) {
    const { data: latest } = await admin
      .from("trip_events")
      .select("fetched_at")
      .eq("trip_id", tripId)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const fetchedAt = (latest as { fetched_at: string } | null)?.fetched_at;
    if (fetchedAt && Date.now() - Date.parse(fetchedAt) < CACHE_HOURS * MS_PER_HOUR) {
      return jsonResponse(200, { trip_id: tripId, cached: true });
    }
  }

  const now = new Date().toISOString();
  const rows = (await Promise.all((stops as StopRow[]).map(s => fetchStopEvents(ticketmasterKey, tripId!, s, now)))).flat();

  if (rows.length > 0) {
    const { error: upsertError } = await admin
      .from("trip_events")
      .upsert(rows, { onConflict: "trip_id,source,external_id" });
    if (upsertError) return jsonResponse(500, { error: "upsert_failed", detail: upsertError.message });
  }

  return jsonResponse(200, { trip_id: tripId, cached: false, count: rows.length });
});
