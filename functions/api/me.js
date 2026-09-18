import { json } from '../_lib/helpers.js';
import { getTokenFromRequest, verifySession } from '../_lib/auth.js';

export async function onRequest(context) {
  const { env, request } = context;
  const secret = env.AUTH_SECRET || env.ADMIN_PASSWORD;
  const ok = await verifySession(getTokenFromRequest(request), secret);
  return ok ? json({ ok: true }) : json({ ok: false, error: 'Unauthorized' }, 401);
}