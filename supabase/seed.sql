-- Seed démo Eventis — généré par tools/export-seed.mjs (ne pas éditer à la main).
-- Idempotent : relançable sans doublon (on conflict do nothing).

begin;

insert into public.profiles (id, full_name, phone, role, suspended, created_at) values
  ('e1f65c57-0cb2-fe90-77fe-f824cd002d30', 'Afi Mensah', '+228 90 11 22 33', 'client', false, '2026-08-30T22:20:27.613Z'::timestamptz),
  ('a5c0ab01-d0f2-a47f-86f3-85ef1c2a46a9', 'Kossi Amevor', '+228 91 44 55 66', 'client', false, '2026-09-06T22:20:27.615Z'::timestamptz),
  ('184d929d-42f8-98e7-0607-f44e11b24b61', 'Ayaba Kpodar', '+228 92 77 88 99', 'client', false, '2026-09-23T22:20:27.615Z'::timestamptz),
  ('8812856e-0369-fe6b-1729-6ea03a6bb811', 'Kokou Aïvodji', '+228 90 55 66 77', 'prestataire', false, '2026-08-15T22:20:27.615Z'::timestamptz),
  ('88fa67ac-f20f-7fc1-597f-ee55f12c017c', 'Équipe Eventis', '+228 70 00 00 00', 'admin', false, '2026-07-16T22:20:27.615Z'::timestamptz),
  ('8812856e-0369-fe6b-1729-6ea03a6bb811', 'Gérant·e Saveurs d’Atakpamé', '+228 90 55 66 77', 'prestataire', false, '2026-08-17T22:20:27.615Z'::timestamptz),
  ('b1e45fa1-1436-67e7-afb2-b854a9ab088f', 'Gérant·e Élégance & Fiore', '+228 93 12 34 56', 'prestataire', false, '2026-09-03T22:20:27.615Z'::timestamptz),
  ('e89198be-7b0b-1832-541b-78ff7f783674', 'Gérant·e Lumen Studio', '+228 96 22 44 88', 'prestataire', false, '2026-09-09T22:20:27.615Z'::timestamptz),
  ('5c994d96-85ca-01fd-d45d-66b8f6f55325', 'Gérant·e DJ K-Roll Sound', '+228 97 33 55 11', 'prestataire', false, '2026-09-14T22:20:27.615Z'::timestamptz),
  ('9bfc06d6-c11e-081a-7a4a-8c7a4f2d7a0b', 'Gérant·e Espace Le Baobab', '+228 91 66 22 44', 'prestataire', false, '2026-09-18T22:20:27.615Z'::timestamptz),
  ('342c7e4e-9730-e498-c770-98d8f467d146', 'Gérant·e LocaFête', '+228 92 88 44 22', 'prestataire', false, '2026-09-22T22:20:27.615Z'::timestamptz),
  ('b1c45833-8e3e-a3d2-8a1c-bab236b88bf7', 'Gérant·e N’Konou Events', '+228 94 11 33 77', 'prestataire', false, '2026-09-26T22:20:27.615Z'::timestamptz),
  ('ad6466f6-b69b-e0f7-5e40-a1f7e090df0c', 'Gérant·e Agbé Animation', '+228 95 44 88 22', 'prestataire', false, '2026-09-29T22:20:27.615Z'::timestamptz),
  ('1ce8bf30-b3a2-a909-9530-0639dec62e7d', 'Gérant·e Voix d’Or MC', '+228 98 55 11 99', 'prestataire', false, '2026-10-04T22:20:27.615Z'::timestamptz),
  ('242b8b03-b5c7-701b-b3e8-9c192ae3afc6', 'Gérant·e Le Gourmand d’Or', '+228 90 99 88 77', 'prestataire', false, '2026-10-08T22:20:27.615Z'::timestamptz)
on conflict (id) do nothing;

