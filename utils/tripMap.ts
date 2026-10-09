// HAKO — Carte du voyage : calculs purs (trajets, billets, durées, lieux)
// Testés dans tests/tripMap.test.ts.

import type { LegMode, MapLeg, MapPlace, MapTicket } from '../types/tripMap';

const MINUTES_PER_DAY = 1440;
const MINUTES_PER_HOUR = 60;
const ROAD_FACTOR = 1.3;          // route ≈ 1,3 × vol d'oiseau
const DRIVE_KMH = 75;
const TRAVEL_CATEGORIES = ['flight', 'transport'];
const EARTH_KM = 6371;

/** Distance à vol d'oiseau en km (équirectangulaire, suffisant entre deux villes). */
function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180;
  const x = (bLng - aLng) * rad * Math.cos(((aLat + bLat) / 2) * rad);
  const y = (bLat - aLat) * rad;
  return Math.sqrt(x * x + y * y) * EARTH_KM;
}

export interface LegStop {
  id: string;
  place_name: string;
  lat: number | null;
  lng: number | null;
  start_date: string;
  end_date: string;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const mentions = (text: string | undefined, city: string) => !!text && norm(text).includes(norm(city));

function minutes(time: string | undefined): number | null {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  return Number.isFinite(h) ? (h ?? 0) * MINUTES_PER_HOUR + (m ?? 0) : null;
}

/** Durée d'un billet (départ → arrivée, passage de minuit géré). */
export function ticketDuration(ticket: MapTicket | null): number | null {
  const dep = minutes(ticket?.details?.departure);
  const arr = minutes(ticket?.details?.arrival);
  if (dep === null || arr === null) return null;
  return (arr - dep + MINUTES_PER_DAY) % MINUTES_PER_DAY || null;
}

/** « 1 h 30 », « 45 min », « 13 h ». */
export function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const m = Math.round(totalMinutes % MINUTES_PER_HOUR);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

/** Temps de route estimé à partir de la distance à vol d'oiseau. */
export function driveMinutes(km: number): number {
  return Math.round(((km * ROAD_FACTOR) / DRIVE_KMH) * MINUTES_PER_HOUR);
}

function modeOf(ticket: MapTicket | null): LegMode {
  if (!ticket) return 'car';
  return ticket.category === 'flight' ? 'flight' : 'train';
}

/** Billet d'un trajet : même jour, la ville d'arrivée (ou de départ) citée en priorité. */
export function ticketForLeg(tickets: readonly MapTicket[], date: string, from: string, to: string): MapTicket | null {
  const sameDay = tickets.filter(t => TRAVEL_CATEGORIES.includes(t.category) && t.event_date?.slice(0, 10) === date);
  return sameDay.find(t => mentions(t.details?.to, to) || mentions(t.title, to))
    ?? sameDay.find(t => mentions(t.details?.from, from) || mentions(t.title, from))
    ?? sameDay[0]
    ?? null;
}

/**
 * Trajets du voyage : l'arrivée en avion (billet de vol le jour du départ),
 * puis un trajet entre chaque étape, puis le retour en avion.
 */
export function buildLegs(stops: readonly LegStop[], tickets: readonly MapTicket[]): MapLeg[] {
  const legs: MapLeg[] = [];
  const used = new Set<string>();
  const first = stops[0];
  const last = stops[stops.length - 1];
  const flights = tickets.filter(t => t.category === 'flight');

  const outbound = first ? flights.find(f => f.event_date?.slice(0, 10) === first.start_date) : undefined;
  if (first && outbound) {
    used.add(outbound.id);
    legs.push({
      key: `out-${outbound.id}`, fromLabel: outbound.details?.from ?? 'Départ', toLabel: outbound.details?.to ?? first.place_name,
      date: first.start_date, mode: 'flight', ticket: outbound, durationMinutes: ticketDuration(outbound),
      distanceKm: null, fromStopId: null, toStopId: first.id,
    });
  }

  for (let i = 0; i < stops.length - 1; i++) {
    const from = stops[i];
    const to = stops[i + 1];
    if (!from || !to) continue;
    const ticket = ticketForLeg(tickets.filter(t => !used.has(t.id)), from.end_date, from.place_name, to.place_name);
    if (ticket) used.add(ticket.id);
    const km = from.lat !== null && from.lng !== null && to.lat !== null && to.lng !== null
      ? Math.round(distanceKm(from.lat, from.lng, to.lat, to.lng))
      : null;
    legs.push({
      key: `leg-${from.id}-${to.id}`, fromLabel: from.place_name, toLabel: to.place_name, date: from.end_date,
      mode: modeOf(ticket), ticket, durationMinutes: ticketDuration(ticket), distanceKm: km,
      fromStopId: from.id, toStopId: to.id,
    });
  }

  const inbound = last ? flights.find(f => !used.has(f.id) && f.event_date?.slice(0, 10) === last.end_date) : undefined;
  if (last && inbound) {
    legs.push({
      key: `back-${inbound.id}`, fromLabel: inbound.details?.from ?? last.place_name, toLabel: inbound.details?.to ?? 'Retour',
      date: last.end_date, mode: 'flight', ticket: inbound, durationMinutes: ticketDuration(inbound),
      distanceKm: null, fromStopId: last.id, toStopId: null,
    });
  }
  return legs;
}

/** Lieux d'une étape (ou de tout le voyage si stopId null), logements d'abord puis par horaire. */
export function placesForStop(places: readonly MapPlace[], stopId: string | null): MapPlace[] {
  return places
    .filter(p => stopId === null || p.stopId === stopId)
    .sort((a, b) => {
      if (a.booked !== b.booked) return a.booked ? -1 : 1;
      const ka = `${a.plannedDay ?? '9999'}${a.plannedTime ?? '99:99'}`;
      const kb = `${b.plannedDay ?? '9999'}${b.plannedTime ?? '99:99'}`;
      return ka.localeCompare(kb) || a.title.localeCompare(b.title);
    });
}
