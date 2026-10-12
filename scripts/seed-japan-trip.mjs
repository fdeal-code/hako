// HAKO — Données de démo : un voyage EN COURS au Japon
// Les dates sont calculées à partir d'aujourd'hui : le voyage est toujours
// en cours (jour 6 sur 13), aujourd'hui = transfert Hakone → Kyoto.
//
//   node scripts/seed-japan-trip.mjs
//     → écrit supabase/seed/japan_trip.sql et les billets PDF dans supabase/seed/japan-docs/
//   npx supabase storage cp -r supabase/seed/japan-docs ss:///documents/<trip_id> --linked --experimental
//     (la commande exacte, avec l'id du voyage, est affichée à la fin : le bucket
//      documents est privé et chaque fichier doit être rangé dans le dossier du voyage)
//   npx supabase db query --linked -f supabase/seed/japan_trip.sql
//
// Relançable : l'ancien voyage de démo est supprimé d'abord.

import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const UNSPLASH = env.EXPO_PUBLIC_UNSPLASH_ACCESS_KEY;
const TRIP_NAME = 'Japon entre potes';

// Membres : test@mail.com (le compte utilisé dans l'app) organise
const OWNER = '90316eca-b3e8-4f1b-9977-9b81309e3413';   // test@mail.com
const MEMBERS = [
  OWNER,
  '6e9da77a-0648-4d86-b5de-139136c35692',               // compte principal
  '3881b632-5461-455b-a37d-2e1c6eb73e40',               // compte 2
  '602b26c7-7ec8-4ca9-9c5c-4cd77451e0cd',               // testtt@mail.fr
];
const [A, B, C, D] = MEMBERS;

// ─── Dates relatives à aujourd'hui (J0) ──────────────────────────────────────
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = new Date();
const day = offset => iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset));
const J = day;

const STOPS = [
  { place_name: 'Tokyo',  lat: 35.6762, lng: 139.6503, start: -5, end: -1 },
  { place_name: 'Hakone', lat: 35.2323, lng: 139.1069, start: -1, end: 0 },
  { place_name: 'Kyoto',  lat: 35.0116, lng: 135.7681, start: 0,  end: 4 },
  { place_name: 'Osaka',  lat: 34.6937, lng: 135.5023, start: 4,  end: 8 },
];

// stop = index d'étape · d = jour relatif · status : validated (planifié) / pending / debate
const LODGINGS = [
  { stop: 0, title: 'Hôtel capsule chic à Shinjuku', address: 'Shinjuku, Tokyo', lat: 35.6938, lng: 139.7034, img: 'shinjuku night', paid: A, amount: 520 },
  { stop: 1, title: 'Ryokan avec onsen à Hakone', address: 'Gōra, Hakone', lat: 35.2490, lng: 139.0500, img: 'ryokan onsen', paid: B, amount: 380 },
  { stop: 2, title: 'Machiya traditionnelle à Gion', address: 'Gion, Kyoto', lat: 35.0037, lng: 135.7788, img: 'kyoto machiya', paid: C, amount: 610 },
  { stop: 3, title: 'Appart à Namba', address: 'Namba, Osaka', lat: 34.6659, lng: 135.5013, img: 'osaka apartment', paid: D, amount: 440 },
];

