-- HAKO — Voyage de démo EN COURS « Japon entre potes » (généré par scripts/seed-japan-trip.mjs le 2026-10-09)
-- 2026-10-04 → 2026-10-17 · aujourd'hui = jour 6 (Hakone → Kyoto). Relançable.

begin;

delete from public.wish_votes where wish_id in (select w.id from public.wishes w join public.trips t on t.id = w.trip_id where t.name = 'Japon entre potes' and owner_id = '90316eca-b3e8-4f1b-9977-9b81309e3413');
delete from public.activity_reviews where wish_id in (select w.id from public.wishes w join public.trips t on t.id = w.trip_id where t.name = 'Japon entre potes' and owner_id = '90316eca-b3e8-4f1b-9977-9b81309e3413');
delete from public.expense_splits where expense_id in (select e.id from public.expenses e join public.trips t on t.id = e.trip_id where t.name = 'Japon entre potes' and owner_id = '90316eca-b3e8-4f1b-9977-9b81309e3413');
delete from public.planning_items where trip_id in (select id from public.trips where name = 'Japon entre potes' and owner_id = '90316eca-b3e8-4f1b-9977-9b81309e3413');
delete from public.expenses where trip_id in (select id from public.trips where name = 'Japon entre potes' and owner_id = '90316eca-b3e8-4f1b-9977-9b81309e3413');
delete from public.trip_photos where trip_id in (select id from public.trips where name = 'Japon entre potes' and owner_id = '90316eca-b3e8-4f1b-9977-9b81309e3413');
delete from public.documents where trip_id in (select id from public.trips where name = 'Japon entre potes' and owner_id = '90316eca-b3e8-4f1b-9977-9b81309e3413');
delete from public.wishes where trip_id in (select id from public.trips where name = 'Japon entre potes' and owner_id = '90316eca-b3e8-4f1b-9977-9b81309e3413');
delete from public.trip_stops where trip_id in (select id from public.trips where name = 'Japon entre potes' and owner_id = '90316eca-b3e8-4f1b-9977-9b81309e3413');
delete from public.trip_members where trip_id in (select id from public.trips where name = 'Japon entre potes' and owner_id = '90316eca-b3e8-4f1b-9977-9b81309e3413');
delete from public.trips where name = 'Japon entre potes' and owner_id = '90316eca-b3e8-4f1b-9977-9b81309e3413';

insert into public.trips (id, name, destination, owner_id, start_date, end_date, cover_image_url, destination_lat, destination_lng, vibes, budget_per_person) values
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', 'Japon entre potes', 'Tokyo, Hakone +2', '90316eca-b3e8-4f1b-9977-9b81309e3413', '2026-10-04', '2026-10-17', 'https://images.unsplash.com/photo-1578469645742-46cae010e5d4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5OTQxOTZ8MHwxfHNlYXJjaHwxfHxreW90byUyMGphcGFuJTIwdGVtcGxlfGVufDB8MHx8fDE3OTE1Mzg4ODJ8MA&ixlib=rb-4.1.0&q=80&w=1080', 35.6762, 139.6503, array['culture', 'foodie', 'aventure']::text[], 2500);

insert into public.trip_members (trip_id, user_id, role) values
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', '90316eca-b3e8-4f1b-9977-9b81309e3413', 'owner'),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', '6e9da77a-0648-4d86-b5de-139136c35692', 'member'),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', '3881b632-5461-455b-a37d-2e1c6eb73e40', 'member'),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', '602b26c7-7ec8-4ca9-9c5c-4cd77451e0cd', 'member');

insert into public.trip_stops (id, trip_id, position, place_name, place_id, lat, lng, country_code, start_date, end_date) values
  ('476d4a2c-a2a7-4db1-b932-fb578a6084e7', '683304ee-6894-42b8-ae13-64f9bf7d641b', 0, 'Tokyo', null, 35.6762, 139.6503, 'JP', '2026-10-04', '2026-10-08'),
  ('b7153972-0952-489e-a2bd-09400a750b10', '683304ee-6894-42b8-ae13-64f9bf7d641b', 1, 'Hakone', null, 35.2323, 139.1069, 'JP', '2026-10-08', '2026-10-09'),
  ('441a1025-f6f2-4110-9609-075e1baf2d18', '683304ee-6894-42b8-ae13-64f9bf7d641b', 2, 'Kyoto', null, 35.0116, 135.7681, 'JP', '2026-10-09', '2026-10-13'),
  ('086890c4-c2ae-44cf-8c70-2f597e98f771', '683304ee-6894-42b8-ae13-64f9bf7d641b', 3, 'Osaka', null, 34.6937, 135.5023, 'JP', '2026-10-13', '2026-10-17');

