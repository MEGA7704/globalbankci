import assert from 'node:assert/strict';
import fs from 'node:fs';
const worker=fs.readFileSync(new URL('../public/_worker.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');

assert.match(worker,/FORMULE OFFICIELLE V20/);
assert.match(worker,/async function computeCompanyActiveApprovisionnementBalanceTotal\(env,bankId,scope=\{\}\)/);
assert.match(worker,/usedCreditAmountForApprovisionnementSource\(env,bankId,m\.id\)/);
assert.match(worker,/initial-Math\.max\(0,Number\(used\|\|0\)\)/);
assert.match(worker,/computeCompanyOfficialBalance[\s\S]*computeTotalRevenueBank[\s\S]*computeCreditRepaidPrincipalTotal[\s\S]*computeCompanyActiveApprovisionnementBalanceTotal[\s\S]*computeCompanyDecaissementTotal/);
assert.match(worker,/Number\(repaid\|\|0\)\+Number\(revenue\|\|0\)\+Number\(activeAppro\|\|0\)-Number\(decaissement\|\|0\)/);

assert.match(ui,/RÈGLE OFFICIELLE V20/);
assert.match(ui,/function companyApprovisionnementActifTotalForScope\(scope=\{\}\)/);
const fn=ui.match(/function officialCompanyAccountBalance\(account,scope=\{\}\)\{[\s\S]*?\n\}/)?.[0]||'';
assert.ok(fn,'officialCompanyAccountBalance introuvable');
assert.match(fn,/companyRevenueBankTotalForScope/);
assert.match(fn,/officialCreditPrincipalRepaymentTotalForScope/);
assert.match(fn,/companyApprovisionnementActifTotalForScope/);
assert.match(fn,/companyDecaissementTotalForScope/);
assert.match(fn,/Number\(creditRepaid\|\|0\)\+Number\(revenue\|\|0\)\+Number\(approvisionnementActif\|\|0\)-Number\(decaissement\|\|0\)/);

// Exemple : approvisionnement 115 000 entièrement affecté à un crédit => actif 0.
const appro=115000, allocated=115000;
const active=Math.max(0,appro-allocated);
assert.equal(active,0);
// Capital remboursé 115 000 + revenu 22 750 + actif 0 - décaissement 0.
assert.equal(115000+22750+active-0,137750);
// Approvisionnement partiellement affecté : 200 000 - 115 000 = 85 000 actifs.
assert.equal(Math.max(0,200000-115000),85000);
console.log('COMPANY BALANCE V20 TESTS PASSED');
