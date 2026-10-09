// HAKO — Données de démo : un road trip terminé en Colombie
// Crée un voyage passé complet (4 étapes, logements réservés, activités,
// planning, dépenses partagées, album photo, avis) pour tester le dashboard
// « après le voyage ».
//
//   node scripts/seed-colombia-trip.mjs
//     → écrit supabase/seed/colombia_road_trip.sql (images Unsplash incluses)
//   puis exécuter ce fichier dans Supabase → SQL Editor (droits admin : les
//   tables protégées par RLS, comme trip_stops, sont acceptées).
//   Le SQL supprime d'abord l'éventuel voyage de démo existant : relançable.

import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const UNSPLASH = env.EXPO_PUBLIC_UNSPLASH_ACCESS_KEY;
const TRIP_NAME = 'Road trip en Colombie';

// Membres : tes comptes (le premier est l'organisateur)
const OWNER = '6e9da77a-0648-4d86-b5de-139136c35692';   // compte principal
const MEMBERS = [
  OWNER,
  '3881b632-5461-455b-a37d-2e1c6eb73e40',               // compte 2
  '602b26c7-7ec8-4ca9-9c5c-4cd77451e0cd',               // testtt@mail.fr
  '88c414e5-7c85-49c1-ba44-4228f3da489b',               // test@mail.fr
];
const [A, B, C, D] = MEMBERS;
// Comptes ajoutés au groupe sans données (pour voir le voyage depuis ces comptes)
const VIEWERS = ['90316eca-b3e8-4f1b-9977-9b81309e3413']; // test@mail.com

const photoCache = new Map();
async function unsplash(query, count = 1) {
  if (!UNSPLASH) return [];
  if (photoCache.has(query)) return photoCache.get(query);
  const params = new URLSearchParams({ query, per_page: String(count), orientation: 'landscape' });
  const res = await fetch(`https://api.unsplash.com/search/photos?${params}`, { headers: { Authorization: `Client-ID ${UNSPLASH}` } });
  const urls = res.ok ? ((await res.json()).results ?? []).map(p => p.urls.regular) : [];
  photoCache.set(query, urls);
  return urls;
}

// ─── Contenu ─────────────────────────────────────────────────────────────────
const STOPS = [
  { place_name: 'Bogotá',    lat: 4.7110,  lng: -74.0721, start_date: '2026-08-01', end_date: '2026-08-04' },
  { place_name: 'Salento',   lat: 4.6375,  lng: -75.5708, start_date: '2026-08-04', end_date: '2026-08-07' },
  { place_name: 'Medellín',  lat: 6.2442,  lng: -75.5812, start_date: '2026-08-07', end_date: '2026-08-11' },
  { place_name: 'Cartagena', lat: 10.3910, lng: -75.4794, start_date: '2026-08-11', end_date: '2026-08-15' },
];

// stop = index d'étape · day = jour du planning · ratings = notes [A, B, C, D] (null = pas noté)
const LODGINGS = [
  { stop: 0, title: 'Casa colonial à La Candelaria', address: 'La Candelaria, Bogotá', lat: 4.5981, lng: -74.0758, img: 'bogota candelaria colonial house', paid: A, amount: 360, ratings: [4, 4, 5, null] },
  { stop: 1, title: 'Finca cafetera El Mirador', address: 'Vereda Palestina, Salento', lat: 4.6260, lng: -75.5650, img: 'coffee farm colombia', paid: B, amount: 270, ratings: [5, 5, 5, 4] },
  { stop: 2, title: 'Loft avec rooftop à El Poblado', address: 'El Poblado, Medellín', lat: 6.2087, lng: -75.5670, img: 'medellin rooftop apartment', paid: C, amount: 420, ratings: [null, 4, 3, 4] },
  { stop: 3, title: 'Maison coloniale à Getsemaní', address: 'Getsemaní, Cartagena', lat: 10.4202, lng: -75.5468, img: 'cartagena getsemani street', paid: A, amount: 560, ratings: [5, null, 5, 5] },
];