insert into public.categories (id, slug, name, icon, active) values
  ('4f53c66d-89a9-3f1c-85b0-25836ef4a534', 'traiteur', 'Traiteur & Restauration', 'fork', true),
  ('48268763-92af-d965-cab9-ea080b451376', 'decoration', 'Décoration', 'flower', true),
  ('479b6d87-1f53-8b6e-d1a5-e2bab0b87571', 'photo-video', 'Photo & Vidéo', 'camera', true),
  ('4ae57239-5030-c640-46a9-87cc1c194999', 'dj-sonorisation', 'DJ & Sonorisation', 'music', true),
  ('090a6df8-ada7-3cfc-bf32-a4ed46f9cfaa', 'salles-lieux', 'Salles & Lieux', 'building', true),
  ('6c8adc90-29d8-ce1b-acf6-ce2cfd0a6550', 'location-materiel', 'Location de matériel', 'chair', true),
  ('908ffc89-b390-0a80-b145-93e19ddc451d', 'wedding-planner', 'Wedding Planner', 'rings', true),
  ('4ec18561-5ff1-9df5-adaf-04178b7513ff', 'animation', 'Animation & MC', 'mic', true)
on conflict (slug) do nothing;

insert into public.providers (id, profile_id, category_id, business_name, description, city, quarter, phone, whatsapp, price_from, price_to, cover_url, gallery, status, is_verified, created_at) values
  ('a2dce619-5ace-c202-f4a2-7f08d12d5f5f', '8812856e-0369-fe6b-1729-6ea03a6bb811', '4f53c66d-89a9-3f1c-85b0-25836ef4a534', 'Saveurs d’Atakpamé', 'Cuisine togolaise et internationale pour mariages, baptêmes et séminaires. Menus sur mesure, service traiteur complet de la préparation au dressage.', 'Lomé', 'Bè', '+228 90 55 66 77', '+228 90 55 66 77', 250000, 2500000, '/assets/img/providers/saveurs-d-atakpame.jpg', '[]'::jsonb, 'approved', true, '2026-08-17T22:20:27.615Z'::timestamptz),
  ('6c439db8-97cd-935a-41e7-923df1e1a275', 'b1e45fa1-1436-67e7-afb2-b854a9ab088f', '48268763-92af-d965-cab9-ea080b451376', 'Élégance & Fiore', 'Scénographie florale et décoration d’événements : arches, tables d’honneur, éclairage d’ambiance et art de la table.', 'Lomé', 'Agbalépédogan', '+228 93 12 34 56', '+228 93 12 34 56', 150000, 1800000, '/assets/img/providers/elegance-fiore.jpg', '[]'::jsonb, 'approved', true, '2026-09-03T22:20:27.615Z'::timestamptz),
  ('fea9669b-8eb0-8c49-0a49-77d63751a6c9', 'e89198be-7b0b-1832-541b-78ff7f783674', '479b6d87-1f53-8b6e-d1a5-e2bab0b87571', 'Lumen Studio', 'Photographie et vidéo d’événements : reportage mariage, drone, livre photo et même-minute. Équipe de 4 photographes.', 'Lomé', 'Tokoin', '+228 96 22 44 88', '+228 96 22 44 88', 180000, 900000, '/assets/img/providers/lumen-studio.jpg', '[]'::jsonb, 'approved', true, '2026-09-09T22:20:27.615Z'::timestamptz),
  ('1c6c65c3-39bd-cb80-cb3c-858fb6dc590f', '5c994d96-85ca-01fd-d45d-66b8f6f55325', '4ae57239-5030-c640-46a9-87cc1c194999', 'DJ K-Roll Sound', 'DJ professionnel, sonorisation et éclairage scénique pour soirées privées, mariages et événements corporate.', 'Lomé', 'Adidogomé', '+228 97 33 55 11', '+228 97 33 55 11', 120000, 600000, '/assets/img/providers/dj-kroll.jpg', '[]'::jsonb, 'approved', false, '2026-09-14T22:20:27.615Z'::timestamptz),
  ('931f5d8d-262a-5eeb-b4b9-0b6a72e744e5', '9bfc06d6-c11e-081a-7a4a-8c7a4f2d7a0b', '090a6df8-ada7-3cfc-bf32-a4ed46f9cfaa', 'Espace Le Baobab', 'Salle des fêtes climatisée de 300 places avec parking, cuisine équipée et espace extérieur pour cérémonies laïques.', 'Lomé', 'Agoè', '+228 91 66 22 44', '+228 91 66 22 44', 400000, 1200000, '/assets/img/providers/espace-baobab.jpg', '[]'::jsonb, 'approved', false, '2026-09-18T22:20:27.615Z'::timestamptz),
  ('b265a5d0-4a16-9641-bd52-445967026d36', '342c7e4e-9730-e498-c770-98d8f467d146', '6c8adc90-29d8-ce1b-acf6-ce2cfd0a6550', 'LocaFête', 'Location de chaises, tables, barnums, nappes et vaisselle pour tous vos événements. Livraison dans tout Grand Lomé.', 'Lomé', 'Hédzranawoé', '+228 92 88 44 22', '+228 92 88 44 22', 50000, 800000, '/assets/img/providers/locafete.jpg', '[]'::jsonb, 'approved', false, '2026-09-22T22:20:27.615Z'::timestamptz),
  ('0dae8e1e-8e1a-a071-4db1-670dd0216092', 'b1c45833-8e3e-a3d2-8a1c-bab236b88bf7', '908ffc89-b390-0a80-b145-93e19ddc451d', 'N’Konou Events', 'Wedding planner : coordination du jour J, recherche de prestataires, budget et planning. Mariages clés en main.', 'Lomé', 'Agoè', '+228 94 11 33 77', '+228 94 11 33 77', 300000, 2000000, '/assets/img/providers/nkonou-events.jpg', '[]'::jsonb, 'approved', false, '2026-09-26T22:20:27.615Z'::timestamptz),
  ('9e4ed5f1-063c-0e47-1214-84c7930ae77c', 'ad6466f6-b69b-e0f7-5e40-a1f7e090df0c', '4ec18561-5ff1-9df5-adaf-04178b7513ff', 'Agbé Animation', 'Animation de soirées : jeux, danse traditionnelle et moderne, mascottes et shows pour enfants.', 'Lomé', 'Bè', '+228 95 44 88 22', '+228 95 44 88 22', 100000, 500000, '/assets/img/providers/agbe-animation.jpg', '[]'::jsonb, 'approved', false, '2026-09-29T22:20:27.615Z'::timestamptz),
  ('1d022176-64d8-c686-e0a9-0144e8272e07', '1ce8bf30-b3a2-a909-9530-0639dec62e7d', '4ec18561-5ff1-9df5-adaf-04178b7513ff', 'Voix d’Or MC', 'Maître de cérémonie bilingue français-ewé, animation de mariages, galas et conférences.', 'Lomé', 'Tokoin', '+228 98 55 11 99', '+228 98 55 11 99', 80000, 400000, '/assets/img/providers/voix-d-or.jpg', '[]'::jsonb, 'approved', false, '2026-10-04T22:20:27.615Z'::timestamptz),
  ('87a090fc-8cc7-c243-ee8c-87b275ef7c6a', '242b8b03-b5c7-701b-b3e8-9c192ae3afc6', '4f53c66d-89a9-3f1c-85b0-25836ef4a534', 'Le Gourmand d’Or', 'Pâtisserie de cérémonie : pièces montées, gâteaux d’anniversaire personnalisés et buffets sucrés.', 'Lomé', 'Adidogomé', '+228 90 99 88 77', '+228 90 99 88 77', 60000, 700000, '/assets/img/providers/gourmand-or.jpg', '[]'::jsonb, 'approved', false, '2026-10-08T22:20:27.615Z'::timestamptz)