insert into public.wishes (id, trip_id, added_by, title, type, category, status, address, latitude, longitude, image_url, stop_id, booked_at, booked_by, booked_amount, vibes) values
  ('f2cd5f25-4618-4dcf-8644-00b94024a482', '683304ee-6894-42b8-ae13-64f9bf7d641b', '6e9da77a-0648-4d86-b5de-139136c35692', 'Hôtel capsule chic à Shinjuku', 'place', 'hotel', 'validated', 'Shinjuku, Tokyo', 35.6938, 139.7034, 'https://images.unsplash.com/photo-1570521462033-3015e76e7432?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5OTQxOTZ8MHwxfHNlYXJjaHwxfHxzaGluanVrdSUyMG5pZ2h0fGVufDB8MHx8fDE3OTE1Mzg4ODN8MA&ixlib=rb-4.1.0&q=80&w=1080', '476d4a2c-a2a7-4db1-b932-fb578a6084e7', '2026-09-14T09:00:00Z', '90316eca-b3e8-4f1b-9977-9b81309e3413', 520, array['chill']::text[]),
  ('8c5c9caa-93fb-486d-8903-38855f36c5e0', '683304ee-6894-42b8-ae13-64f9bf7d641b', '3881b632-5461-455b-a37d-2e1c6eb73e40', 'Ryokan avec onsen à Hakone', 'place', 'hotel', 'validated', 'Gōra, Hakone', 35.249, 139.05, 'https://images.unsplash.com/photo-1614301246509-d1fc7d78b6b6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5OTQxOTZ8MHwxfHNlYXJjaHwxfHxyeW9rYW4lMjBvbnNlbnxlbnwwfDB8fHwxNzkxNTM4ODgzfDA&ixlib=rb-4.1.0&q=80&w=1080', 'b7153972-0952-489e-a2bd-09400a750b10', '2026-09-18T09:00:00Z', '6e9da77a-0648-4d86-b5de-139136c35692', 380, array['chill']::text[]),
  ('f388cd44-f670-4315-9085-9f1a313db5dc', '683304ee-6894-42b8-ae13-64f9bf7d641b', '602b26c7-7ec8-4ca9-9c5c-4cd77451e0cd', 'Machiya traditionnelle à Gion', 'place', 'hotel', 'validated', 'Gion, Kyoto', 35.0037, 135.7788, 'https://images.unsplash.com/photo-1649009792206-d8ddb5e18914?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5OTQxOTZ8MHwxfHNlYXJjaHwxfHxreW90byUyMG1hY2hpeWF8ZW58MHwwfHx8MTc5MTUzODg4NHww&ixlib=rb-4.1.0&q=80&w=1080', '441a1025-f6f2-4110-9609-075e1baf2d18', '2026-09-19T09:00:00Z', '3881b632-5461-455b-a37d-2e1c6eb73e40', 610, array['chill']::text[]),
  ('5446359a-6f48-4db5-8f10-8cc4ec504db0', '683304ee-6894-42b8-ae13-64f9bf7d641b', '90316eca-b3e8-4f1b-9977-9b81309e3413', 'Appart à Namba', 'place', 'hotel', 'validated', 'Namba, Osaka', 34.6659, 135.5013, 'https://images.unsplash.com/photo-1736517322506-b5005fd21e44?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5OTQxOTZ8MHwxfHNlYXJjaHwxfHxvc2FrYSUyMGFwYXJ0bWVudHxlbnwwfDB8fHwxNzkxNTM4ODg0fDA&ixlib=rb-4.1.0&q=80&w=1080', '086890c4-c2ae-44cf-8c70-2f597e98f771', '2026-09-23T09:00:00Z', '602b26c7-7ec8-4ca9-9c5c-4cd77451e0cd', 440, array['chill']::text[]),
  ('8217e507-7f64-45a0-b08f-d197589d9945', '683304ee-6894-42b8-ae13-64f9bf7d641b', '90316eca-b3e8-4f1b-9977-9b81309e3413', 'Carrefour de Shibuya de nuit', 'place', 'monument', 'validated', 'Shibuya, Tokyo', 35.6595, 139.7005, 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5OTQxOTZ8MHwxfHNlYXJjaHwxfHxzaGlidXlhJTIwY3Jvc3NpbmclMjBuaWdodHxlbnwwfDB8fHwxNzkxNTM4ODg1fDA&ixlib=rb-4.1.0&q=80&w=1080', '476d4a2c-a2a7-4db1-b932-fb578a6084e7', null, null, null, array['culture', 'insta']::text[]),
  ('46d203f1-92b6-4546-b620-7902c37f44f9', '683304ee-6894-42b8-ae13-64f9bf7d641b', '6e9da77a-0648-4d86-b5de-139136c35692', 'Temple Sensō-ji à Asakusa', 'place', 'monument', 'validated', 'Asakusa, Tokyo', 35.7148, 139.7967, 'https://images.unsplash.com/photo-1706813253696-10ee6332edd3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5OTQxOTZ8MHwxfHNlYXJjaHwxfHxzZW5zby1qaSUyMHRlbXBsZXxlbnwwfDB8fHwxNzkxNTM4ODg1fDA&ixlib=rb-4.1.0&q=80&w=1080', '476d4a2c-a2a7-4db1-b932-fb578a6084e7', null, null, null, array['culture', 'insta']::text[]),
  ('130144cc-6a25-4866-bd48-979a87448b20', '683304ee-6894-42b8-ae13-64f9bf7d641b', '3881b632-5461-455b-a37d-2e1c6eb73e40', 'teamLab Planets', 'place', 'activity', 'validated', 'Toyosu, Tokyo', 35.6491, 139.7898, 'https://images.unsplash.com/photo-1556173251-cab2c1e8abe2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5OTQxOTZ8MHwxfHNlYXJjaHwxfHx0ZWFtbGFiJTIwcGxhbmV0c3xlbnwwfDB8fHwxNzkxNTM4ODg1fDA&ixlib=rb-4.1.0&q=80&w=1080', '476d4a2c-a2a7-4db1-b932-fb578a6084e7', null, null, null, array['aventure']::text[]),
  ('6d535eb6-5a2e-4cb4-81a7-0bd5861f54b1', '683304ee-6894-42b8-ae13-64f9bf7d641b', '602b26c7-7ec8-4ca9-9c5c-4cd77451e0cd', 'Petit-déj au marché de Tsukiji', 'place', 'restaurant', 'validated', 'Tsukiji, Tokyo', 35.6654, 139.7707, 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5OTQxOTZ8MHwxfHNlYXJjaHwxfHx0c3VraWppJTIwbWFya2V0JTIwc3VzaGl8ZW58MHwwfHx8MTc5MTUzODg4Nnww&ixlib=rb-4.1.0&q=80&w=1080', '476d4a2c-a2a7-4db1-b932-fb578a6084e7', null, null, null, array['foodie']::text[]),
  ('bd5a27bb-8a4e-4369-9319-d36b33b964db', '683304ee-6894-42b8-ae13-64f9bf7d641b', '90316eca-b3e8-4f1b-9977-9b81309e3413', 'Bars de Golden Gai', 'place', 'bar', 'validated', 'Shinjuku Golden Gai, Tokyo', 35.6938, 139.7046, 'https://images.unsplash.com/photo-1752338384209-ebd5b8fd89b6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5OTQxOTZ8MHwxfHNlYXJjaHwxfHxnb2xkZW4lMjBnYWklMjB0b2t5b3xkZXwwfDB8fHwxNzkxNTM4ODg2fDA&ixlib=rb-4.1.0&q=80&w=1080', '476d4a2c-a2a7-4db1-b932-fb578a6084e7', null, null, null, array['aventure']::text[]),
  ('40231280-30ba-4a1f-92e0-e0aaf955403b', '683304ee-6894-42b8-ae13-64f9bf7d641b', '6e9da77a-0648-4d86-b5de-139136c35692', 'Akihabara et ses salles d’arcade', 'place', 'activity', 'validated', 'Akihabara, Tokyo', 35.7023, 139.7745, 'https://images.unsplash.com/photo-1613487957484-32c977a8bd62?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5OTQxOTZ8MHwxfHNlYXJjaHwxfHxha2loYWJhcmF8ZW58MHwwfHx8MTc5MTUzODg4N3ww&ixlib=rb-4.1.0&q=80&w=1080', '476d4a2c-a2a7-4db1-b932-fb578a6084e7', null, null, null, array['aventure']::text[]),
  ('8a8f7fc0-19ef-4e53-8aa8-7064ab1e2c9a', '683304ee-6894-42b8-ae13-64f9bf7d641b', '3881b632-5461-455b-a37d-2e1c6eb73e40', 'Bain à l’onsen', 'place', 'activity', 'validated', 'Gōra, Hakone', 35.249, 139.05, 'https://images.unsplash.com/photo-1706017595286-66e6d946221c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5OTQxOTZ8MHwxfHNlYXJjaHwxfHxqYXBhbmVzZSUyMG9uc2VufGVufDB8MHx8fDE3OTE1Mzg4ODd8MA&ixlib=rb-4.1.0&q=80&w=1080', 'b7153972-0952-489e-a2bd-09400a750b10', null, null, null, array['aventure']::text[]),
  ('49bf3cc7-cede-48dd-a809-71aebb67c4eb', '683304ee-6894-42b8-ae13-64f9bf7d641b', '602b26c7-7ec8-4ca9-9c5c-4cd77451e0cd', 'Bateau pirate sur le lac Ashi', 'place', 'activity', 'validated', 'Lac Ashi, Hakone', 35.2049, 139.025, 'https://images.unsplash.com/photo-1568901002433-5a8ceafe4647?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5OTQxOTZ8MHwxfHNlYXJjaHwxfHxsYWtlJTIwYXNoaSUyMGhha29uZSUyMGZ1aml8ZW58MHwwfHx8MTc5MTUzODg4N3ww&ixlib=rb-4.1.0&q=80&w=1080', 'b7153972-0952-489e-a2bd-09400a750b10', null, null, null, array['aventure']::text[]),
  ('6a7f6e0c-40a6-456c-bb76-ae6e583ddbdd', '683304ee-6894-42b8-ae13-64f9bf7d641b', '90316eca-b3e8-4f1b-9977-9b81309e3413', 'Dîner dans la ruelle de Pontochō', 'place', 'restaurant', 'validated', 'Pontochō, Kyoto', 35.0051, 135.7709, 'https://images.unsplash.com/photo-1602764363500-e8e8455de955?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5OTQxOTZ8MHwxfHNlYXJjaHwxfHxwb250b2NobyUyMGt5b3RvfGVufDB8MHx8fDE3OTE1Mzg4ODh8MA&ixlib=rb-4.1.0&q=80&w=1080', '441a1025-f6f2-4110-9609-075e1baf2d18', null, null, null, array['foodie']::text[]),
  ('8192a18f-4ab9-4282-b9d8-9b761e9dfe97', '683304ee-6894-42b8-ae13-64f9bf7d641b', '6e9da77a-0648-4d86-b5de-139136c35692', 'Fushimi Inari à l’aube', 'place', 'monument', 'validated', 'Fushimi Inari Taisha, Kyoto', 34.9671, 135.7727, 'https://images.unsplash.com/photo-1558862107-d49ef2a04d72?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5OTQxOTZ8MHwxfHNlYXJjaHwxfHxmdXNoaW1pJTIwaW5hcml8ZW58MHwwfHx8MTc5MTUzODg4OHww&ixlib=rb-4.1.0&q=80&w=1080', '441a1025-f6f2-4110-9609-075e1baf2d18', null, null, null, array['culture', 'insta']::text[]),
  ('601db2cc-661b-4549-bc02-254030ae8b87', '683304ee-6894-42b8-ae13-64f9bf7d641b', '3881b632-5461-455b-a37d-2e1c6eb73e40', 'Pavillon d’or Kinkaku-ji', 'place', 'monument', 'validated', 'Kinkaku-ji, Kyoto', 35.0394, 135.7292, 'https://images.unsplash.com/photo-1610265082060-7234c9de51ab?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5OTQxOTZ8MHwxfHNlYXJjaHwxfHxraW5rYWt1aml8ZW58MHwwfHx8MTc5MTUzODg4OHww&ixlib=rb-4.1.0&q=80&w=1080', '441a1025-f6f2-4110-9609-075e1baf2d18', null, null, null, array['culture', 'insta']::text[]),
  ('d9721060-3714-47e3-8ac6-a736b67b0916', '683304ee-6894-42b8-ae13-64f9bf7d641b', '602b26c7-7ec8-4ca9-9c5c-4cd77451e0cd', 'Bambouseraie d’Arashiyama', 'place', 'monument', 'validated', 'Arashiyama, Kyoto', 35.017, 135.6713, 'https://images.unsplash.com/photo-1632923754832-60642c12a7ed?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5OTQxOTZ8MHwxfHNlYXJjaHwxfHxhcmFzaGl5YW1hJTIwYmFtYm9vfGVufDB8MHx8fDE3OTE1Mzg4ODl8MA&ixlib=rb-4.1.0&q=80&w=1080', '441a1025-f6f2-4110-9609-075e1baf2d18', null, null, null, array['culture', 'insta']::text[]),
  ('4e716010-543b-4ebe-8cfb-17048c01edd6', '683304ee-6894-42b8-ae13-64f9bf7d641b', '90316eca-b3e8-4f1b-9977-9b81309e3413', 'Journée à Nara avec les daims', 'place', 'activity', 'validated', 'Parc de Nara', 34.6851, 135.843, 'https://images.unsplash.com/photo-1693380767492-00fb0bcc4ce6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5OTQxOTZ8MHwxfHNlYXJjaHwxfHxuYXJhJTIwZGVlciUyMHBhcmt8ZW58MHwwfHx8MTc5MTUzODg4OXww&ixlib=rb-4.1.0&q=80&w=1080', '441a1025-f6f2-4110-9609-075e1baf2d18', null, null, null, array['aventure']::text[]),
  ('467dfdc8-8362-418a-8ad5-d11c5135638b', '683304ee-6894-42b8-ae13-64f9bf7d641b', '6e9da77a-0648-4d86-b5de-139136c35692', 'Cérémonie du thé', 'place', 'activity', 'validated', 'Gion, Kyoto', 35.0037, 135.7788, 'https://images.unsplash.com/photo-1531970227416-f0cddeb1f748?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5OTQxOTZ8MHwxfHNlYXJjaHwxfHxqYXBhbmVzZSUyMHRlYSUyMGNlcmVtb255fGVufDB8MHx8fDE3OTE1Mzg4ODl8MA&ixlib=rb-4.1.0&q=80&w=1080', '441a1025-f6f2-4110-9609-075e1baf2d18', null, null, null, array['aventure']::text[]),
  ('d4385cf9-a45b-4a58-a6b6-a8a1684ca09a', '683304ee-6894-42b8-ae13-64f9bf7d641b', '3881b632-5461-455b-a37d-2e1c6eb73e40', 'Street food à Dōtonbori', 'place', 'restaurant', 'validated', 'Dōtonbori, Osaka', 34.6687, 135.5013, 'https://images.unsplash.com/photo-1546142711-1e28c0540deb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5OTQxOTZ8MHwxfHNlYXJjaHwxfHxkb3RvbmJvcmklMjBvc2FrYXxlbnwwfDB8fHwxNzkxNTM4ODkwfDA&ixlib=rb-4.1.0&q=80&w=1080', '086890c4-c2ae-44cf-8c70-2f597e98f771', null, null, null, array['foodie']::text[]),
  ('e523adb0-50e6-4e91-a525-afcdd4f34b4c', '683304ee-6894-42b8-ae13-64f9bf7d641b', '602b26c7-7ec8-4ca9-9c5c-4cd77451e0cd', 'Château d’Osaka', 'place', 'monument', 'validated', 'Château d’Osaka', 34.6873, 135.5262, 'https://images.unsplash.com/photo-1596240748549-6ec0f32d4c95?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5OTQxOTZ8MHwxfHNlYXJjaHwxfHxvc2FrYSUyMGNhc3RsZXxlbnwwfDB8fHwxNzkxNTM4ODkwfDA&ixlib=rb-4.1.0&q=80&w=1080', '086890c4-c2ae-44cf-8c70-2f597e98f771', null, null, null, array['culture', 'insta']::text[]),
  ('cd5eddfd-7437-459b-984d-f9277bf422c2', '683304ee-6894-42b8-ae13-64f9bf7d641b', '3881b632-5461-455b-a37d-2e1c6eb73e40', 'Dîner kaiseki à Kyoto', 'place', 'restaurant', 'pending', 'Kyoto', 35.0116, 135.7681, 'https://images.unsplash.com/photo-1766582931800-fd79665257fa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5OTQxOTZ8MHwxfHNlYXJjaHwxfHxrYWlzZWtpfGVufDB8MHx8fDE3OTE1Mzg4OTF8MA&ixlib=rb-4.1.0&q=80&w=1080', '441a1025-f6f2-4110-9609-075e1baf2d18', null, null, null, array['foodie']::text[]),
  ('52c8d727-ad6e-4ada-a273-ba2a3bd65477', '683304ee-6894-42b8-ae13-64f9bf7d641b', '602b26c7-7ec8-4ca9-9c5c-4cd77451e0cd', 'Universal Studios Japan', 'place', 'activity', 'debate', 'Osaka', 34.6937, 135.5023, 'https://images.unsplash.com/photo-1612404459571-ccef4b6588e7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5OTQxOTZ8MHwxfHNlYXJjaHwxfHx1bml2ZXJzYWwlMjBzdHVkaW9zJTIwamFwYW58ZW58MHwwfHx8MTc5MTUzODg5MXww&ixlib=rb-4.1.0&q=80&w=1080', '086890c4-c2ae-44cf-8c70-2f597e98f771', null, null, null, array['foodie']::text[]),
  ('e4369107-8c40-4e7e-a366-ac7392df73b6', '683304ee-6894-42b8-ae13-64f9bf7d641b', '90316eca-b3e8-4f1b-9977-9b81309e3413', 'Karaoké géant à Namba', 'place', 'bar', 'pending', 'Osaka', 34.6937, 135.5023, 'https://images.unsplash.com/photo-1560640507-a9e7a39b38f0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5OTQxOTZ8MHwxfHNlYXJjaHwxfHxrYXJhb2tlJTIwamFwYW58ZW58MHwwfHx8MTc5MTUzODg5MXww&ixlib=rb-4.1.0&q=80&w=1080', '086890c4-c2ae-44cf-8c70-2f597e98f771', null, null, null, array['foodie']::text[]);

insert into public.wish_votes (wish_id, user_id, vote) values
  ('cd5eddfd-7437-459b-984d-f9277bf422c2', '90316eca-b3e8-4f1b-9977-9b81309e3413', 'up'),
  ('cd5eddfd-7437-459b-984d-f9277bf422c2', '6e9da77a-0648-4d86-b5de-139136c35692', 'up'),
  ('52c8d727-ad6e-4ada-a273-ba2a3bd65477', '90316eca-b3e8-4f1b-9977-9b81309e3413', 'up'),
  ('52c8d727-ad6e-4ada-a273-ba2a3bd65477', '3881b632-5461-455b-a37d-2e1c6eb73e40', 'down'),
  ('52c8d727-ad6e-4ada-a273-ba2a3bd65477', '602b26c7-7ec8-4ca9-9c5c-4cd77451e0cd', 'down'),
  ('52c8d727-ad6e-4ada-a273-ba2a3bd65477', '6e9da77a-0648-4d86-b5de-139136c35692', 'up'),
  ('e4369107-8c40-4e7e-a366-ac7392df73b6', '3881b632-5461-455b-a37d-2e1c6eb73e40', 'up');

insert into public.planning_items (trip_id, wish_id, title, day_date, start_time, end_time, sort_order, added_by, stop_id) values
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', 'f2cd5f25-4618-4dcf-8644-00b94024a482', 'Check-in · Hôtel capsule chic à Shinjuku', '2026-10-04', '15:00', '16:00', 0, '90316eca-b3e8-4f1b-9977-9b81309e3413', '476d4a2c-a2a7-4db1-b932-fb578a6084e7'),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', '8c5c9caa-93fb-486d-8903-38855f36c5e0', 'Check-in · Ryokan avec onsen à Hakone', '2026-10-08', '15:00', '16:00', 0, '6e9da77a-0648-4d86-b5de-139136c35692', 'b7153972-0952-489e-a2bd-09400a750b10'),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', 'f388cd44-f670-4315-9085-9f1a313db5dc', 'Check-in · Machiya traditionnelle à Gion', '2026-10-09', '16:00', '16:30', 0, '3881b632-5461-455b-a37d-2e1c6eb73e40', '441a1025-f6f2-4110-9609-075e1baf2d18'),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', '5446359a-6f48-4db5-8f10-8cc4ec504db0', 'Check-in · Appart à Namba', '2026-10-13', '15:00', '16:00', 0, '602b26c7-7ec8-4ca9-9c5c-4cd77451e0cd', '086890c4-c2ae-44cf-8c70-2f597e98f771'),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', '8217e507-7f64-45a0-b08f-d197589d9945', 'Carrefour de Shibuya de nuit', '2026-10-04', '18:00', '20:00', 1, '90316eca-b3e8-4f1b-9977-9b81309e3413', '476d4a2c-a2a7-4db1-b932-fb578a6084e7'),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', '46d203f1-92b6-4546-b620-7902c37f44f9', 'Temple Sensō-ji à Asakusa', '2026-10-05', '09:00', '11:30', 2, '6e9da77a-0648-4d86-b5de-139136c35692', '476d4a2c-a2a7-4db1-b932-fb578a6084e7'),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', '130144cc-6a25-4866-bd48-979a87448b20', 'teamLab Planets', '2026-10-05', '15:00', '17:30', 3, '3881b632-5461-455b-a37d-2e1c6eb73e40', '476d4a2c-a2a7-4db1-b932-fb578a6084e7'),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', '6d535eb6-5a2e-4cb4-81a7-0bd5861f54b1', 'Petit-déj au marché de Tsukiji', '2026-10-06', '08:00', '10:00', 4, '602b26c7-7ec8-4ca9-9c5c-4cd77451e0cd', '476d4a2c-a2a7-4db1-b932-fb578a6084e7'),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', 'bd5a27bb-8a4e-4369-9319-d36b33b964db', 'Bars de Golden Gai', '2026-10-06', '21:00', '23:30', 5, '90316eca-b3e8-4f1b-9977-9b81309e3413', '476d4a2c-a2a7-4db1-b932-fb578a6084e7'),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', '40231280-30ba-4a1f-92e0-e0aaf955403b', 'Akihabara et ses salles d’arcade', '2026-10-07', '10:00', '13:00', 6, '6e9da77a-0648-4d86-b5de-139136c35692', '476d4a2c-a2a7-4db1-b932-fb578a6084e7'),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', '8a8f7fc0-19ef-4e53-8aa8-7064ab1e2c9a', 'Bain à l’onsen', '2026-10-08', '17:00', '19:00', 7, '3881b632-5461-455b-a37d-2e1c6eb73e40', 'b7153972-0952-489e-a2bd-09400a750b10'),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', '49bf3cc7-cede-48dd-a809-71aebb67c4eb', 'Bateau pirate sur le lac Ashi', '2026-10-09', '08:30', '10:00', 8, '602b26c7-7ec8-4ca9-9c5c-4cd77451e0cd', 'b7153972-0952-489e-a2bd-09400a750b10'),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', '6a7f6e0c-40a6-456c-bb76-ae6e583ddbdd', 'Dîner dans la ruelle de Pontochō', '2026-10-09', '19:30', '21:30', 9, '90316eca-b3e8-4f1b-9977-9b81309e3413', '441a1025-f6f2-4110-9609-075e1baf2d18'),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', '8192a18f-4ab9-4282-b9d8-9b761e9dfe97', 'Fushimi Inari à l’aube', '2026-10-10', '07:00', '09:30', 10, '6e9da77a-0648-4d86-b5de-139136c35692', '441a1025-f6f2-4110-9609-075e1baf2d18'),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', '601db2cc-661b-4549-bc02-254030ae8b87', 'Pavillon d’or Kinkaku-ji', '2026-10-10', '11:30', '13:00', 11, '3881b632-5461-455b-a37d-2e1c6eb73e40', '441a1025-f6f2-4110-9609-075e1baf2d18'),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', 'd9721060-3714-47e3-8ac6-a736b67b0916', 'Bambouseraie d’Arashiyama', '2026-10-10', '15:30', '18:00', 12, '602b26c7-7ec8-4ca9-9c5c-4cd77451e0cd', '441a1025-f6f2-4110-9609-075e1baf2d18'),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', '4e716010-543b-4ebe-8cfb-17048c01edd6', 'Journée à Nara avec les daims', '2026-10-11', '10:00', '16:00', 13, '90316eca-b3e8-4f1b-9977-9b81309e3413', '441a1025-f6f2-4110-9609-075e1baf2d18'),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', '467dfdc8-8362-418a-8ad5-d11c5135638b', 'Cérémonie du thé', '2026-10-12', '14:00', '15:30', 14, '6e9da77a-0648-4d86-b5de-139136c35692', '441a1025-f6f2-4110-9609-075e1baf2d18'),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', 'd4385cf9-a45b-4a58-a6b6-a8a1684ca09a', 'Street food à Dōtonbori', '2026-10-13', '19:00', '22:00', 15, '3881b632-5461-455b-a37d-2e1c6eb73e40', '086890c4-c2ae-44cf-8c70-2f597e98f771'),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', 'e523adb0-50e6-4e91-a525-afcdd4f34b4c', 'Château d’Osaka', '2026-10-14', '10:00', '12:00', 16, '602b26c7-7ec8-4ca9-9c5c-4cd77451e0cd', '086890c4-c2ae-44cf-8c70-2f597e98f771'),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', null, 'Shinkansen Odawara → Kyoto', '2026-10-09', '12:41', '14:52', 50, '3881b632-5461-455b-a37d-2e1c6eb73e40', '441a1025-f6f2-4110-9609-075e1baf2d18'),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', null, 'Shinkansen Kyoto → Shin-Osaka', '2026-10-13', '10:15', '10:29', 51, '602b26c7-7ec8-4ca9-9c5c-4cd77451e0cd', '086890c4-c2ae-44cf-8c70-2f597e98f771');

