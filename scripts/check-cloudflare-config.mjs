import { access, readFile, readdir } from 'node:fs/promises';

const config = await readFile('wrangler.toml', 'utf8');
const requiredPatterns = [
  /pages_build_output_dir\s*=\s*"public"/,
  /\[vars\][\s\S]*SUPER_ADMIN_SESSION_VERSION\s*=\s*"[1-9][0-9]*"/,
  /binding\s*=\s*"DB"[\s\S]*database_name\s*=\s*"bankdb"[\s\S]*database_id\s*=\s*"692edd7a-98d5-484a-aa75-5a86a9107c16"/,
  /binding\s*=\s*"KV"[\s\S]*id\s*=\s*"f02b47264a8c411aa61052c45a3bb72a"/,
];
for (const pattern of requiredPatterns) {
  if (!pattern.test(config)) throw new Error(`Configuration Cloudflare incomplète : ${pattern}`);
}

// Les valeurs sensibles ne doivent jamais apparaître dans wrangler.toml.
if (/SUPER_ADMIN_(?:LOGIN|PASSWORD)\s*=\s*["']/i.test(config)) {
  throw new Error('Un secret Super Admin ne doit jamais être placé dans wrangler.toml.');
}

// Empêche l'expédition accidentelle de vrais fichiers de secrets, même si
// .gitignore a été omis lors d'un téléversement manuel sur GitHub.
const forbiddenFiles = ['.dev.vars', '.env', '.env.local', '.env.production'];
for (const file of forbiddenFiles) {
  try {
    await access(file);
    throw new Error(`Fichier secret interdit dans le dépôt : ${file}`);
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

// .gitignore est recommandé mais ne bloque plus le build s'il a été omis par
// l'interface web de GitHub. Le contrôle ci-dessus protège quand même le dépôt.
try {
  const ignored = await readFile('.gitignore', 'utf8');
  for (const line of ['.dev.vars', '.dev.vars.*', '.env', '.env.*']) {
    if (!ignored.split(/\r?\n/).includes(line)) {
      throw new Error(`Règle .gitignore manquante : ${line}`);
    }
  }
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
  console.warn('Avertissement : .gitignore absent. Le build continue, mais ajoutez-le au dépôt pour protéger les secrets locaux.');
}

const rootFiles = await readdir('.');
for (const name of rootFiles) {
  if (/^\.dev\.vars\.(?!example$)/.test(name) || /^\.env(?:\.|$)/.test(name)) {
    throw new Error(`Fichier sensible détecté : ${name}`);
  }
}

console.log('Configuration Cloudflare validée : Pages, DB, KV, version de session et secrets côté Worker sont correctement reliés.');
