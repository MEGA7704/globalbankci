import fs from 'node:fs';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../public/_worker.js',import.meta.url),'utf8');

assert.match(html,/GLOBAL BANK V14 — POPUPS MOUVEMENTS CAISSE ET ESPACE CRÉDIT AGENT/);
assert.match(html,/function openCashierMovementModal\(/);
assert.match(html,/Historique de mes opérations/);
assert.match(html,/\+ Nouveau mouvement/);
assert.match(html,/showProModal\('Nouveau mouvement'/);
assert.match(html,/cashierMovementFormHtml/);
assert.match(html,/cashierAllowedMovementTypes/);
assert.match(html,/moves\.create\.deposit/);
assert.match(html,/moves\.create\.withdrawal/);

assert.match(html,/Historique des paiements crédit/);
assert.match(html,/function openCreditAgentListPage\(/);
assert.match(html,/function creditAgentListPageHtml\(/);
assert.match(html,/Liste des crédits/);
assert.match(html,/function openCreditAgentCreateModal\(/);
assert.match(html,/Nouveau compte crédit/);
assert.match(html,/Paiement crédit/);
assert.match(html,/Consultation détaillée autorisée/);
assert.match(html,/aucune modification du compte crédit n’est possible/);
assert.match(html,/RAPPORT COMPLET DU CRÉDIT/);
assert.match(html,/Informations complètes du souscripteur/);
assert.match(html,/Conditions et références du crédit/);
assert.match(html,/window\.creditDetailReturnList/);
assert.match(html,/Retour à la liste des crédits/);
assert.doesNotMatch(html,/creditAgentPage\(\)[\s\S]{0,12000}<h2>Nouveau compte crédit<\/h2>/, 'Le formulaire crédit ne doit plus être intégré à la page principale.');
assert.doesNotMatch(html,/cashierPage\(\)[\s\S]{0,5000}<select id="movAcc">/, 'Le formulaire caisse ne doit plus être intégré à la page principale.');

assert.match(worker,/agent_caisse:\['clients\.read','accounts\.read','moves\.create\.deposit','moves\.create\.withdrawal'/);
assert.match(worker,/agent_credit:\['clients\.read','credit_accounts\.read','credit_accounts\.create'/);
assert.match(worker,/return isCreditAccountType\(b\.type\)\?'credit_accounts\.create':'accounts\.create'/);
assert.match(worker,/return movePermissionForType\(b\.type\)/);
console.log('ALL UI AGENT WORKFLOWS V14 TESTS PASSED');
