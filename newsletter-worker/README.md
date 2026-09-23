# Food recommendations signup

The static `/newsletter/` page submits JSON to `https://palash-newsletter.tanejapalash.workers.dev/subscribe`. The Cloudflare Worker stores unique email addresses in the private D1 database `newsletter-subscribers`. Email delivery is manual through Gmail; there are no email sending, confirmation, or unsubscribe endpoints.

## Read and export subscribers

In Cloudflare: Storage & databases → D1 SQLite Database → newsletter-subscribers → Console:

```sql
SELECT email, created_at, source FROM subscribers ORDER BY created_at;
```

Use Explore Data to browse the table. No public endpoint exposes the list.

For a local text export after authenticating Wrangler:

```sh
cd newsletter-worker
npm ci
npx wrangler login
npm run export
```

This writes `exports/emails.txt` with one address per line. Exports are gitignored and excluded from the Pages deployment. Use Bcc when emailing the list from Gmail so recipients do not see each other's addresses.

## Data and protections

- Stores email, signup time, consent time/version, and the page path. Clicking Subscribe beneath the food-recommendations invitation records `food-recs-v1` consent. This is single opt-in; mailbox ownership is not verified.
- Trims/lowercases addresses without removing Gmail dots or plus tags. A unique index makes duplicate requests idempotent.
- Uses prepared statements, a 2 KiB request limit, origin allowlist, honeypot, and a D1-backed limit of 10 attempts per IP per fixed minute. IP addresses are not stored in subscriber records. Rate-limit keys are SHA-256 hashes of IP plus the minute; expired counters are pruned on the next signup request.
- The origin allowlist is a browser control, not authentication. Distributed bots can still submit; add Turnstile if abuse becomes an issue.
- Returns the same response for new and duplicate addresses. The client reflects only the submitted address using `textContent`.
- `autocomplete="email"`, `type="email"`, `inputmode="email"`, and disabled autocapitalization/autocorrection provide browser/iOS autofill and keyboard hints. Suggestions depend on the device's saved data and settings.

## Development

Requires Node 22.13+ (tests use built-in SQLite).

```sh
cd newsletter-worker
npm ci
npx wrangler d1 migrations apply newsletter-subscribers-preview --local --env preview
npm run dev -- --env preview
```

In a second terminal, serve the repo using `python3 -m http.server 8080`. Open `http://localhost:8080/newsletter/`. Localhost pages automatically use the local Worker on port 8787; production uses the deployed Worker. Local tests never write to the production database.

```sh
npm test
```

Tests cover persistent writes with the actual SQLite schema, duplicates, consent, validation, body limits, honeypot, CORS, rate limiting, and database errors. Browser testing covers the rendered form and its success state.

## Deployment

The Worker and D1 are deployed separately from GitHub Pages. The dashboard configuration must include a D1 binding named `DB` pointing at `newsletter-subscribers`, and a text variable `ALLOWED_ORIGINS` matching `wrangler.jsonc`.

For subsequent CLI deployments:

```sh
npm run db:remote
npm run deploy
```

The idempotent migrations can also be pasted into the D1 Console for dashboard-only deployment. The Pages workflow publishes only `index.html`, `blog/`, `newsletter/`, `public/`, and optional `CNAME`; it does not upload the Worker, local database, or subscriber exports.
