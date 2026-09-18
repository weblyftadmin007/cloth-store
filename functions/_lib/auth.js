// Password login with signed HMAC session cookie (admin panel)
const enc = new TextEncoder();

function b64url(str) {
  let out = btoa(str);
  return out.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  return atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
}

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return b64url(String.fromCharCode(...new Uint8Array(sig)));
}

// token = base64url(payload).signature
export async function createSession(secret) {
  const rand = new Uint8Array(16);
  crypto.getRandomValues(rand);
  const nonce = [...rand].map((b) => b.toString(16).padStart(2, '0')).join('');
  const payload = b64url(JSON.stringify({ nonce, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }));
  const sig = await hmac(secret, payload);
  return `${payload}.${sig}`;
}

export async function verifySession(token, secret) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [payload, sig] = token.split('.');
  const expected = await hmac(secret, payload);
  if (expected !== sig) return false;
  try {
    const data = JSON.parse(fromB64url(payload));
    if (!data.exp || data.exp < Date.now()) return false;
  } catch {
    return false;
  }
  return true;
}

export function getTokenFromRequest(request) {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(/(?:^|;\s*)admin_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// Path=/ (not /admin) so the cookie is also sent to /api/admin/* routes.
export function setSessionCookie(token, secure) {
  return (
    `admin_session=${encodeURIComponent(token)}; Path=/; HttpOnly; ` +
    `SameSite=Lax; Max-Age=${7 * 24 * 60 * 60};${secure ? ' Secure;' : ''}`
  );
}

export function clearSessionCookie() {
  return 'admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0;';
}