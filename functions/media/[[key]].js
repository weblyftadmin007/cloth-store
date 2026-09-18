// Serves uploaded product images from R2 storage.
// Covers routes like /media/products/<file>.png
export async function onRequest(context) {
  const { env, params } = context;
  const key = params.key && params.key.length ? params.key.join('/') : '';
  if (!key) return new Response('Not found', { status: 404 });

  if (!env.R2) return new Response('Storage not configured', { status: 500 });

  const obj = await env.R2.get(key);
  if (!obj) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('cache-control', 'public, max-age=86400');
  headers.set('access-control-allow-origin', '*');

  return new Response(obj.body, { headers });
}