insert into public.expenses (id, trip_id, paid_by, title, amount, currency, category, date, split_type, stop_id) values
  ('d5643833-eac9-468f-946f-65fe6b526be2', '683304ee-6894-42b8-ae13-64f9bf7d641b', '90316eca-b3e8-4f1b-9977-9b81309e3413', 'Vols Paris ⇄ Tokyo (×4)', 3480, 'EUR', 'transport', '2026-09-09', 'equal', null),
  ('0faabee9-d6d8-4b7e-9a00-d06fb82e393f', '683304ee-6894-42b8-ae13-64f9bf7d641b', '90316eca-b3e8-4f1b-9977-9b81309e3413', 'Hôtel capsule chic à Shinjuku', 520, 'EUR', 'accommodation', '2026-09-14', 'equal', '476d4a2c-a2a7-4db1-b932-fb578a6084e7'),
  ('c8f81311-9d87-446e-b42e-b6017125b9f1', '683304ee-6894-42b8-ae13-64f9bf7d641b', '6e9da77a-0648-4d86-b5de-139136c35692', 'Ryokan avec onsen à Hakone', 380, 'EUR', 'accommodation', '2026-09-18', 'equal', 'b7153972-0952-489e-a2bd-09400a750b10'),
  ('7c7e81b0-13e6-4e65-a572-f4b042bab4d3', '683304ee-6894-42b8-ae13-64f9bf7d641b', '3881b632-5461-455b-a37d-2e1c6eb73e40', 'Machiya traditionnelle à Gion', 610, 'EUR', 'accommodation', '2026-09-19', 'equal', '441a1025-f6f2-4110-9609-075e1baf2d18'),
  ('5c4b6218-165a-47a1-b575-be52e7fdda4d', '683304ee-6894-42b8-ae13-64f9bf7d641b', '602b26c7-7ec8-4ca9-9c5c-4cd77451e0cd', 'Appart à Namba', 440, 'EUR', 'accommodation', '2026-09-23', 'equal', '086890c4-c2ae-44cf-8c70-2f597e98f771'),
  ('56c53c23-fb8c-43d4-827c-c936457565d0', '683304ee-6894-42b8-ae13-64f9bf7d641b', '6e9da77a-0648-4d86-b5de-139136c35692', 'teamLab Planets', 128, 'EUR', 'activity', '2026-10-05', 'equal', '476d4a2c-a2a7-4db1-b932-fb578a6084e7'),
  ('dfdd54f3-effd-4e6a-b1f9-98ce07f6d719', '683304ee-6894-42b8-ae13-64f9bf7d641b', '3881b632-5461-455b-a37d-2e1c6eb73e40', 'Bateau pirate sur le lac Ashi', 48, 'EUR', 'activity', '2026-10-09', 'equal', 'b7153972-0952-489e-a2bd-09400a750b10'),
  ('2a691587-244f-4ff3-88c0-57c91bf99317', '683304ee-6894-42b8-ae13-64f9bf7d641b', '90316eca-b3e8-4f1b-9977-9b81309e3413', 'JR Pass 7 jours (×4)', 1360, 'EUR', 'transport', '2026-10-04', 'equal', '476d4a2c-a2a7-4db1-b932-fb578a6084e7'),
  ('f71c970d-3700-4ecb-b151-801fafdc0213', '683304ee-6894-42b8-ae13-64f9bf7d641b', '6e9da77a-0648-4d86-b5de-139136c35692', 'Cartes Suica', 80, 'EUR', 'transport', '2026-10-04', 'equal', '476d4a2c-a2a7-4db1-b932-fb578a6084e7'),
  ('b3e4ce1c-8b00-4521-b53d-14d78958e5d3', '683304ee-6894-42b8-ae13-64f9bf7d641b', '3881b632-5461-455b-a37d-2e1c6eb73e40', 'Ramen à Shinjuku', 54, 'EUR', 'food', '2026-10-04', 'equal', '476d4a2c-a2a7-4db1-b932-fb578a6084e7'),
  ('e543885a-12c7-423a-8ee9-5109080cb6a4', '683304ee-6894-42b8-ae13-64f9bf7d641b', '602b26c7-7ec8-4ca9-9c5c-4cd77451e0cd', 'Konbini & snacks', 38, 'EUR', 'shopping', '2026-10-05', 'equal', '476d4a2c-a2a7-4db1-b932-fb578a6084e7'),
  ('7ab29b52-2dce-47f3-89f6-d4c4689a0d35', '683304ee-6894-42b8-ae13-64f9bf7d641b', '90316eca-b3e8-4f1b-9977-9b81309e3413', 'Sushi au comptoir', 172, 'EUR', 'food', '2026-10-06', 'equal', '476d4a2c-a2a7-4db1-b932-fb578a6084e7'),
  ('173dc401-3576-4ae1-a76b-1622331372b1', '683304ee-6894-42b8-ae13-64f9bf7d641b', '6e9da77a-0648-4d86-b5de-139136c35692', 'Souvenirs à Akihabara', 66, 'EUR', 'shopping', '2026-10-07', 'equal', '476d4a2c-a2a7-4db1-b932-fb578a6084e7'),
  ('1694bc30-8b9a-4cee-a9a2-1d1c80705833', '683304ee-6894-42b8-ae13-64f9bf7d641b', '3881b632-5461-455b-a37d-2e1c6eb73e40', 'Bentos du Shinkansen', 32, 'EUR', 'food', '2026-10-09', 'equal', '441a1025-f6f2-4110-9609-075e1baf2d18');