on conflict (id) do nothing;

insert into public.services (id, provider_id, label, description, price) values
  ('8ddf8780-39b7-0767-c4a5-bcf4f0c4f65e', 'a2dce619-5ace-c202-f4a2-7f08d12d5f5f', 'Buffet mariage (par personne)', 'Entrée, plat, dessert, boissons', 4500),
  ('fac98944-7cad-2edb-c89f-bcba70003b36', 'a2dce619-5ace-c202-f4a2-7f08d12d5f5f', 'Cocktail d’entreprise (par personne)', 'Bouchées salées et sucrées', 3500),
  ('c0828e03-8173-0bef-d1f7-a025057c74fb', 'a2dce619-5ace-c202-f4a2-7f08d12d5f5f', 'Dîner de gala (par personne)', 'Service à table, 3 plats', 6000),
  ('7e7cb681-4b74-d659-6098-fc80127569a5', '6c439db8-97cd-935a-41e7-923df1e1a275', 'Décoration florale complète', 'Arche, tables d’honneur, allée centrale', 450000),
  ('437f5780-9f82-b9e2-947f-70fd488eb536', '6c439db8-97cd-935a-41e7-923df1e1a275', 'Art de la table', 'Nappage, vaisselle, centres de table', 180000),
  ('425db905-039f-7a65-59ce-1115efa7d397', 'fea9669b-8eb0-8c49-0a49-77d63751a6c9', 'Reportage photo journée', '2 photographes, 300 photos retouchées', 350000),
  ('9d7115b4-2254-d59b-8244-0ebe8084927f', 'fea9669b-8eb0-8c49-0a49-77d63751a6c9', 'Vidéo + drone', 'Film 10 min + séquences drone', 500000),
  ('3e8d88fd-d85d-7153-525e-0647cdd97686', '1c6c65c3-39bd-cb80-cb3c-858fb6dc590f', 'Prestation DJ soirée', 'DJ + enceintes + micros, 6 h', 250000),
  ('03e04301-b15a-7969-eae9-d94821cc8222', '931f5d8d-262a-5eeb-b4b9-0b6a72e744e5', 'Location salle (journée)', '300 places, climatisation, parking', 800000),
  ('2b3357d9-0b70-edb1-773b-ba13390166c1', 'b265a5d0-4a16-9641-bd52-445967026d36', 'Chaise pliante (unité)', 'Livraison incluse dès 50 unités', 500),
  ('e744f97e-b579-be2c-8613-2824e8f4787e', '0dae8e1e-8e1a-a071-4db1-670dd0216092', 'Coordination jour J', 'Accompagnement complet du mariage', 650000),
  ('3dfae9d6-8590-fef9-704a-6a3ddabe6313', '9e4ed5f1-063c-0e47-1214-84c7930ae77c', 'Animation soirée (4 h)', 'Jeux, danse, animation micro', 200000),
  ('f38672fc-0f5a-142d-5387-292c0f66e264', '1d022176-64d8-c686-e0a9-0144e8272e07', 'Maître de cérémonie', 'Cérémonie laïque + soirée', 150000),
  ('df512b9c-b3e7-d8de-7206-c647590b6de0', '87a090fc-8cc7-c243-ee8c-87b275ef7c6a', 'Pièce montée', 'À partir de, sur devis selon étages', 120000)
