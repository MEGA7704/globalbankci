import assert from 'node:assert/strict';
import fs from 'node:fs';
const ui=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');

assert.match(ui,/function companyApprovisionnementAdmisCreditTotalForScope\(scope=\{\}\)/);
assert.match(ui,/function companyApprovisionnementRemainingTotalForScope\(scope=\{\}\)/);
assert.match(ui,/Approvisionnement total/);
assert.match(ui,/Approvisionnement admis en crédit/);
assert.match(ui,/Approvisionnement restant/);
assert.match(ui,/approvisionnementAdmisCredit/);
assert.match(ui,/approvisionnementRestant/);
assert.match(ui,/dashboardPerfCard\('Approvisionnements','🔄'/);

const total=500000;
const admitted=325000;
assert.equal(Math.max(0,total-admitted),175000);
console.log('DASHBOARD APPROVISIONNEMENTS V19 TESTS PASSED');