insert into public.expense_splits (expense_id, user_id, amount, is_settled) values
  ('d5643833-eac9-468f-946f-65fe6b526be2', '90316eca-b3e8-4f1b-9977-9b81309e3413', 870, true),
  ('d5643833-eac9-468f-946f-65fe6b526be2', '6e9da77a-0648-4d86-b5de-139136c35692', 870, false),
  ('d5643833-eac9-468f-946f-65fe6b526be2', '3881b632-5461-455b-a37d-2e1c6eb73e40', 870, false),
  ('d5643833-eac9-468f-946f-65fe6b526be2', '602b26c7-7ec8-4ca9-9c5c-4cd77451e0cd', 870, false),
  ('0faabee9-d6d8-4b7e-9a00-d06fb82e393f', '90316eca-b3e8-4f1b-9977-9b81309e3413', 130, true),
  ('0faabee9-d6d8-4b7e-9a00-d06fb82e393f', '6e9da77a-0648-4d86-b5de-139136c35692', 130, false),
  ('0faabee9-d6d8-4b7e-9a00-d06fb82e393f', '3881b632-5461-455b-a37d-2e1c6eb73e40', 130, false),
  ('0faabee9-d6d8-4b7e-9a00-d06fb82e393f', '602b26c7-7ec8-4ca9-9c5c-4cd77451e0cd', 130, false),
  ('c8f81311-9d87-446e-b42e-b6017125b9f1', '90316eca-b3e8-4f1b-9977-9b81309e3413', 95, false),
  ('c8f81311-9d87-446e-b42e-b6017125b9f1', '6e9da77a-0648-4d86-b5de-139136c35692', 95, true),
  ('c8f81311-9d87-446e-b42e-b6017125b9f1', '3881b632-5461-455b-a37d-2e1c6eb73e40', 95, false),
  ('c8f81311-9d87-446e-b42e-b6017125b9f1', '602b26c7-7ec8-4ca9-9c5c-4cd77451e0cd', 95, false),
  ('7c7e81b0-13e6-4e65-a572-f4b042bab4d3', '90316eca-b3e8-4f1b-9977-9b81309e3413', 152.5, false),
  ('7c7e81b0-13e6-4e65-a572-f4b042bab4d3', '6e9da77a-0648-4d86-b5de-139136c35692', 152.5, false),
  ('7c7e81b0-13e6-4e65-a572-f4b042bab4d3', '3881b632-5461-455b-a37d-2e1c6eb73e40', 152.5, true),
  ('7c7e81b0-13e6-4e65-a572-f4b042bab4d3', '602b26c7-7ec8-4ca9-9c5c-4cd77451e0cd', 152.5, false),
  ('5c4b6218-165a-47a1-b575-be52e7fdda4d', '90316eca-b3e8-4f1b-9977-9b81309e3413', 110, false),
  ('5c4b6218-165a-47a1-b575-be52e7fdda4d', '6e9da77a-0648-4d86-b5de-139136c35692', 110, false),
  ('5c4b6218-165a-47a1-b575-be52e7fdda4d', '3881b632-5461-455b-a37d-2e1c6eb73e40', 110, false),
  ('5c4b6218-165a-47a1-b575-be52e7fdda4d', '602b26c7-7ec8-4ca9-9c5c-4cd77451e0cd', 110, true),
  ('56c53c23-fb8c-43d4-827c-c936457565d0', '90316eca-b3e8-4f1b-9977-9b81309e3413', 32, false),
  ('56c53c23-fb8c-43d4-827c-c936457565d0', '6e9da77a-0648-4d86-b5de-139136c35692', 32, true),
  ('56c53c23-fb8c-43d4-827c-c936457565d0', '3881b632-5461-455b-a37d-2e1c6eb73e40', 32, false),
  ('56c53c23-fb8c-43d4-827c-c936457565d0', '602b26c7-7ec8-4ca9-9c5c-4cd77451e0cd', 32, false),
  ('dfdd54f3-effd-4e6a-b1f9-98ce07f6d719', '90316eca-b3e8-4f1b-9977-9b81309e3413', 12, false),
  ('dfdd54f3-effd-4e6a-b1f9-98ce07f6d719', '6e9da77a-0648-4d86-b5de-139136c35692', 12, false),
  ('dfdd54f3-effd-4e6a-b1f9-98ce07f6d719', '3881b632-5461-455b-a37d-2e1c6eb73e40', 12, true),
  ('dfdd54f3-effd-4e6a-b1f9-98ce07f6d719', '602b26c7-7ec8-4ca9-9c5c-4cd77451e0cd', 12, false),
  ('2a691587-244f-4ff3-88c0-57c91bf99317', '90316eca-b3e8-4f1b-9977-9b81309e3413', 340, true),
  ('2a691587-244f-4ff3-88c0-57c91bf99317', '6e9da77a-0648-4d86-b5de-139136c35692', 340, false),
  ('2a691587-244f-4ff3-88c0-57c91bf99317', '3881b632-5461-455b-a37d-2e1c6eb73e40', 340, false),
  ('2a691587-244f-4ff3-88c0-57c91bf99317', '602b26c7-7ec8-4ca9-9c5c-4cd77451e0cd', 340, false),
  ('f71c970d-3700-4ecb-b151-801fafdc0213', '90316eca-b3e8-4f1b-9977-9b81309e3413', 20, false),
  ('f71c970d-3700-4ecb-b151-801fafdc0213', '6e9da77a-0648-4d86-b5de-139136c35692', 20, true),
  ('f71c970d-3700-4ecb-b151-801fafdc0213', '3881b632-5461-455b-a37d-2e1c6eb73e40', 20, false),
  ('f71c970d-3700-4ecb-b151-801fafdc0213', '602b26c7-7ec8-4ca9-9c5c-4cd77451e0cd', 20, false),
  ('b3e4ce1c-8b00-4521-b53d-14d78958e5d3', '90316eca-b3e8-4f1b-9977-9b81309e3413', 13.5, false),
  ('b3e4ce1c-8b00-4521-b53d-14d78958e5d3', '6e9da77a-0648-4d86-b5de-139136c35692', 13.5, false),
  ('b3e4ce1c-8b00-4521-b53d-14d78958e5d3', '3881b632-5461-455b-a37d-2e1c6eb73e40', 13.5, true),
  ('b3e4ce1c-8b00-4521-b53d-14d78958e5d3', '602b26c7-7ec8-4ca9-9c5c-4cd77451e0cd', 13.5, false),
  ('e543885a-12c7-423a-8ee9-5109080cb6a4', '90316eca-b3e8-4f1b-9977-9b81309e3413', 9.5, false),
  ('e543885a-12c7-423a-8ee9-5109080cb6a4', '6e9da77a-0648-4d86-b5de-139136c35692', 9.5, false),
  ('e543885a-12c7-423a-8ee9-5109080cb6a4', '3881b632-5461-455b-a37d-2e1c6eb73e40', 9.5, false),
  ('e543885a-12c7-423a-8ee9-5109080cb6a4', '602b26c7-7ec8-4ca9-9c5c-4cd77451e0cd', 9.5, true),
  ('7ab29b52-2dce-47f3-89f6-d4c4689a0d35', '90316eca-b3e8-4f1b-9977-9b81309e3413', 43, true),
  ('7ab29b52-2dce-47f3-89f6-d4c4689a0d35', '6e9da77a-0648-4d86-b5de-139136c35692', 43, false),
  ('7ab29b52-2dce-47f3-89f6-d4c4689a0d35', '3881b632-5461-455b-a37d-2e1c6eb73e40', 43, false),
  ('7ab29b52-2dce-47f3-89f6-d4c4689a0d35', '602b26c7-7ec8-4ca9-9c5c-4cd77451e0cd', 43, false),
  ('173dc401-3576-4ae1-a76b-1622331372b1', '90316eca-b3e8-4f1b-9977-9b81309e3413', 16.5, false),
  ('173dc401-3576-4ae1-a76b-1622331372b1', '6e9da77a-0648-4d86-b5de-139136c35692', 16.5, true),
  ('173dc401-3576-4ae1-a76b-1622331372b1', '3881b632-5461-455b-a37d-2e1c6eb73e40', 16.5, false),
  ('173dc401-3576-4ae1-a76b-1622331372b1', '602b26c7-7ec8-4ca9-9c5c-4cd77451e0cd', 16.5, false),
  ('1694bc30-8b9a-4cee-a9a2-1d1c80705833', '90316eca-b3e8-4f1b-9977-9b81309e3413', 8, false),
  ('1694bc30-8b9a-4cee-a9a2-1d1c80705833', '6e9da77a-0648-4d86-b5de-139136c35692', 8, false),
  ('1694bc30-8b9a-4cee-a9a2-1d1c80705833', '3881b632-5461-455b-a37d-2e1c6eb73e40', 8, true),
  ('1694bc30-8b9a-4cee-a9a2-1d1c80705833', '602b26c7-7ec8-4ca9-9c5c-4cd77451e0cd', 8, false);

