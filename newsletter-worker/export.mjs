import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const directory = fileURLToPath(new URL('.', import.meta.url));
const output = resolve(directory, 'exports/emails.txt');
const raw = execFileSync(resolve(directory, 'node_modules/.bin/wrangler'), [
  'd1', 'execute', 'newsletter-subscribers', '--remote', '--json',
  '--command', 'SELECT email FROM subscribers ORDER BY created_at, email',
], { cwd: directory, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const result = JSON.parse(raw);
if (result.some(statement => statement.success === false)) throw new Error('Subscriber export failed.');
const emails = result.flatMap(statement => statement.results || []).map(row => row.email);
mkdirSync(resolve(directory, 'exports'), { recursive: true, mode: 0o700 });
writeFileSync(output, emails.length ? emails.join('\n') + '\n' : '', { mode: 0o600 });
console.log(`Exported ${emails.length} email addresses to ${output}`);
