import { access, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const config = await readFile('wrangler.toml', 'utf8');
const requiredPatterns = [
  /\[vars\][\s\S]*SUPER_ADMIN_SESSION_VERSION\s*=\s*"1"/,
  /\[secrets\][\s\S]*required\s*=\s*\[[^\]]*"SUPER_ADMIN_LOGIN"[^\]]*"SUPER_ADMIN_PASSWORD"[^\]]*\]/,
  /binding\s*=\s*"DB"[\s\S]*database_name\s*=\s*"bankdb"[\s\S]*database_id\s*=\s*"692edd7a-98d5-484a-aa75-5a86a9107c16"/,
  /binding\s*=\s*"KV"[\s\S]*id\s*=\s*"f02b47264a8c411aa61052c45a3bb72a"/,
];
for (const pattern of requiredPatterns) {
  if (!pattern.test(config)) throw new Error(`Configuration Cloudflare incomplète : ${pattern}`);
}

if (/SUPER_ADMIN_(?:LOGIN|PASSWORD)\s*=\s*"(?!\s*$)/.test(config)) {
  throw new Error('Un secret Super Admin ne doit jamais être placé dans wrangler.toml.');
}

const forbiddenFiles = ['.dev.vars', '.env', '.env.local', '.env.production'];
for (const file of forbiddenFiles) {
  try {
    await access(file);
    throw new Error(`Fichier secret interdit dans l’archive : ${file}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

const worker = await readFile('public/_worker.js', 'utf8');
for (const key of ['SUPER_ADMIN_LOGIN', 'SUPER_ADMIN_PASSWORD', 'SUPER_ADMIN_SESSION_VERSION']) {
  if (!worker.includes(`env.${key}`)) throw new Error(`${key} n’est pas relié à l’environnement du Worker.`);
}
if (/authorization|Bearer\s/i.test(worker)) {
  throw new Error('Les sessions doivent être lues uniquement depuis le cookie HttpOnly.');
}

const ignored = await readFile('.gitignore', 'utf8');
for (const line of ['.dev.vars', '.dev.vars.*', '.env', '.env.*']) {
  if (!ignored.split(/\r?\n/).includes(line)) throw new Error(`Règle .gitignore manquante : ${line}`);
}

const rootFiles = await readdir('.');
for (const name of rootFiles) {
  if (/^\.dev\.vars\.(?!example$)/.test(name) || /^\.env(?:\.|$)/.test(name)) {
    throw new Error(`Fichier sensible détecté : ${name}`);
  }
}

console.log('Configuration Cloudflare validée : DB, KV, variable de session et secrets requis sont correctement reliés.');
