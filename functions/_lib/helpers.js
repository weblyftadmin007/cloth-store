// Shared helpers for Pages Functions

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

export function msg(error, status = 400) {
  return json({ error }, status);
}

export function parseJSON(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export async function readJSON(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

export async function mapProduct(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    price: row.price,
    category: row.category,
    sizes: parseJSON(row.sizes, []),
    colors: parseJSON(row.colors, []),
    description: row.description || '',
    stock: row.stock,
    images: parseJSON(row.images, []),
    featured: !!row.featured,
    active: !!row.active,
    createdAt: row.created_at,
  };
}