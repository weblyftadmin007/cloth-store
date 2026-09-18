import { getTokenFromRequest, verifySession } from '../../_lib/auth.js';
import { json, msg, readJSON, parseJSON, slugify, mapProduct } from '../../_lib/helpers.js';

// Single entry point for every /api/admin/* route. All requests are
// auth-gated via the signed admin_session cookie.
//
// Routes:
//   GET/POST      /api/admin/products
//   PUT/DELETE    /api/admin/products/:id
//   GET/PUT       /api/admin/orders/:id
//   GET           /api/admin/orders
//   GET/PUT       /api/admin/settings
//   POST          /api/admin/upload   (multipart file -> R2)
export async function onRequest(context) {
  const { env, request, params } = context;
  const parts = (params.path && params.path.length ? params.path : ['index']).map((p) =>
    p.toLowerCase(),
  );
  const resource = parts[0] || 'index';
  const id = parts[1];

  const secret = env.AUTH_SECRET || env.ADMIN_PASSWORD;
  const isAuthed = await verifySession(getTokenFromRequest(request), secret);
  if (!isAuthed) return msg('Unauthorized', 401);

  const method = request.method;
  const r2 = env.R2;

  // ---------------- Products ----------------
  if (resource === 'products') {
    if (method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM products ORDER BY id DESC').all();
      return json({ products: await Promise.all(results.map(mapProduct)) });
    }

    if (method === 'POST') {
      const b = await readJSON(request);
      if (!b.name || !b.price) return msg('Name and price are required');
      if (Number.isNaN(Number(b.price)) || Number(b.price) < 0) return msg('Invalid price');

      const slug = b.slug ? slugify(b.slug) : slugify(b.name);
      const existing = await env.DB.prepare('SELECT id FROM products WHERE slug = ?').bind(slug).first();
      if (existing) return msg(`A product with this name already exists: ${slug}`);

      const price = Math.round(Number(b.price) * 100);
      const info = await env.DB.prepare(
        `INSERT INTO products (name, slug, price, category, sizes, colors, description, stock, images, featured, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`,
      )
        .bind(
          b.name,
          slug,
          price,
          b.category || 'Tees',
          JSON.stringify(Array.isArray(b.sizes) ? b.sizes : []),
          JSON.stringify(Array.isArray(b.colors) ? b.colors : []),
          b.description || '',
          Math.max(0, parseInt(b.stock, 10) || 0),
          JSON.stringify(Array.isArray(b.images) ? b.images : []),
          b.featured ? 1 : 0,
        )
        .run();

      const row = await env.DB.prepare('SELECT * FROM products WHERE id = ?')
        .bind(info.meta.last_row_id).first();
      return json({ product: await mapProduct(row) }, 201);
    }

    if (method === 'PUT' && id) {
      const row = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
      if (!row) return msg('Product not found', 404);

      const b = await readJSON(request);
      const price = b.price !== undefined && b.price !== ''
        ? Math.round(Number(b.price) * 100)
        : row.price;
      if (Number.isNaN(price) || price < 0) return msg('Invalid price');

      await env.DB.prepare(
        `UPDATE products SET
           name = ?, slug = ?, price = ?, category = ?, sizes = ?, colors = ?,
           description = ?, stock = ?, images = ?, featured = ?, active = ?
         WHERE id = ?`,
      )
        .bind(
          b.name || row.name,
          b.slug ? slugify(b.slug) : row.slug,
          price,
          b.category || row.category,
          JSON.stringify(Array.isArray(b.sizes) ? b.sizes : parseJSON(row.sizes, [])),
          JSON.stringify(Array.isArray(b.colors) ? b.colors : parseJSON(row.colors, [])),
          b.description !== undefined ? b.description : row.description,
          Math.max(0, parseInt(b.stock, 10) || 0),
          JSON.stringify(Array.isArray(b.images) ? b.images : parseJSON(row.images, [])),
          b.featured ? 1 : 0,
          b.active === false ? 0 : 1,
          id,
        )
        .run();

      const updated = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
      return json({ product: await mapProduct(updated) });
    }

    if (method === 'DELETE' && id) {
      await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
      return json({ ok: true });
    }

    return msg('Method not allowed', 405);
  }

  // ---------------- Orders ----------------
  if (resource === 'orders') {
    if (method === 'GET') {
      const { results } = await env.DB.prepare(
        'SELECT * FROM orders ORDER BY id DESC LIMIT 300',
      ).all();
      return json({
        orders: results.map((r) => ({
          id: r.id,
          orderId: r.order_id,
          items: parseJSON(r.items, []),
          customer: parseJSON(r.customer, {}),
          amount: r.amount,
          currency: r.currency,
          status: r.status,
          razorpayOrderId: r.razorpay_order_id,
          razorpayPaymentId: r.razorpay_payment_id,
          createdAt: r.created_at,
        })),
      });
    }

    if (method === 'PUT' && id) {
      const b = await readJSON(request);
      const valid = ['created', 'paid', 'shipped', 'delivered', 'cancelled'];
      if (!valid.includes(b.status)) return msg('Invalid status');
      await env.DB.prepare('UPDATE orders SET status = ? WHERE id = ?').bind(b.status, id).run();
      return json({ ok: true });
    }

    return msg('Method not allowed', 405);
  }

  // ---------------- Settings ----------------
  if (resource === 'settings') {
    if (method === 'GET') {
      const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
      const settings = {};
      for (const r of results) settings[r.key] = r.value;
      return json({ settings });
    }

    if (method === 'PUT') {
      const b = await readJSON(request);
      const allowed = [
        'brand',
        'announcement',
        'currency',
        'heroTitle',
        'heroSub',
        'heroImage',
        'supportPhone',
        'footerText',
      ];
      for (const key of allowed) {
        if (b[key] === undefined || b[key] === null) continue;
        await env.DB.prepare(
          `INSERT INTO settings (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        ).bind(key, String(b[key])).run();
      }
      return json({ ok: true });
    }

    return msg('Method not allowed', 405);
  }

  // ---------------- Upload (product images -> R2) ----------------
  if (resource === 'upload' && method === 'POST') {
    if (!r2) return msg('R2 is not configured', 500);

    const form = await request.formData().catch(() => null);
    if (!form) return msg('Invalid form data');
    const file = form.get('file');
    if (!file || typeof file === 'string') return msg('No file uploaded');

    const buf = new Uint8Array(await file.arrayBuffer());
    const MAX = 5 * 1024 * 1024;
    if (buf.byteLength > MAX) return msg('File too large (max 5MB)');

    const safeName = (file.name || 'image').replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const key = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
    await r2.put(key, buf, { httpMetadata: { contentType: file.type || 'application/octet-stream' } });

    return json({ ok: true, url: '/media/' + key });
  }

  return msg('Not found', 404);
}