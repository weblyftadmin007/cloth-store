import { json, mapProduct } from '../_lib/helpers.js';

export async function onRequest(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const q = (url.searchParams.get('q') || '').trim().toLowerCase();
  const slug = url.searchParams.get('slug');
  const featured = url.searchParams.get('featured') === '1';

  // Single product lookup by slug
  if (slug) {
    const row = await env.DB.prepare(
      'SELECT * FROM products WHERE slug = ? AND active = 1 LIMIT 1',
    ).bind(slug).first();
    return json(row ? await mapProduct(row) : null);
  }

  let query = 'SELECT * FROM products WHERE active = 1';
  const params = [];
  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  if (q) {
    query += ' AND (LOWER(name) LIKE ? OR LOWER(description) LIKE ? OR LOWER(category) LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  if (featured) query += ' AND featured = 1';
  query += ' ORDER BY featured DESC, created_at DESC, id DESC';

  const { results } = await env.DB.prepare(query).bind(...params).all();
  const cats = await env.DB.prepare(
    'SELECT DISTINCT category FROM products WHERE active = 1 ORDER BY category',
  ).all();

  return json({
    products: await Promise.all(results.map(mapProduct)),
    categories: cats.results.map((r) => r.category),
  });
}