insert into public.trip_photos (trip_id, uploaded_by, photo_url, created_at) values
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', '90316eca-b3e8-4f1b-9977-9b81309e3413', 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5OTQxOTZ8MHwxfHNlYXJjaHwxfHxzaGlidXlhJTIwY3Jvc3Npbmd8ZW58MHwwfHx8MTc5MTUzODg5Mnww&ixlib=rb-4.1.0&q=80&w=1080', '2026-10-04T19:30:00Z'),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', '3881b632-5461-455b-a37d-2e1c6eb73e40', 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5OTQxOTZ8MHwxfHNlYXJjaHwxfHx0b2t5byUyMG5pZ2h0JTIwbmVvbnxlbnwwfDB8fHwxNzkxNTM4ODkyfDA&ixlib=rb-4.1.0&q=80&w=1080', '2026-10-04T19:30:00Z'),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', '6e9da77a-0648-4d86-b5de-139136c35692', 'https://images.unsplash.com/photo-1542090518-6c4131442225?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5OTQxOTZ8MHwxfHNlYXJjaHwxfHxzZW5zby1qaSUyMGFzYWt1c2F8ZW58MHwwfHx8MTc5MTUzODg5Mnww&ixlib=rb-4.1.0&q=80&w=1080', '2026-10-05T19:30:00Z'),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', '90316eca-b3e8-4f1b-9977-9b81309e3413', 'https://images.unsplash.com/photo-1593073862407-a3ce22748763?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5OTQxOTZ8MHwxfHNlYXJjaHwxfHx0ZWFtbGFiJTIwdG9reW98ZW58MHwwfHx8MTc5MTUzODg5M3ww&ixlib=rb-4.1.0&q=80&w=1080', '2026-10-05T19:30:00Z'),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', '602b26c7-7ec8-4ca9-9c5c-4cd77451e0cd', 'https://images.unsplash.com/photo-1604366018830-bf304a797d6c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5OTQxOTZ8MHwxfHNlYXJjaHwxfHx0c3VraWppJTIwc3VzaGl8ZW58MHwwfHx8MTc5MTUzODg5M3ww&ixlib=rb-4.1.0&q=80&w=1080', '2026-10-06T19:30:00Z'),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', '3881b632-5461-455b-a37d-2e1c6eb73e40', 'https://images.unsplash.com/photo-1752338384209-ebd5b8fd89b6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5OTQxOTZ8MHwxfHNlYXJjaHwxfHxnb2xkZW4lMjBnYWl8ZW58MHwwfHx8MTc5MTUzODg5NHww&ixlib=rb-4.1.0&q=80&w=1080', '2026-10-06T19:30:00Z'),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', '6e9da77a-0648-4d86-b5de-139136c35692', 'https://images.unsplash.com/photo-1613487957484-32c977a8bd62?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5OTQxOTZ8MHwxfHNlYXJjaHwxfHxha2loYWJhcmF8ZW58MHwwfHx8MTc5MTUzODg4N3ww&ixlib=rb-4.1.0&q=80&w=1080', '2026-10-07T19:30:00Z'),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', '90316eca-b3e8-4f1b-9977-9b81309e3413', 'https://images.unsplash.com/photo-1706577265379-cf16ae255603?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5OTQxOTZ8MHwxfHNlYXJjaHwxfHxoYWtvbmUlMjBvbnNlbnxlbnwwfDB8fHwxNzkxNTM4ODk0fDA&ixlib=rb-4.1.0&q=80&w=1080', '2026-10-08T19:30:00Z'),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', '602b26c7-7ec8-4ca9-9c5c-4cd77451e0cd', 'https://images.unsplash.com/photo-1785057707635-e0d86712fc6e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5OTQxOTZ8MHwxfHNlYXJjaHwxfHxtb3VudCUyMGZ1amklMjBsYWtlJTIwYXNoaXxlbnwwfDB8fHwxNzkxNTM4ODk1fDA&ixlib=rb-4.1.0&q=80&w=1080', '2026-10-09T08:30:00Z');