on conflict (id) do nothing;

insert into public.requests (id, client_id, provider_id, event_type, event_date, guests, budget, message, status, created_at, updated_at) values
  ('7c92cf1e-ee8d-99cc-85f8-355a3d6e4b86', 'e1f65c57-0cb2-fe90-77fe-f824cd002d30', 'fea9669b-8eb0-8c49-0a49-77d63751a6c9', 'mariage', '2026-11-03'::date, 250, 600000, 'Bonjour, nous cherchons un photographe pour notre mariage le 2 novembre à Agoè.', 'closed', '2026-10-02T22:20:27.615Z'::timestamptz, '2026-10-12T22:20:27.615Z'::timestamptz),
  ('d2791864-28a7-5016-b17e-4df5ea43d080', 'e1f65c57-0cb2-fe90-77fe-f824cd002d30', '6c439db8-97cd-935a-41e7-923df1e1a275', 'mariage', '2026-11-18'::date, 250, 500000, 'Nous souhaiterions un devis pour la décoration florale de notre cérémonie.', 'in_progress', '2026-10-06T22:20:27.615Z'::timestamptz, '2026-10-13T22:20:27.615Z'::timestamptz),
  ('9d3e622d-f914-d8de-7f74-7b7b8b143c52', 'e1f65c57-0cb2-fe90-77fe-f824cd002d30', '1c6c65c3-39bd-cb80-cb3c-858fb6dc590f', 'anniversaire', '2026-10-24'::date, 80, 250000, 'Soirée anniversaire le 24 octobre, recherche DJ avec sono et lumières.', 'sent', '2026-10-12T22:20:27.615Z'::timestamptz, '2026-10-12T22:20:27.615Z'::timestamptz),
  ('44379f2b-1a56-11f6-2559-2bbf6e596a47', 'a5c0ab01-d0f2-a47f-86f3-85ef1c2a46a9', 'a2dce619-5ace-c202-f4a2-7f08d12d5f5f', 'bapteme', '2026-10-29'::date, 120, 800000, 'Baptême le 18 octobre à Bè, buffet pour 120 personnes. Merci de nous faire un devis.', 'sent', '2026-10-13T22:20:27.615Z'::timestamptz, '2026-10-13T22:20:27.615Z'::timestamptz)
