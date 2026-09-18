import { json, msg, readJSON, parseJSON } from '../_lib/helpers.js';
import { verifySignature } from '../_lib/razorpay.js';

// Called after Razorpay's client-side checkout succeeds.
// Verifies the payment signature, saves the order and decrements stock.
export async function onRequest(context) {
  const { env, request } = context;
  const body = await readJSON(request);
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = body;

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return msg('Missing payment details', 400);
  }

  const valid = await verifySignature(
    env.RAZORPAY_KEY_SECRET,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  );
  if (!valid) return msg('Invalid payment signature', 400);

  const order = await env.DB.prepare(
    'SELECT * FROM orders WHERE razorpay_order_id = ? LIMIT 1',
  ).bind(razorpayOrderId).first();
  if (!order) return msg('Order not found', 404);

  if (order.status !== 'paid') {
    const items = parseJSON(order.items, []);
    for (const item of items) {
      await env.DB.prepare(
        'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?',
      ).bind(item.qty, item.productId, item.qty).run();
    }
    await env.DB.prepare(
      `UPDATE orders SET status = 'paid', razorpay_payment_id = ?, razorpay_signature = ? WHERE id = ?`,
    ).bind(razorpayPaymentId, razorpaySignature, order.id).run();
  }

  return json({ ok: true, orderId: order.order_id });
}