const ACTIVITIES = [
  // Tokyo (passé)
  { stop: 0, d: -5, start: '18:00', end: '20:00', title: 'Carrefour de Shibuya de nuit', category: 'monument', address: 'Shibuya, Tokyo', lat: 35.6595, lng: 139.7005, img: 'shibuya crossing night', cost: 0 },
  { stop: 0, d: -4, start: '09:00', end: '11:30', title: 'Temple Sensō-ji à Asakusa', category: 'monument', address: 'Asakusa, Tokyo', lat: 35.7148, lng: 139.7967, img: 'senso-ji temple', cost: 0 },
  { stop: 0, d: -4, start: '15:00', end: '17:30', title: 'teamLab Planets', category: 'activity', address: 'Toyosu, Tokyo', lat: 35.6491, lng: 139.7898, img: 'teamlab planets', cost: 128 },
  { stop: 0, d: -3, start: '08:00', end: '10:00', title: 'Petit-déj au marché de Tsukiji', category: 'restaurant', address: 'Tsukiji, Tokyo', lat: 35.6654, lng: 139.7707, img: 'tsukiji market sushi', cost: 0 },
  { stop: 0, d: -3, start: '21:00', end: '23:30', title: 'Bars de Golden Gai', category: 'bar', address: 'Shinjuku Golden Gai, Tokyo', lat: 35.6938, lng: 139.7046, img: 'golden gai tokyo', cost: 0 },
  { stop: 0, d: -2, start: '10:00', end: '13:00', title: 'Akihabara et ses salles d’arcade', category: 'activity', address: 'Akihabara, Tokyo', lat: 35.7023, lng: 139.7745, img: 'akihabara', cost: 0 },
  // Hakone (hier → ce matin)
  { stop: 1, d: -1, start: '17:00', end: '19:00', title: 'Bain à l’onsen', category: 'activity', address: 'Gōra, Hakone', lat: 35.2490, lng: 139.0500, img: 'japanese onsen', cost: 0 },
  // Aujourd'hui : transfert Hakone → Kyoto
  { stop: 1, d: 0, start: '08:30', end: '10:00', title: 'Bateau pirate sur le lac Ashi', category: 'activity', address: 'Lac Ashi, Hakone', lat: 35.2049, lng: 139.0250, img: 'lake ashi hakone fuji', cost: 48 },
  { stop: 2, d: 0, start: '19:30', end: '21:30', title: 'Dîner dans la ruelle de Pontochō', category: 'restaurant', address: 'Pontochō, Kyoto', lat: 35.0051, lng: 135.7709, img: 'pontocho kyoto', cost: 0 },
  // Kyoto (à venir)
  { stop: 2, d: 1, start: '07:00', end: '09:30', title: 'Fushimi Inari à l’aube', category: 'monument', address: 'Fushimi Inari Taisha, Kyoto', lat: 34.9671, lng: 135.7727, img: 'fushimi inari', cost: 0 },
  { stop: 2, d: 1, start: '11:30', end: '13:00', title: 'Pavillon d’or Kinkaku-ji', category: 'monument', address: 'Kinkaku-ji, Kyoto', lat: 35.0394, lng: 135.7292, img: 'kinkakuji', cost: 0 },
  { stop: 2, d: 1, start: '15:30', end: '18:00', title: 'Bambouseraie d’Arashiyama', category: 'monument', address: 'Arashiyama, Kyoto', lat: 35.0170, lng: 135.6713, img: 'arashiyama bamboo', cost: 0 },
  { stop: 2, d: 2, start: '10:00', end: '16:00', title: 'Journée à Nara avec les daims', category: 'activity', address: 'Parc de Nara', lat: 34.6851, lng: 135.8430, img: 'nara deer park', cost: 0 },
  { stop: 2, d: 3, start: '14:00', end: '15:30', title: 'Cérémonie du thé', category: 'activity', address: 'Gion, Kyoto', lat: 35.0037, lng: 135.7788, img: 'japanese tea ceremony', cost: 0 },
  // Osaka (à venir)
  { stop: 3, d: 4, start: '19:00', end: '22:00', title: 'Street food à Dōtonbori', category: 'restaurant', address: 'Dōtonbori, Osaka', lat: 34.6687, lng: 135.5013, img: 'dotonbori osaka', cost: 0 },
  { stop: 3, d: 5, start: '10:00', end: '12:00', title: 'Château d’Osaka', category: 'monument', address: 'Château d’Osaka', lat: 34.6873, lng: 135.5262, img: 'osaka castle', cost: 0 },
];

// Envies pas encore décidées (onglet « À voter »)
const PENDING = [
  { stop: 2, title: 'Dîner kaiseki à Kyoto', category: 'restaurant', status: 'pending', img: 'kaiseki', votes: { [A]: 'up', [B]: 'up' } },
  { stop: 3, title: 'Universal Studios Japan', category: 'activity', status: 'debate', img: 'universal studios japan', votes: { [A]: 'up', [C]: 'down', [D]: 'down', [B]: 'up' } },
  { stop: 3, title: 'Karaoké géant à Namba', category: 'bar', status: 'pending', img: 'karaoke japan', votes: { [C]: 'up' } },
];

const OTHER_EXPENSES = [
  { title: 'JR Pass 7 jours (×4)', category: 'transport', amount: 1360, paid: A, d: -5 },
  { title: 'Cartes Suica', category: 'transport', amount: 80, paid: B, d: -5 },
  { title: 'Ramen à Shinjuku', category: 'food', amount: 54, paid: C, d: -5 },
  { title: 'Konbini & snacks', category: 'shopping', amount: 38, paid: D, d: -4 },
  { title: 'Sushi au comptoir', category: 'food', amount: 172, paid: A, d: -3 },
  { title: 'Souvenirs à Akihabara', category: 'shopping', amount: 66, paid: B, d: -2 },
  { title: 'Dîner kaiseki au ryokan', category: 'food', amount: 0, paid: B, d: -1, skip: true },
  { title: 'Bentos du Shinkansen', category: 'food', amount: 32, paid: C, d: 0 },
];

