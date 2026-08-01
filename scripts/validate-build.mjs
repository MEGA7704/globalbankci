import { readFile, access } from 'node:fs/promises';

const required = ['public/index.html', 'public/_worker.js', 'wrangler.toml', 'migrations/0001_schema.sql', 'migrations/0002_support_messages.sql'];
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

const requiredClientUi = [
  'Liste des clients', '+ Nouveau client', 'Personne physique', 'Personne morale',
  'Informations de l’entreprise', 'Représentant légal de l’entreprise',
  'Informations du client personnel', 'clientOptimizeImage', 'Boîte de réception et d’envois', 'Contacter le support', 'mailboxPage'
];
for (const marker of requiredClientUi) {
  if (!html.includes(marker)) throw new Error(`Formulaire client incomplet : ${marker}`);
}
if (!worker.includes('support_messages') || !worker.includes('/api/super/messages/send') || !worker.includes('/api/messages/send')) {
  throw new Error('Messagerie sécurisée Super Admin / entreprises absente.');
}
if (!worker.includes('normalizeClientPayload') || !worker.includes('CLIENT_IMAGE_MAX_DATAURL_CHARS')) {
  throw new Error('Validation serveur du formulaire client absente.');
}

console.log('Validation réussie : fichiers présents, secrets absents et stockage navigateur sécurisé.');