on conflict (id) do nothing;

insert into public.messages (id, request_id, sender_id, body, read_at, created_at) values
  ('ae7be26c-daa7-42ca-1480-68d5ac90eaca', '7c92cf1e-ee8d-99cc-85f8-355a3d6e4b86', 'e1f65c57-0cb2-fe90-77fe-f824cd002d30', 'Bonjour, nous cherchons un photographe pour notre mariage le 2 novembre à Agoè.', '2026-10-03T22:20:27.615Z'::timestamptz, '2026-10-02T22:20:27.615Z'::timestamptz),
  ('aaf2f899-9237-9705-dac8-44c0a2a1d45f', '7c92cf1e-ee8d-99cc-85f8-355a3d6e4b86', 'e89198be-7b0b-1832-541b-78ff7f783674', 'Bonjour ! Nous sommes disponibles. Reportage photo + drone : 750 000 FCFA. Nous pouvons nous rencontrer cette semaine.', '2026-10-04T22:20:27.615Z'::timestamptz, '2026-10-03T22:20:27.615Z'::timestamptz),
  ('9678f7a7-939f-457f-a0d9-353761e189c7', '7c92cf1e-ee8d-99cc-85f8-355a3d6e4b86', 'e1f65c57-0cb2-fe90-77fe-f824cd002d30', 'Parfait, nous acceptons. Rendez-vous jeudi 18 h à notre domicile.', '2026-10-05T22:20:27.615Z'::timestamptz, '2026-10-04T22:20:27.615Z'::timestamptz),
  ('fd6b6fc9-220b-72d2-1683-ae8e4f50a210', 'd2791864-28a7-5016-b17e-4df5ea43d080', 'e1f65c57-0cb2-fe90-77fe-f824cd002d30', 'Nous souhaiterions un devis pour la décoration florale de notre cérémonie.', '2026-10-07T22:20:27.615Z'::timestamptz, '2026-10-06T22:20:27.615Z'::timestamptz),
  ('7b1f6dff-14d8-c2df-eb7d-a9487be0612d', 'd2791864-28a7-5016-b17e-4df5ea43d080', 'b1e45fa1-1436-67e7-afb2-b854a9ab088f', 'Bonjour, merci pour votre demande. Nous vous envoyons notre catalogue fleurs et un devis sous 48 h.', '2026-10-13T22:20:27.615Z'::timestamptz, '2026-10-07T22:20:27.615Z'::timestamptz),
  ('36604411-a85d-b2bd-9e97-e22bfb5b692d', '9d3e622d-f914-d8de-7f74-7b7b8b143c52', 'e1f65c57-0cb2-fe90-77fe-f824cd002d30', 'Soirée anniversaire le 24 octobre, recherche DJ avec sono et lumières.', null, '2026-10-12T22:20:27.615Z'::timestamptz),
  ('0449904f-bf32-607b-f8ce-5c26823dbc29', '44379f2b-1a56-11f6-2559-2bbf6e596a47', 'a5c0ab01-d0f2-a47f-86f3-85ef1c2a46a9', 'Baptême le 18 octobre à Bè, buffet pour 120 personnes. Merci de nous faire un devis.', null, '2026-10-13T22:20:27.615Z'::timestamptz),
  ('980b79c2-a71b-9bcc-117e-08a990b5b332', 'd2791864-28a7-5016-b17e-4df5ea43d080', 'b1e45fa1-1436-67e7-afb2-b854a9ab088f', 'Bonjour, voici notre catalogue 2026. N’hésitez pas à nous dire vos préférences de couleurs.', null, '2026-10-14T22:20:27.615Z'::timestamptz)