const ACTIVITIES = [
  { stop: 0, day: '2026-08-01', start: '16:00', end: '18:30', title: 'Monserrate au coucher du soleil', category: 'monument', address: 'Cerro de Monserrate, Bogotá', lat: 4.6058, lng: -74.0565, img: 'monserrate bogota', ratings: [5, 4, 5, 5], cost: 40 },
  { stop: 0, day: '2026-08-02', start: '10:00', end: '12:00', title: 'Musée de l’Or', category: 'monument', address: 'Cra. 6 #15-88, Bogotá', lat: 4.6019, lng: -74.0720, img: 'gold museum bogota', ratings: [4, 3, null, 4], cost: 0 },
  { stop: 0, day: '2026-08-02', start: '14:30', end: '17:00', title: 'Street art tour à La Candelaria', category: 'activity', address: 'La Candelaria, Bogotá', lat: 4.5967, lng: -74.0730, img: 'bogota graffiti', ratings: [5, 5, 4, null], cost: 0 },
  { stop: 0, day: '2026-08-03', start: '13:00', end: '14:30', title: 'Ajiaco à La Puerta Falsa', category: 'restaurant', address: 'Cl. 11 #6-50, Bogotá', lat: 4.5978, lng: -74.0752, img: 'ajiaco colombian soup', ratings: [4, 5, 4, 4], cost: 0 },
  { stop: 1, day: '2026-08-05', start: '07:30', end: '13:30', title: 'Rando dans la vallée de Cocora', category: 'monument', address: 'Valle de Cocora, Salento', lat: 4.6380, lng: -75.4880, img: 'cocora valley wax palms', ratings: [5, 5, 5, 5], cost: 0 },
  { stop: 1, day: '2026-08-05', start: '16:00', end: '18:00', title: 'Tour du café dans une finca', category: 'activity', address: 'Salento, Quindío', lat: 4.6300, lng: -75.5600, img: 'coffee plantation tour colombia', ratings: [4, 5, null, 4], cost: 60 },
  { stop: 1, day: '2026-08-06', start: '20:00', end: '22:30', title: 'Soirée tejo', category: 'bar', address: 'Calle Real, Salento', lat: 4.6372, lng: -75.5705, img: 'salento colombia street', ratings: [5, 4, 5, 3], cost: 0 },
  { stop: 2, day: '2026-08-08', start: '10:00', end: '13:00', title: 'Graffiti tour à la Comuna 13', category: 'activity', address: 'Comuna 13, Medellín', lat: 6.2565, lng: -75.6129, img: 'comuna 13 medellin', ratings: [5, 5, 5, 4], cost: 0 },
  { stop: 2, day: '2026-08-09', start: '08:00', end: '17:00', title: 'Guatapé et la Piedra del Peñol', category: 'monument', address: 'Guatapé, Antioquia', lat: 6.2208, lng: -75.1785, img: 'guatape piedra del penol', ratings: [5, 4, 5, 5], cost: 160 },
  { stop: 2, day: '2026-08-10', start: '11:00', end: '14:00', title: 'Métrocable jusqu’au parc Arví', category: 'activity', address: 'Parque Arví, Medellín', lat: 6.2817, lng: -75.5050, img: 'medellin metrocable', ratings: [3, 4, null, 3], cost: 0 },
  { stop: 3, day: '2026-08-11', start: '17:00', end: '19:30', title: 'Balade dans la vieille ville fortifiée', category: 'monument', address: 'Ciudad Amurallada, Cartagena', lat: 10.4236, lng: -75.5503, img: 'cartagena walled city', ratings: [5, 5, 4, 5], cost: 0 },
  { stop: 3, day: '2026-08-12', start: '08:30', end: '17:00', title: 'Journée aux Islas del Rosario', category: 'activity', address: 'Islas del Rosario', lat: 10.1667, lng: -75.7500, img: 'islas del rosario beach', ratings: [4, 5, 5, null], cost: 240 },
  { stop: 3, day: '2026-08-13', start: '18:00', end: '20:00', title: 'Café del Mar au coucher du soleil', category: 'bar', address: 'Baluarte de Santo Domingo, Cartagena', lat: 10.4270, lng: -75.5520, img: 'cartagena sunset wall', ratings: [4, 4, 4, 5], cost: 0 },
  { stop: 3, day: '2026-08-14', start: '13:00', end: '14:30', title: 'Ceviche à La Cevichería', category: 'restaurant', address: 'Cl. 39 #7-14, Cartagena', lat: 10.4262, lng: -75.5498, img: 'ceviche', ratings: [5, null, 4, 5], cost: 0 },
];

const OTHER_EXPENSES = [
  { title: 'Vol Bogotá → Pereira', category: 'transport', amount: 320, paid: B, date: '2026-08-04' },
  { title: 'Location de voiture (Eje Cafetero)', category: 'transport', amount: 210, paid: D, date: '2026-08-04' },
  { title: 'Essence', category: 'transport', amount: 85, paid: C, date: '2026-08-06' },
  { title: 'Bus Pereira → Medellín', category: 'transport', amount: 96, paid: A, date: '2026-08-07' },
  { title: 'Vol Medellín → Cartagena', category: 'transport', amount: 280, paid: C, date: '2026-08-11' },
  { title: 'Restos à Bogotá', category: 'food', amount: 148, paid: A, date: '2026-08-03' },
  { title: 'Bandeja paisa & arepas', category: 'food', amount: 92, paid: D, date: '2026-08-08' },
  { title: 'Fruits de mer à Cartagena', category: 'food', amount: 176, paid: B, date: '2026-08-13' },
  { title: 'Courses & snacks', category: 'shopping', amount: 74, paid: D, date: '2026-08-05' },
];

