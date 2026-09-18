import { json, msg, readJSON } from '../_lib/helpers.js';
import { createRazorpayOrder } from '../_lib/razorpay.js';

// Creates a Razorpay order for the cart.
// Prices are recomputed server-side from the database (client prices are ignored).
export async function onRequest(context) {
  const { env, request } = context;

  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    return msg('Payments are not configured yet', 500);
  }

  const body = await readJSON(request);
  const items = Array.isArray(body.items) ? body.items : [];
  const customer = body.customer && typeof body.customer === 'object' ? body.customer : {};

  if (!items.length) return msg('Your cart is empty');
  if (!customer.name || !customer.phone) return msg('Name and phone are required for checkout');

  let total = 0;
  const orderItems = [];

  for (const it of items) {
    const slug = String((it && it.slug) || '');
    if (!slug) continue;
    const qty = Math.max(1, parseInt(it.qty, 10) || 1);

    const row = await env.DB.prepare(
      'SELECT id, name, slug, price, stock FROM products WHERE slug = ? AND active = 1 LIMIT 1',
    ).bind(slug).first();

    if (!row) return msg(`Product not found: ${slug}`, 400);
    if (row.stock < qty) return msg(`Only ${row.stock} left in stock: ${row.name}`, 400);

    total += row.price * qty;
    orderItems.push({
      productId: row.id,
      slug: row.slug,
      name: row.name,
      size: String((it && it.size) || '').trim(),
      color: String((it && it.color) || '').trim(),
      qty,
      price: row.price,
    });
  }

  if (!orderItems.length) return msg('No valid items in your cart', 400);

  const orderId = 'ORD-' + Date.now() + '-' + Math.floor(100 + Math.random() * 900);

  const rp = await createRazorpayOrder(env, {
    amount: total,
    currency: 'INR',
    receipt: orderId,
    notes: { orderId, customerName: customer.name },
  });

  if (!rp.ok) {
    const desc = (rp.data && (rp.data.description || rp.data.error && rp.data.error.description)) || 'Payment service unavailable';
    return msg(String(desc), 502);
  }

  // Save a pending order keyed by the Razorpay order id
  await env.DB.prepare(
    `INSERT INTO orders (order_id, items, customer, amount, currency, status, razorpay_order_id, created_at)
     VALUES (?, ?, ?, ?, 'INR', 'created', ?, datetime('now'))`,
  )
    .bind(orderId, JSON.stringify(orderItems), JSON.stringify(customer), total, rp.data.id)
    .run();

  return json({
    ok: true,
    keyId: env.RAZORPAY_KEY_ID,
    razorpayOrderId: rp.data.id,
    orderId,
    amount: total,
  });
}