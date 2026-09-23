const SUCCESS = { ok: true, message: "Thanks! Your signup has been received." };
const MAX_BODY = 2048;
const SECURITY = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

export function normalizeEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(email)) return null;
  const local = email.split('@')[0];
  if (local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return null;
  return email;
}

async function readBody(request) {
  if (Number(request.headers.get('content-length')) > MAX_BODY) throw new Error('too_large');
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) { await reader.cancel(); throw new Error('too_large'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(bytes);
}

async function allowSignup(request, env) {
  const minute = Math.floor(Date.now() / 60000);
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${minute}:${ip}`));
  const key = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  // Fixed one-minute windows, enforced atomically across Worker instances.
  const results = await env.DB.batch([
    env.DB.prepare('DELETE FROM signup_limits WHERE expires_at <= ?').bind(minute),
    env.DB.prepare(`INSERT INTO signup_limits (key, attempts, expires_at) VALUES (?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET attempts = MIN(signup_limits.attempts + 1, 11)
      RETURNING attempts`).bind(key, minute + 1),
  ]);
  return results[1].results[0].attempts <= 10;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).includes(origin);
    const headers = { ...SECURITY, 'Vary': 'Origin', ...(allowed ? { 'Access-Control-Allow-Origin': origin } : {}) };
    const json = (body, status = 200, extra = {}) => Response.json(body, { status, headers: { ...headers, ...extra } });
    try {
      if (url.pathname === '/health' && request.method === 'GET') {
        await env.DB.prepare('SELECT 1 FROM subscribers LIMIT 1').all();
        return json({ ok: true });
      }
      if (url.pathname !== '/subscribe') return json({ error: 'Not found.' }, 404);
      if (!allowed) return json({ error: 'This origin is not allowed.' }, 403);
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' } });
      if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, { Allow: 'POST, OPTIONS' });
      if (!await allowSignup(request, env)) return json({ error: 'Too many attempts. Please try again in a minute.' }, 429, { 'Retry-After': '60' });
      if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) return json({ error: 'Expected JSON.' }, 415);
      let data;
      try { data = JSON.parse(await readBody(request)); }
      catch (error) { return json({ error: error.message === 'too_large' ? 'Request too large.' : 'Invalid request.' }, error.message === 'too_large' ? 413 : 400); }
      if (!data || typeof data !== 'object' || Array.isArray(data)) return json({ error: 'Invalid request.' }, 400);
      if (data.website) return json(SUCCESS); // Honeypot: quietly discard bot submissions.
      const email = normalizeEmail(data.email);
      if (!email) return json({ error: 'Please enter a valid email address.' }, 400);
      if (data.consent !== true) return json({ error: 'Please agree to receive newsletter emails.' }, 400);
      const source = typeof data.source === 'string' && /^\/[a-zA-Z0-9/_.-]{0,199}$/.test(data.source) ? data.source : '/';
      const now = new Date().toISOString();
      // Normalize and deduplicate without revealing whether an email is already stored.
      await env.DB.prepare(`INSERT INTO subscribers (id, email, created_at, consent_at, consent_version, source)
        VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(email) DO NOTHING`).bind(crypto.randomUUID(), email, now, now, 'food-recs-v1', source).run();
      return json(SUCCESS);
    } catch (error) {
      console.error('Newsletter request failed', error.name); // Never log emails, bodies, or tokens.
      return json({ error: 'Signups are temporarily unavailable. Please try again later.' }, 503);
    }
  },
};