const PHOTO_QUERIES = [
  ['bogota colombia', '2026-08-02', A], ['monserrate bogota', '2026-08-01', B],
  ['cocora valley', '2026-08-05', A], ['cocora valley wax palms', '2026-08-05', C],
  ['salento colombia', '2026-08-06', D], ['comuna 13 medellin', '2026-08-08', A],
  ['guatape colombia', '2026-08-09', B], ['guatape piedra del penol', '2026-08-09', A],
  ['medellin colombia', '2026-08-10', C], ['cartagena colombia', '2026-08-11', A],
  ['islas del rosario', '2026-08-12', D], ['cartagena sunset', '2026-08-13', B],
];

const OUT = new URL('../supabase/seed/colombia_road_trip.sql', import.meta.url);

// ─── SQL ─────────────────────────────────────────────────────────────────────
const lit = v => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (Array.isArray(v)) return `array[${v.map(lit).join(', ')}]::text[]`;
  return `'${String(v).replace(/'/g, "''")}'`;
};
const insert = (table, rows) => rows.length === 0 ? '' :
  `insert into public.${table} (${Object.keys(rows[0]).join(', ')}) values\n` +
  rows.map(r => `  (${Object.values(r).map(lit).join(', ')})`).join(',\n') + ';\n\n';

