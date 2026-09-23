import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../worker.js';

function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/0001_subscribers.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../migrations/0002_signup_limits.sql', import.meta.url), 'utf8'));
  const env = {
    ALLOWED_ORIGINS: 'https://palashtaneja.com',
    DB: { async batch(statements) { return statements.map(s => ({ results: s.execute() })); }, prepare(sql) {
      const stmt = db.prepare(sql);
      return { all: async () => ({ results: stmt.all() }), bind(...values) {
        return { execute: () => stmt.all(...values), run: async () => ({ meta: stmt.run(...values) }) };
      } };
    } },
  };
  const send = (body, headers = {}, method = 'POST') => worker.fetch(new Request('https://worker.example/subscribe', {
    method, headers: { Origin: 'https://palashtaneja.com', 'Content-Type': 'application/json', 'CF-Connecting-IP': crypto.randomUUID(), ...headers },
    ...(method === 'POST' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
  }), env);
  return { db, env, send };
}

test('persists consent and source; concurrent duplicates preserve original signup', async () => {
  const { db, send } = setup();
  const body = { email: ' Reader+blog@Example.com ', consent: true, source: '/blog/' };
  const responses = await Promise.all([send(body), send({ ...body, email: 'reader+blog@example.com' })]);
  assert.deepEqual(await responses[0].json(), await responses[1].json());
  const rows = db.prepare('SELECT * FROM subscribers').all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].email, 'reader+blog@example.com');
  assert.equal(rows[0].source, '/blog/');
  assert.equal(rows[0].consent_version, 'food-recs-v1');
  assert.ok(Date.parse(rows[0].consent_at));
  db.close();
});

test('invalid, malformed, oversized, and non-consenting requests cannot write', async () => {
  const { db, send } = setup();
  for (const email of ['bad', 'x@bad', 'x@bad..com', '.x@example.com', 'x..y@example.com', 'x\r\n@example.com', 'a'.repeat(65) + '@example.com', null]) {
    assert.equal((await send({ email, consent: true })).status, 400);
  }
  assert.equal((await send({ email: 'a@example.com', consent: false })).status, 400);
  assert.equal((await send('{')).status, 400);
  assert.equal((await send('null')).status, 400);
  assert.equal((await send('x'.repeat(2049))).status, 413);
  assert.equal((await send({}, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM subscribers').get().n, 0);
  db.close();
});

test('honeypot silently discards signup', async () => {
  const { db, send } = setup();
  assert.equal((await send({ email: 'bot@example.com', consent: true, website: 'filled' })).status, 200);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM subscribers').get().n, 0);
  db.close();
});

test('CORS restricts origins; preflight works; no public list route', async () => {
  const { db, env, send } = setup();
  const rejected = await send({}, { Origin: 'https://evil.example' });
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers.get('Access-Control-Allow-Origin'), null);
  const preflight = await send(null, {}, 'OPTIONS');
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), 'https://palashtaneja.com');
  assert.equal((await send(null, {}, 'GET')).status, 405);
  assert.equal((await worker.fetch(new Request('https://worker.example/subscribers'), env)).status, 404);
  db.close();
});

test('rate limiting returns retry guidance without saving the email', async () => {
  const { db, env, send } = setup();
  for (let i = 0; i < 10; i++) await send({ website: 'bot' }, { 'CF-Connecting-IP': '192.0.2.1' });
  const response = await send({ email: 'reader@example.com', consent: true }, { 'CF-Connecting-IP': '192.0.2.1' });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Retry-After'), '60');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM subscribers').get().n, 0);
  db.close();
});

test('database failure is not reported as a successful signup', async () => {
  const { db, env, send } = setup();
  env.DB.prepare = () => { throw new Error('private details'); };
  const response = await send({ email: 'reader@example.com', consent: true });
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes('private details'));
  db.close();
});
