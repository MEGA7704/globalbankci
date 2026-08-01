import { readFile, access } from 'node:fs/promises';

const required = ['public/index.html', 'public/_worker.js', 'wrangler.toml', 'migrations/0001_schema.sql'];
for (const file of required) await access(file);

const worker = await readFile('public/_worker.js', 'utf8');
const forbidden = [
  /const\s+SUPER_(?:LOGIN|PASS)/,
  /SUPER_ADMIN_PASSWORD\s*=\s*['"`]/,
  /access-control-allow-origin['"]?\s*:\s*['"]\*/i
];
for (const rule of forbidden) {
  if (rule.test(worker)) throw new Error(`Échec sécurité : motif interdit détecté (${rule}).`);
}

const html = await readFile('public/index.html', 'utf8');
if (/sessionStorage\.setItem\(['"]bmp_token/i.test(html)) throw new Error('Le jeton de session ne doit pas être stocké dans le navigateur.');
if (/localStorage\.setItem\(['"]bmp_management_settings/i.test(html)) throw new Error('Les données de gestion ne doivent pas être stockées dans localStorage.');

console.log('Validation réussie : fichiers présents, secrets absents et stockage navigateur sécurisé.');