async function buildSql() {
  const tripId = randomUUID();
  const stopIds = STOPS.map(() => randomUUID());
  const authors = [A, B, C, D];
  const [cover] = await unsplash('cartagena colombia colorful street');

  const wishes = [];
  for (const [i, l] of LODGINGS.entries()) {
    const [img] = await unsplash(l.img);
    wishes.push({
      id: randomUUID(), trip_id: tripId, added_by: authors[(i + 1) % 4], title: l.title, type: 'place', category: 'hotel',
      status: 'validated', address: l.address, latitude: l.lat, longitude: l.lng, image_url: img ?? null, stop_id: stopIds[l.stop],
      booked_at: `${STOPS[l.stop].start_date}T09:00:00Z`, booked_by: l.paid, booked_amount: l.amount, vibes: ['chill'],
    });
  }
  for (const [i, a] of ACTIVITIES.entries()) {
    const [img] = await unsplash(a.img);
    wishes.push({
      id: randomUUID(), trip_id: tripId, added_by: authors[i % 4], title: a.title, type: 'place', category: a.category,
      status: 'validated', address: a.address, latitude: a.lat, longitude: a.lng, image_url: img ?? null, stop_id: stopIds[a.stop],
      booked_at: null, booked_by: null, booked_amount: null,
      vibes: a.category === 'monument' ? ['nature', 'insta'] : a.category === 'restaurant' ? ['foodie'] : ['aventure'],
    });
  }
  const wishId = title => wishes.find(w => w.title === title).id;

  const planning = [
    ...LODGINGS.map(l => ({
      trip_id: tripId, wish_id: wishId(l.title), title: `Check-in · ${l.title}`, day_date: STOPS[l.stop].start_date,
      start_time: '15:00', end_time: '16:00', sort_order: 0, added_by: l.paid, stop_id: stopIds[l.stop],
    })),
    ...ACTIVITIES.map((a, i) => ({
      trip_id: tripId, wish_id: wishId(a.title), title: a.title, day_date: a.day,
      start_time: a.start, end_time: a.end, sort_order: i + 1, added_by: authors[i % 4], stop_id: stopIds[a.stop],
    })),
  ];

  const expenses = [];
  const splits = [];
  const addExpense = (title, category, amount, paid, date, stop) => {
    const id = randomUUID();
    expenses.push({ id, trip_id: tripId, paid_by: paid, title, amount, currency: 'EUR', category, date, split_type: 'equal', stop_id: stop === null ? null : stopIds[stop] });
    for (const u of MEMBERS) splits.push({ expense_id: id, user_id: u, amount: Math.round((amount / MEMBERS.length) * 100) / 100, is_settled: u === paid });
  };
  LODGINGS.forEach(l => addExpense(l.title, 'accommodation', l.amount, l.paid, STOPS[l.stop].start_date, l.stop));
  ACTIVITIES.filter(a => a.cost > 0).forEach((a, i) => addExpense(a.title, 'activity', a.cost, authors[(i + 2) % 4], a.day, a.stop));
  OTHER_EXPENSES.forEach(e => addExpense(e.title, e.category, e.amount, e.paid, e.date, null));

  const photos = [];
  for (const [query, day, by] of PHOTO_QUERIES) {
    const urls = await unsplash(query, 3);
    const url = urls.find(u => !photos.some(p => p.photo_url === u));
    if (url) photos.push({ trip_id: tripId, uploaded_by: by, photo_url: url, created_at: `${day}T18:00:00Z` });
  }

  const comments = {
    'Rando dans la vallée de Cocora': [B, 'Les palmiers de cire dans la brume… irréel.'],
    'Graffiti tour à la Comuna 13': [C, 'Le guide était incroyable, à faire absolument.'],
    'Finca cafetera El Mirador': [D, 'Réveil avec vue sur les montagnes, café maison.'],
  };
  const reviews = [];
  for (const item of [...LODGINGS, ...ACTIVITIES]) {
    item.ratings.forEach((rating, i) => {
      if (rating === null) return;
      const c = comments[item.title];
      reviews.push({ wish_id: wishId(item.title), user_id: MEMBERS[i], rating, comment: c && c[0] === MEMBERS[i] ? c[1] : null });
    });
  }

  const name = lit(TRIP_NAME);
  const sql = `-- HAKO — Voyage de démo « ${TRIP_NAME} » (généré par scripts/seed-colombia-trip.mjs)
-- À exécuter dans Supabase → SQL Editor. Relançable : l'ancien voyage de démo est supprimé d'abord.
-- ${STOPS.length} étapes · ${wishes.length} envies (dont ${LODGINGS.length} logements réservés) · ${planning.length} créneaux · ${expenses.length} dépenses · ${photos.length} photos · ${reviews.length} avis

begin;

-- Nettoyage de l'éventuel voyage de démo précédent
delete from public.activity_reviews where wish_id in (select w.id from public.wishes w join public.trips t on t.id = w.trip_id where t.name = ${name} and t.owner_id = ${lit(OWNER)});
delete from public.expense_splits where expense_id in (select e.id from public.expenses e join public.trips t on t.id = e.trip_id where t.name = ${name} and t.owner_id = ${lit(OWNER)});
delete from public.planning_items where trip_id in (select id from public.trips where name = ${name} and owner_id = ${lit(OWNER)});
delete from public.expenses where trip_id in (select id from public.trips where name = ${name} and owner_id = ${lit(OWNER)});
delete from public.trip_photos where trip_id in (select id from public.trips where name = ${name} and owner_id = ${lit(OWNER)});
delete from public.wishes where trip_id in (select id from public.trips where name = ${name} and owner_id = ${lit(OWNER)});
delete from public.trip_stops where trip_id in (select id from public.trips where name = ${name} and owner_id = ${lit(OWNER)});
delete from public.trip_members where trip_id in (select id from public.trips where name = ${name} and owner_id = ${lit(OWNER)});
delete from public.trips where name = ${name} and owner_id = ${lit(OWNER)};

${insert('trips', [{
    id: tripId, name: TRIP_NAME, destination: 'Bogotá, Salento +2', owner_id: OWNER,
    start_date: '2026-08-01', end_date: '2026-08-15', cover_image_url: cover ?? null,
    destination_lat: 4.7110, destination_lng: -74.0721, vibes: ['aventure', 'nature', 'foodie'], budget_per_person: 1500,
  }])}${insert('trip_members', [...MEMBERS, ...VIEWERS].map(u => ({ trip_id: tripId, user_id: u, role: u === OWNER ? 'owner' : 'member' })))}${insert('trip_stops', STOPS.map((s, i) => ({
    id: stopIds[i], trip_id: tripId, position: i, place_name: s.place_name, place_id: null,
    lat: s.lat, lng: s.lng, country_code: 'CO', start_date: s.start_date, end_date: s.end_date,
  })))}${insert('wishes', wishes)}${insert('planning_items', planning)}${insert('expenses', expenses)}${insert('expense_splits', splits)}${insert('trip_photos', photos)}${insert('activity_reviews', reviews)}commit;
`;
  mkdirSync(new URL('../supabase/seed/', import.meta.url), { recursive: true });
  writeFileSync(OUT, sql);
  console.log(`Écrit : supabase/seed/colombia_road_trip.sql (${wishes.length} envies, ${photos.length} photos, ${reviews.length} avis)`);
}

await buildSql();
