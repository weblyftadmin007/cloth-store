import { json } from '../_lib/helpers.js';

// Public storefront settings (brand, announcement, hero, etc.)
// Falls back to sensible defaults if the settings table is empty.
const DEFAULTS = {
  brand: 'Your Brand',
  announcement: '',
  currency: 'INR',
  heroTitle: 'Quietly exceptional essentials',
  heroSub: 'Considered wardrobe staples, crafted from natural fibres and made to be lived in.',
  heroImage: '/assets/hero.svg',
  supportPhone: '',
  footerText: '',
};

export async function onRequest(context) {
  const { env } = context;
  const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
  const config = { ...DEFAULTS };
  for (const r of results) {
    if (r.value !== '') config[r.key] = r.value;
  }
  return json(config);
}