const PHOTO_QUERIES = [
  ['shibuya crossing', -5, A], ['tokyo night neon', -5, C], ['senso-ji asakusa', -4, B],
  ['teamlab tokyo', -4, A], ['tsukiji sushi', -3, D], ['golden gai', -3, C],
  ['akihabara', -2, B], ['hakone onsen', -1, A], ['mount fuji lake ashi', 0, D],
];

// Documents : billets en PDF (générés) + infos du billet
const DOCS = [
  { title: 'Vol Paris → Tokyo', category: 'flight', d: -5, file: 'vol-paris-tokyo.pdf', by: A,
    details: { from: 'CDG', to: 'HND', departure: '11:25', arrival: '07:05', passenger: '4 voyageurs', seat: '32A-D', gate: 'K41', boarding: '10:45', reference: 'AF8KX2' } },
  { title: 'JR Pass 7 jours', category: 'transport', d: -5, file: 'jr-pass.pdf', by: A,
    details: { passenger: '4 voyageurs', reference: 'JRP-48213' } },
  { title: 'Billets teamLab Planets', category: 'activity', d: -4, file: 'teamlab.pdf', by: A,
    details: { departure: '15:00', passenger: '4 adultes', reference: 'TLP-77310' } },
  { title: 'Shinkansen Odawara → Kyoto', category: 'transport', d: 0, file: 'shinkansen-odawara-kyoto.pdf', by: C,
    details: { from: 'Odawara', to: 'Kyoto', departure: '12:41', arrival: '14:52', passenger: '4 voyageurs', seat: 'Voiture 7 · 12A-D', reference: 'HKR-6612' } },
  { title: 'Réservation machiya à Gion', category: 'hotel', d: 0, file: 'machiya-gion.pdf', by: C,
    details: { departure: '16:00', reference: 'MCH-2291' } },
  { title: 'Shinkansen Kyoto → Shin-Osaka', category: 'transport', d: 4, file: 'shinkansen-kyoto-osaka.pdf', by: D,
    details: { from: 'Kyoto', to: 'Shin-Osaka', departure: '10:15', arrival: '10:29', passenger: '4 voyageurs', seat: 'Voiture 3 · 5A-D', reference: 'KSO-1180' } },
  { title: 'Assurance voyage', category: 'insurance', d: null, file: 'assurance.pdf', by: B, details: null },
];

// ─── Utilitaires ─────────────────────────────────────────────────────────────
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

const lit = v => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (Array.isArray(v)) return `array[${v.map(lit).join(', ')}]::text[]`;
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
};
const insert = (table, rows) => rows.length === 0 ? '' :
  `insert into public.${table} (${Object.keys(rows[0]).join(', ')}) values\n` +
  rows.map(r => `  (${Object.values(r).map(lit).join(', ')})`).join(',\n') + ';\n\n';

