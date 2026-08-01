import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const worker = await readFile(new URL('../public/_worker.js', import.meta.url), 'utf8');

for (const role of ['admin_bank','agent_caisse','agent_credit','auditeur']) {
  assert.match(html, new RegExp(`${role}:\\[`), `menu absent pour ${role}`);
  assert.match(worker, new RegExp(`${role}:\\[`), `matrice serveur absente pour ${role}`);
}
assert.match(html, /return role==='super'\?'super_admin':'auditeur'/, 'le rôle inconnu doit échouer en lecture seule');
assert.match(html, /openLimitedClientPopup/, 'formulaire client limité absent');
assert.match(html, /archivedClientsPanel/, 'restauration client absente');
assert.match(html, /archivedAccountsPanel/, 'restauration compte absente');
assert.match(worker, /permissionForRequest/, 'contrôle central de permission absent');
assert.match(worker, /enforceRoleApiAccess/, 'garde API RBAC absente');
assert.match(worker, /operation_requests/, 'demandes de correction absentes');
assert.match(worker, /is_voided/, 'annulation logique des mouvements absente');
const loginStart=html.indexOf('<div id="loginBox"'); const loginEnd=html.indexOf('<div id="registerBox"'); const loginMarkup=html.slice(loginStart,loginEnd);
assert.doesNotMatch(loginMarkup, /<(?:select|input)[^>]+(?:name|id)="[^"]*role/i, 'le rôle ne doit pas être sélectionnable à la connexion');
console.log('ALL UI RBAC V9 TESTS PASSED');
