import { spawnSync } from 'node:child_process';

const projectName = 'global-bank';
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const secrets = ['SUPER_ADMIN_LOGIN', 'SUPER_ADMIN_PASSWORD'];

console.log('Configuration sécurisée des secrets Cloudflare Pages.');
console.log('Les valeurs seront saisies directement dans Wrangler et ne seront écrites dans aucun fichier.');

for (const secret of secrets) {
  console.log(`\nDéfinition de ${secret}…`);
  const result = spawnSync(
    command,
    ['wrangler', 'pages', 'secret', 'put', secret, '--project-name', projectName],
    { stdio: 'inherit' },
  );

  if (result.status !== 0) {
    console.error(`Échec de la configuration de ${secret}.`);
    process.exit(result.status ?? 1);
  }
}

console.log('\nVérification des noms de secrets configurés…');
const list = spawnSync(
  command,
  ['wrangler', 'pages', 'secret', 'list', '--project-name', projectName],
  { stdio: 'inherit' },
);
if (list.status !== 0) process.exit(list.status ?? 1);

console.log('\nSecrets configurés. Leurs valeurs restent chiffrées dans Cloudflare.');