/** Petit PDF « billet » (texte ASCII, Helvetica). */
function ticketPdf(lines) {
  const ascii = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’]/g, "'").replace(/→/g, '->').replace(/[^\x20-\x7E]/g, '');
  const esc = s => ascii(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const text = ['BT', '/F1 22 Tf', '50 760 Td', `(${esc(lines[0] ?? '')}) Tj`, '/F1 13 Tf',
    ...lines.slice(1).flatMap(l => ['0 -26 Td', `(${esc(l)}) Tj`]), 'ET'].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((o, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return pdf;
}

// ─── Génération ──────────────────────────────────────────────────────────────
async function build() {
  const tripId = randomUUID();
  const stopIds = STOPS.map(() => randomUUID());
  const authors = [A, B, C, D];
  const start = J(STOPS[0].start);
  const end = J(STOPS[STOPS.length - 1].end);
  const [cover] = await unsplash('kyoto japan temple');

  const wishes = [];
  for (const [i, l] of LODGINGS.entries()) {
    const [img] = await unsplash(l.img);
    wishes.push({
      id: randomUUID(), trip_id: tripId, added_by: authors[(i + 1) % 4], title: l.title, type: 'place', category: 'hotel',
      status: 'validated', address: l.address, latitude: l.lat, longitude: l.lng, image_url: img ?? null, stop_id: stopIds[l.stop],
      booked_at: `${J(STOPS[l.stop].start - 20)}T09:00:00Z`, booked_by: l.paid, booked_amount: l.amount, vibes: ['chill'],
    });
  }
  for (const [i, a] of ACTIVITIES.entries()) {
    const [img] = await unsplash(a.img);
    wishes.push({
      id: randomUUID(), trip_id: tripId, added_by: authors[i % 4], title: a.title, type: 'place', category: a.category,
      status: 'validated', address: a.address, latitude: a.lat, longitude: a.lng, image_url: img ?? null, stop_id: stopIds[a.stop],
      booked_at: null, booked_by: null, booked_amount: null,
      vibes: a.category === 'monument' ? ['culture', 'insta'] : a.category === 'restaurant' ? ['foodie'] : ['aventure'],
    });
  }
  const pendingWishes = [];
  for (const [i, w] of PENDING.entries()) {
    const [img] = await unsplash(w.img);
    pendingWishes.push({
      id: randomUUID(), trip_id: tripId, added_by: authors[(i + 2) % 4], title: w.title, type: 'place', category: w.category,
      status: w.status, address: STOPS[w.stop].place_name, latitude: STOPS[w.stop].lat, longitude: STOPS[w.stop].lng,
      image_url: img ?? null, stop_id: stopIds[w.stop], booked_at: null, booked_by: null, booked_amount: null, vibes: ['foodie'],
    });
  }
  const wishId = title => [...wishes, ...pendingWishes].find(w => w.title === title).id;
  const votes = PENDING.flatMap(w => Object.entries(w.votes).map(([user_id, vote]) => ({ wish_id: wishId(w.title), user_id, vote })));

  const planning = [
    ...LODGINGS.map(l => ({
      trip_id: tripId, wish_id: wishId(l.title), title: `Check-in · ${l.title}`, day_date: J(STOPS[l.stop].start),
      start_time: STOPS[l.stop].start === 0 ? '16:00' : '15:00', end_time: STOPS[l.stop].start === 0 ? '16:30' : '16:00',
      sort_order: 0, added_by: l.paid, stop_id: stopIds[l.stop],
    })),
    ...ACTIVITIES.map((a, i) => ({
      trip_id: tripId, wish_id: wishId(a.title), title: a.title, day_date: J(a.d),
      start_time: a.start, end_time: a.end, sort_order: i + 1, added_by: authors[i % 4], stop_id: stopIds[a.stop],
    })),
    // Trajets (sans envie)
    { trip_id: tripId, wish_id: null, title: 'Shinkansen Odawara → Kyoto', day_date: J(0), start_time: '12:41', end_time: '14:52', sort_order: 50, added_by: C, stop_id: stopIds[2] },
    { trip_id: tripId, wish_id: null, title: 'Shinkansen Kyoto → Shin-Osaka', day_date: J(4), start_time: '10:15', end_time: '10:29', sort_order: 51, added_by: D, stop_id: stopIds[3] },
  ];

  const expenses = [];
  const splits = [];
  const addExpense = (title, category, amount, paid, date, stop) => {
    const id = randomUUID();
    expenses.push({ id, trip_id: tripId, paid_by: paid, title, amount, currency: 'EUR', category, date, split_type: 'equal', stop_id: stop === null ? null : stopIds[stop] });
    for (const u of MEMBERS) splits.push({ expense_id: id, user_id: u, amount: Math.round((amount / MEMBERS.length) * 100) / 100, is_settled: u === paid });
  };
  addExpense('Vols Paris ⇄ Tokyo (×4)', 'transport', 3480, A, J(-30), null);
  LODGINGS.forEach(l => addExpense(l.title, 'accommodation', l.amount, l.paid, J(STOPS[l.stop].start - 20), l.stop));
  ACTIVITIES.filter(a => a.cost > 0 && a.d <= 0).forEach((a, i) => addExpense(a.title, 'activity', a.cost, authors[(i + 1) % 4], J(a.d), a.stop));
  OTHER_EXPENSES.filter(e => !e.skip).forEach(e => addExpense(e.title, e.category, e.amount, e.paid, J(e.d), e.d <= -2 ? 0 : e.d === -1 ? 1 : 2));

  const photos = [];
  for (const [query, d, by] of PHOTO_QUERIES) {
    const urls = await unsplash(query, 3);
    const url = urls.find(u => !photos.some(p => p.photo_url === u));
    if (url) photos.push({ trip_id: tripId, uploaded_by: by, photo_url: url, created_at: `${J(d)}T${d === 0 ? '08' : '19'}:30:00Z` });
  }

  // Billets PDF
  const docsDir = new URL('../supabase/seed/japan-docs/', import.meta.url);
  mkdirSync(docsDir, { recursive: true });
  const documents = DOCS.map(doc => {
    const det = doc.details ?? {};
    const lines = [
      doc.title,
      doc.d === null ? 'Valable pour tout le voyage' : `Date : ${J(doc.d)}`,
      det.from ? `De : ${det.from}   ->   A : ${det.to}` : '',
      det.departure ? `Depart : ${det.departure}${det.arrival ? `   Arrivee : ${det.arrival}` : ''}` : '',
      det.passenger ? `Passagers : ${det.passenger}` : '',
      det.seat ? `Places : ${det.seat}` : '',
      det.reference ? `Reference : ${det.reference}` : '',
      '', 'Document de demonstration - Hako',
    ].filter((l, i) => i < 2 || l !== '' || i === 7);
    const pdf = ticketPdf(lines);
    writeFileSync(new URL(doc.file, docsDir), pdf, 'latin1');
    return {
      trip_id: tripId, uploaded_by: doc.by, title: doc.title, category: doc.category,
      file_url: `${tripId}/${doc.file}`, // chemin dans le bucket privé documents
      file_type: 'application/pdf', file_size: Buffer.byteLength(pdf, 'latin1'),
      event_date: doc.d === null ? null : J(doc.d), is_shared: true, details: doc.details,
    };
  });

  const where = `name = ${lit(TRIP_NAME)} and owner_id = ${lit(OWNER)}`;
  const sql = `-- HAKO — Voyage de démo EN COURS « ${TRIP_NAME} » (généré par scripts/seed-japan-trip.mjs le ${J(0)})
-- ${start} → ${end} · aujourd'hui = jour 6 (Hakone → Kyoto). Relançable.

begin;

delete from public.wish_votes where wish_id in (select w.id from public.wishes w join public.trips t on t.id = w.trip_id where t.${where});
delete from public.activity_reviews where wish_id in (select w.id from public.wishes w join public.trips t on t.id = w.trip_id where t.${where});
delete from public.expense_splits where expense_id in (select e.id from public.expenses e join public.trips t on t.id = e.trip_id where t.${where});
delete from public.planning_items where trip_id in (select id from public.trips where ${where});
delete from public.expenses where trip_id in (select id from public.trips where ${where});
delete from public.trip_photos where trip_id in (select id from public.trips where ${where});
delete from public.documents where trip_id in (select id from public.trips where ${where});
delete from public.wishes where trip_id in (select id from public.trips where ${where});
delete from public.trip_stops where trip_id in (select id from public.trips where ${where});
delete from public.trip_members where trip_id in (select id from public.trips where ${where});
delete from public.trips where ${where};

${insert('trips', [{
    id: tripId, name: TRIP_NAME, destination: 'Tokyo, Hakone +2', owner_id: OWNER,
    start_date: start, end_date: end, cover_image_url: cover ?? null,
    destination_lat: 35.6762, destination_lng: 139.6503, vibes: ['culture', 'foodie', 'aventure'], budget_per_person: 2500,
  }])}${insert('trip_members', MEMBERS.map(u => ({ trip_id: tripId, user_id: u, role: u === OWNER ? 'owner' : 'member' })))}${insert('trip_stops', STOPS.map((s, i) => ({
    id: stopIds[i], trip_id: tripId, position: i, place_name: s.place_name, place_id: null,
    lat: s.lat, lng: s.lng, country_code: 'JP', start_date: J(s.start), end_date: J(s.end),
  })))}${insert('wishes', [...wishes, ...pendingWishes])}${insert('wish_votes', votes)}${insert('planning_items', planning)}${insert('expenses', expenses)}${insert('expense_splits', splits)}${insert('trip_photos', photos)}${insert('documents', documents)}commit;
`;
  writeFileSync(new URL('../supabase/seed/japan_trip.sql', import.meta.url), sql);
  console.log(`Écrit : supabase/seed/japan_trip.sql (${start} → ${end}) · ${wishes.length + pendingWishes.length} envies · ${planning.length} créneaux · ${expenses.length} dépenses · ${photos.length} photos · ${documents.length} documents`);
  console.log(`Puis : npx supabase storage cp -r supabase/seed/japan-docs ss:///documents/${tripId} --linked --experimental`);
}

await build();
