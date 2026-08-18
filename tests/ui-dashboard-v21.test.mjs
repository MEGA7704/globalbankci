import assert from 'node:assert/strict';
import fs from 'node:fs';
const ui=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
for (const label of [
  'Bonjour,', 'Vue consolidée de la performance financière et opérationnelle de votre banque.',
  'Actifs totaux','Croissance mensuelle','Clients actifs','Taux de remboursement','Transactions du jour','Trésorerie disponible',
  'Solde banque','Revenu banque','Situation des crédits','Approvisionnements',
  'Évolution revenus vs charges','Mouvements mensuels','Répartition du portefeuille','Derniers mouvements','Exporter'
]) assert.ok(ui.includes(label), `Élément tableau de bord absent: ${label}`);
assert.match(ui,/dashboardScopeBoundsFromState/);
assert.match(ui,/dashboardExportCsv/);
assert.match(ui,/dashboardLatestMoves/);
assert.match(ui,/Version 1\.21\.0/);
console.log('UI DASHBOARD V21 TESTS PASSED');