on conflict (id) do nothing;

insert into public.reviews (id, request_id, client_id, provider_id, rating, comment, visible, created_at) values
  ('6654c734-ccab-8f44-0ff0-825eb443dc7f', '7c92cf1e-ee8d-99cc-85f8-355a3d6e4b86', 'e1f65c57-0cb2-fe90-77fe-f824cd002d30', 'fea9669b-8eb0-8c49-0a49-77d63751a6c9', 5, 'Travail remarquable, photos magnifiques et livrées rapidement. Équipe discrète et professionnelle.', true, '2026-10-12T22:20:27.615Z'::timestamptz),
  ('1b267619-c481-2cc4-6ee2-81747884ca50', null, '184d929d-42f8-98e7-0607-f44e11b24b61', 'a2dce619-5ace-c202-f4a2-7f08d12d5f5f', 5, 'Buffet excellent pour notre séminaire, ponctuels et très organisés.', true, '2026-10-05T22:20:27.615Z'::timestamptz),
  ('43a03299-a3c3-fed3-d8ce-7b820f3aca81', null, 'a5c0ab01-d0f2-a47f-86f3-85ef1c2a46a9', 'a2dce619-5ace-c202-f4a2-7f08d12d5f5f', 4, 'Très bon traiteur, seul bémol : un léger retard de livraison des chaises.', true, '2026-09-24T22:20:27.615Z'::timestamptz),
  ('5ed3a3ff-8e5c-2997-9502-b9030e8518e0', null, '184d929d-42f8-98e7-0607-f44e11b24b61', '6c439db8-97cd-935a-41e7-923df1e1a275', 5, 'Une décoration de rêve, nos invités en parlent encore !', true, '2026-10-09T22:20:27.615Z'::timestamptz),
  ('4b6df019-46f4-919a-3f5a-f8c1f0f9c3c5', null, 'e1f65c57-0cb2-fe90-77fe-f824cd002d30', '6c439db8-97cd-935a-41e7-923df1e1a275', 5, 'Écoute et conseils excellents, devis clair et respecté.', true, '2026-10-11T22:20:27.615Z'::timestamptz),
  ('0af45c99-beb7-a9af-c919-2665c4a05cd3', null, '184d929d-42f8-98e7-0607-f44e11b24b61', 'fea9669b-8eb0-8c49-0a49-77d63751a6c9', 4, 'Belles prestations, mais le montage final est arrivé plus tard que promis.', false, '2026-10-13T22:20:27.615Z'::timestamptz)
on conflict (id) do nothing;

commit;