insert into public.documents (trip_id, uploaded_by, title, category, file_url, file_type, file_size, event_date, is_shared, details) values
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', '90316eca-b3e8-4f1b-9977-9b81309e3413', 'Vol Paris → Tokyo', 'flight', 'https://tpiwpmqijitzyyujzvqu.supabase.co/storage/v1/object/public/documents/demo-japan/vol-paris-tokyo.pdf', 'application/pdf', 883, '2026-10-04', true, '{"from":"CDG","to":"HND","departure":"11:25","arrival":"07:05","passenger":"4 voyageurs","seat":"32A-D","gate":"K41","boarding":"10:45","reference":"AF8KX2"}'::jsonb),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', '90316eca-b3e8-4f1b-9977-9b81309e3413', 'JR Pass 7 jours', 'transport', 'https://tpiwpmqijitzyyujzvqu.supabase.co/storage/v1/object/public/documents/demo-japan/jr-pass.pdf', 'application/pdf', 769, '2026-10-04', true, '{"passenger":"4 voyageurs","reference":"JRP-48213"}'::jsonb),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', '90316eca-b3e8-4f1b-9977-9b81309e3413', 'Billets teamLab Planets', 'activity', 'https://tpiwpmqijitzyyujzvqu.supabase.co/storage/v1/object/public/documents/demo-japan/teamlab.pdf', 'application/pdf', 804, '2026-10-05', true, '{"departure":"15:00","passenger":"4 adultes","reference":"TLP-77310"}'::jsonb),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', '3881b632-5461-455b-a37d-2e1c6eb73e40', 'Shinkansen Odawara → Kyoto', 'transport', 'https://tpiwpmqijitzyyujzvqu.supabase.co/storage/v1/object/public/documents/demo-japan/shinkansen-odawara-kyoto.pdf', 'application/pdf', 911, '2026-10-09', true, '{"from":"Odawara","to":"Kyoto","departure":"12:41","arrival":"14:52","passenger":"4 voyageurs","seat":"Voiture 7 · 12A-D","reference":"HKR-6612"}'::jsonb),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', '3881b632-5461-455b-a37d-2e1c6eb73e40', 'Réservation machiya à Gion', 'hotel', 'https://tpiwpmqijitzyyujzvqu.supabase.co/storage/v1/object/public/documents/demo-japan/machiya-gion.pdf', 'application/pdf', 770, '2026-10-09', true, '{"departure":"16:00","reference":"MCH-2291"}'::jsonb),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', '602b26c7-7ec8-4ca9-9c5c-4cd77451e0cd', 'Shinkansen Kyoto → Shin-Osaka', 'transport', 'https://tpiwpmqijitzyyujzvqu.supabase.co/storage/v1/object/public/documents/demo-japan/shinkansen-kyoto-osaka.pdf', 'application/pdf', 916, '2026-10-13', true, '{"from":"Kyoto","to":"Shin-Osaka","departure":"10:15","arrival":"10:29","passenger":"4 voyageurs","seat":"Voiture 3 · 5A-D","reference":"KSO-1180"}'::jsonb),
  ('683304ee-6894-42b8-ae13-64f9bf7d641b', '6e9da77a-0648-4d86-b5de-139136c35692', 'Assurance voyage', 'insurance', 'https://tpiwpmqijitzyyujzvqu.supabase.co/storage/v1/object/public/documents/demo-japan/assurance.pdf', 'application/pdf', 706, null, true, null);

commit;
