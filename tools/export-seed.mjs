// tools/export-seed.mjs — exporte le seed démo vers un SQL idempotent pour Supabase.
// Usage : node tools/export-seed.mjs > supabase/seed.sql
import { createHash } from 'node:crypto';
import { seedState } from '../assets/js/core/seed.js';

// UUID déterministes (stables) dérivés des identifiants du seed.
const uuidFor = id => {
  const h = createHash('md5').update(String(id)).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
const q = s => `'${String(s ?? '').replace(/'/g, "''")}'`;
const ts = iso => `'${iso}'::timestamptz`;
const dateOrNull = iso => (iso ? `'${String(iso).slice(0, 10)}'::date` : 'null');
const tsOrNull = iso => (iso ? ts(iso) : 'null');
const numOrNull = n => (n == null ? 'null' : String(Math.trunc(n)));
const uuidOrNull = id => (id ? q(uuidFor(id)) : 'null');

const state = seedState();
const out = [];
out.push('-- Seed démo Eventis — généré par tools/export-seed.mjs (ne pas éditer à la main).');
out.push('-- Idempotent : relançable sans doublon (on conflict do nothing).');
out.push('');
out.push('begin;');
out.push('');

out.push('insert into public.profiles (id, full_name, phone, role, suspended, created_at) values');
out.push(state.users.map(u =>
  `  (${q(uuidFor(u.id))}, ${q(u.fullName)}, ${q(u.phone ?? '')}, ${q(u.role)}, ${u.suspended ? 'true' : 'false'}, ${ts(u.createdAt)})`).join(',\n'));
out.push('on conflict (id) do nothing;');
out.push('');

out.push('insert into public.categories (id, slug, name, icon, active) values');
out.push(state.categories.map(c =>
  `  (${q(uuidFor(c.id))}, ${q(c.slug)}, ${q(c.name)}, ${q(c.icon)}, ${c.active ? 'true' : 'false'})`).join(',\n'));
out.push('on conflict (slug) do nothing;');
out.push('');

out.push('insert into public.providers (id, profile_id, category_id, business_name, description, city, quarter, phone, whatsapp, price_from, price_to, cover_url, gallery, status, is_verified, created_at) values');
out.push(state.providers.map(p =>
  `  (${q(uuidFor(p.id))}, ${q(uuidFor(p.ownerId))}, ${uuidOrNull(p.categoryId)}, ${q(p.businessName)}, ${q(p.description)}, ${q(p.city)}, ${q(p.quarter)}, ${q(p.phone)}, ${q(p.whatsapp)}, ${numOrNull(p.priceFrom)}, ${numOrNull(p.priceTo)}, ${q(p.coverUrl)}, '[]'::jsonb, ${q(p.status)}, ${p.isVerified ? 'true' : 'false'}, ${ts(p.createdAt)})`).join(',\n'));
out.push('on conflict (id) do nothing;');
out.push('');

out.push('insert into public.services (id, provider_id, label, description, price) values');
out.push(state.services.map(s =>
  `  (${q(uuidFor(s.id))}, ${q(uuidFor(s.providerId))}, ${q(s.label)}, ${q(s.description)}, ${numOrNull(s.price)})`).join(',\n'));
out.push('on conflict (id) do nothing;');
out.push('');

out.push('insert into public.requests (id, client_id, provider_id, event_type, event_date, guests, budget, message, status, created_at, updated_at) values');
out.push(state.requests.map(r =>
  `  (${q(uuidFor(r.id))}, ${q(uuidFor(r.clientId))}, ${q(uuidFor(r.providerId))}, ${q(r.eventType)}, ${dateOrNull(r.eventDate)}, ${numOrNull(r.guests)}, ${numOrNull(r.budget)}, ${q(r.message)}, ${q(r.status)}, ${ts(r.createdAt)}, ${ts(r.updatedAt)})`).join(',\n'));
out.push('on conflict (id) do nothing;');
out.push('');

out.push('insert into public.messages (id, request_id, sender_id, body, read_at, created_at) values');
out.push(state.messages.map(m =>
  `  (${q(uuidFor(m.id))}, ${q(uuidFor(m.requestId))}, ${q(uuidFor(m.senderId))}, ${q(m.body)}, ${tsOrNull(m.readAt)}, ${ts(m.createdAt)})`).join(',\n'));
out.push('on conflict (id) do nothing;');
out.push('');

out.push('insert into public.reviews (id, request_id, client_id, provider_id, rating, comment, visible, created_at) values');
out.push(state.reviews.map(v =>
  `  (${q(uuidFor(v.id))}, ${uuidOrNull(v.requestId)}, ${q(uuidFor(v.clientId))}, ${q(uuidFor(v.providerId))}, ${numOrNull(v.rating)}, ${q(v.comment)}, ${v.visible ? 'true' : 'false'}, ${ts(v.createdAt)})`).join(',\n'));
out.push('on conflict (id) do nothing;');
out.push('');
out.push('commit;');
out.push('');

process.stdout.write(out.join('\n'));
