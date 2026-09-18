import { json, msg, readJSON } from '../_lib/helpers.js';
import { createSession, setSessionCookie } from '../_lib/auth.js';

export async function onRequest(context) {
  const { env, request } = context;
  const body = await readJSON(request);

  if (!env.ADMIN_PASSWORD) return msg('Admin password not configured', 500);
  if (!body.password || body.password !== env.ADMIN_PASSWORD) {
    return msg('Invalid credentials', 401);
  }

  const secret = env.AUTH_SECRET || env.ADMIN_PASSWORD;
  const token = await createSession(secret);
  const secure = new URL(request.url).protocol === 'https:';
  return json({ ok: true }, 200, { 'set-cookie': setSessionCookie(token, secure) });
}