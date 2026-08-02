import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const worker=readFileSync(new URL('../public/_worker.js',import.meta.url),'utf8');
const ui=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const cashier=['Dépôt','Retrait','Frais dépôt espèce','Frais retrait espèce','Frais de recouvrement','Frais de relevé bancaire','Frais de clôture','Frais de gestion mensuelle','Frais de carnet'];
const credit=['Approvisionnement','Paiement de crédit','Frais de pénalité de retard','Frais de carnet crédit'];
for(const type of cashier){assert.ok(worker.includes(type),`type caisse serveur absent: ${type}`);assert.ok(ui.includes(type),`type caisse interface absent: ${type}`);}
for(const type of credit){assert.ok(worker.includes(type),`type crédit serveur absent: ${type}`);assert.ok(ui.includes(type),`type crédit interface absent: ${type}`);}
assert.match(worker,/actorRole==='agent_caisse'&&!movementTypeInList\(type,CASHIER_MOVEMENT_TYPES\)/);
assert.match(worker,/actorRole==='agent_credit'&&!movementTypeInList\(type,CREDIT_AGENT_MOVEMENT_TYPES\)/);
assert.match(worker,/moves\.create\.cashier_fees/);
assert.match(worker,/moves\.create\.approvisionnement/);
assert.match(worker,/moves\.create\.credit_carnet/);
assert.match(ui,/function creditAgentMovementFormHtml\(\)/);
assert.match(ui,/Nouveau mouvement crédit/);
assert.doesNotMatch(ui,/Frais d’opération autorisés/);
console.log('ALL MOVEMENT PERMISSIONS V15 TESTS PASSED');
