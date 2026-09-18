import { json } from '../_lib/helpers.js';
import { clearSessionCookie } from '../_lib/auth.js';

export async function onRequest() {
  return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie() });
}