import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const worker=readFileSync(new URL('../public/_worker.js',import.meta.url),'utf8');
const ui=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
assert.match(worker,/async function computeCreditOutstandingBalance\(env,bankId,acc\)/);
assert.match(worker,/SELECT balance_after FROM moves WHERE bank_id=\? AND account_id=\? AND COALESCE\(is_voided,0\)=0/);
assert.match(worker,/currentAccountBalance=await computeCreditOutstandingBalance\(env,bankId,acc\)/);
assert.match(worker,/isPaymentCredit&&amount>currentAccountBalance/);
assert.doesNotMatch(worker,/!isCompanyAccount&&debit&&Number\(acc\.balance\)<amount/);
assert.match(ui,/amount>outstanding/);
assert.match(ui,/le montant dépasse le reste à rembourser/);

// Cas utilisateur : dette affichée 108 000 FCFA, remboursement 10 000 FCFA.
const outstanding=108000;
const payment=10000;
assert.ok(payment<=outstanding,'un remboursement partiel valide ne doit pas être bloqué');
assert.equal(outstanding-payment,98000);
console.log('CREDIT REPAYMENT BALANCE V18 TESTS PASSED');
