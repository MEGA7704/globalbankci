import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const ui=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');

assert.match(ui,/function hasAnyPerm\(keys\)\{const list=Array\.isArray\(keys\)\?keys:\[keys\];return list\.filter\(Boolean\)\.some\(key=>hasPerm\(String\(key\)\)\)\}/);
assert.match(ui,/hasAnyPerm\(\['moves\.create\.deposit','moves\.create\.withdrawal','moves\.create\.cashier_fees'\]\)/);
assert.match(ui,/hasAnyPerm\(\['moves\.create\.approvisionnement','credit_payments\.create','credits\.penalties\.apply','moves\.create\.credit_carnet'\]\)/);

const permissions=new Set(['moves.create.deposit','credit_payments.create']);
const hasPerm=key=>permissions.has(key);
const hasAnyPerm=keys=>{const list=Array.isArray(keys)?keys:[keys];return list.filter(Boolean).some(key=>hasPerm(String(key)));};
assert.equal(hasAnyPerm('moves.create.deposit'),true);
assert.equal(hasAnyPerm(['moves.create.withdrawal','moves.create.deposit']),true);
assert.equal(hasAnyPerm(['moves.create.withdrawal','moves.create.cashier_fees']),false);
assert.equal(hasAnyPerm([]),false);
assert.equal(hasAnyPerm(null),false);
console.log('ALL HAS ANY PERM V16 TESTS PASSED');
