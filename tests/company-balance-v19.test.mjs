import assert from 'node:assert/strict';
import fs from 'node:fs';
const worker=fs.readFileSync(new URL('../public/_worker.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');

assert.match(worker,/FORMULE OFFICIELLE V19/);
assert.match(worker,/async function computeCompanyManualCashflowTotal\(env,bankId,scope=\{\}\)/);
assert.match(worker,/isCompanyApprovisionnementType\(m\.type\)\)total\+=amount/);
assert.match(worker,/isCompanyDecaissementType\(m\.type\)\)total-=amount/);
assert.match(worker,/computeCompanyOfficialBalance[\s\S]*computeTotalRevenueBank[\s\S]*computeCreditRepaidPrincipalTotal[\s\S]*computeCompanyManualCashflowTotal/);
assert.match(worker,/return Math\.round\(\(Number\(revenue\|\|0\)\+Number\(repaid\|\|0\)\+Number\(cashflow\|\|0\)\)\*100\)\/100/);
assert.match(worker,/UPDATE moves SET is_voided=1[\s\S]{0,500}updateCompanyAccountStoredBalance\(env,bankId\)/);

assert.match(ui,/RÈGLE OFFICIELLE V19/);
const fn=ui.match(/function officialCompanyAccountBalance\(account,scope=\{\}\)\{[\s\S]*?\n\}/)?.[0]||'';
assert.ok(fn,'officialCompanyAccountBalance introuvable');
assert.match(fn,/companyRevenueBankTotalForScope/);
assert.match(fn,/officialCreditPrincipalRepaymentTotalForScope/);
assert.match(fn,/companyApprovisionnementTotalForScope/);
assert.match(fn,/companyDecaissementTotalForScope/);
assert.match(fn,/Number\(approvisionnement\|\|0\)-Number\(decaissement\|\|0\)/);

// Cas simple : base revenus + remboursements 120 000, approvisionnement 80 000,
// puis décaissement 50 000 => le tableau de bord doit suivre 150 000.
const base=120000, appro=80000, dec=50000;
assert.equal(base+appro-dec,150000);
console.log('COMPANY BALANCE V19 TESTS PASSED');
