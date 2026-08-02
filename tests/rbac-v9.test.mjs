import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import worker from '../public/_worker.js';

class BoundStatement {
  constructor(db, sql, params=[]) { this.db=db; this.sql=sql; this.params=params; }
  bind(...params){ return new BoundStatement(this.db,this.sql,params); }
  first(){ return this.db.sqlite.prepare(this.sql).get(...this.params) ?? null; }
  all(){ return {results:this.db.sqlite.prepare(this.sql).all(...this.params)}; }
  run(){ const r=this.db.sqlite.prepare(this.sql).run(...this.params); return {success:true,meta:{changes:Number(r.changes||0)}}; }
}
class D1Mock {
  constructor(){this.sqlite=new DatabaseSync(':memory:');}
  exec(sql){this.sqlite.exec(sql);return {count:0};}
  prepare(sql){return new BoundStatement(this,sql);}
  batch(stmts){this.sqlite.exec('BEGIN');try{const out=stmts.map(s=>s.run());this.sqlite.exec('COMMIT');return out;}catch(e){this.sqlite.exec('ROLLBACK');throw e;}}
}
class KVMock {constructor(){this.map=new Map();}async put(k,v,o={}){this.map.set(k,{v:String(v),e:o.expirationTtl?Date.now()+o.expirationTtl*1000:Infinity});}async get(k){const x=this.map.get(k);if(!x)return null;if(x.e<Date.now()){this.map.delete(k);return null;}return x.v;}async delete(k){this.map.delete(k);}}
const env={DB:new D1Mock(),KV:new KVMock(),SUPER_ADMIN_LOGIN:'super@example.invalid',SUPER_ADMIN_PASSWORD:'SuperTest9!',SUPER_ADMIN_SESSION_VERSION:'1',ASSETS:{fetch:async()=>new Response('asset')}};
async function call(path,{method='GET',body,cookie}={}){const h={origin:'https://example.pages.dev'};if(body!==undefined)h['content-type']='application/json';if(cookie)h.cookie=cookie;const res=await worker.fetch(new Request('https://example.pages.dev'+path,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body)}),env,{});const text=await res.text();let json;try{json=JSON.parse(text)}catch{json=null}return {status:res.status,json,text,cookie:res.headers.get('set-cookie')?.split(';')[0]||''};}

const bankLogin='rbac-bank@example.invalid', bankPass='BankSecure9!';
let r=await call('/api/register',{method:'POST',body:{name:'RBAC BANK',manager:'Admin RBAC',contact:'0101010101',address:'Diabo',login:bankLogin,pass:bankPass}});assert.equal(r.status,200,r.text);
r=await call('/api/login',{method:'POST',body:{login:bankLogin,pass:bankPass}});assert.equal(r.status,200,r.text);const adminCookie=r.cookie;const bankId=r.json.bankId;

// Base client and ordinary account.
r=await call('/api/client',{method:'POST',cookie:adminCookie,body:{name:'Client RBAC',contact:'0700000000',piece:'RBAC-CNI'}});assert.equal(r.status,200,r.text);
const client=env.DB.prepare('SELECT id FROM clients WHERE bank_id=? AND piece=?').bind(bankId,'RBAC-CNI').first();
r=await call('/api/account',{method:'POST',cookie:adminCookie,body:{clientId:client.id,type:'Compte courant',deposit:50000}});assert.equal(r.status,200,r.text);
const ordinary=env.DB.prepare("SELECT id FROM accounts WHERE bank_id=? AND client_id=? AND type='Compte courant'").bind(bankId,client.id).first();

// Cashier defaults: deposit/withdraw allowed, credit/settings/users denied.
const cashierLogin='cashier@example.invalid',cashierPass='Cashier9!';
r=await call('/api/user',{method:'POST',cookie:adminCookie,body:{name:'Caisse Test',login:cashierLogin,pass:cashierPass,role:'Agent caisse',permissions:{allow:[],deny:[]}}});assert.equal(r.status,200,r.text);
r=await call('/api/login',{method:'POST',body:{login:cashierLogin,pass:cashierPass}});assert.equal(r.status,200,r.text);let cashierCookie=r.cookie;
r=await call('/api/load',{cookie:cashierCookie});assert.equal(r.status,200,r.text);assert.equal(r.json.user.role_key,'agent_caisse');assert.ok(r.json.user.permissions.includes('moves.create.deposit'));assert.equal(r.json.users,undefined);
r=await call('/api/move',{method:'POST',cookie:cashierCookie,body:{accountId:ordinary.id,type:'Dépôt',amount:1000,role:'admin_bank',bank_id:'OTHER'}});assert.equal(r.status,200,r.text);
r=await call('/api/move',{method:'POST',cookie:cashierCookie,body:{accountId:ordinary.id,type:'Retrait',amount:500}});assert.equal(r.status,200,r.text);
r=await call('/api/account',{method:'POST',cookie:cashierCookie,body:{clientId:client.id,type:'Compte crédit',creditAmount:1000,creditDuration:2}});assert.equal(r.status,403);
r=await call('/api/settings/account-type',{method:'POST',cookie:cashierCookie,body:{name:'Interdit'}});assert.equal(r.status,403);
r=await call('/api/user',{method:'POST',cookie:cashierCookie,body:{name:'Pirate',login:'pirate@example.invalid',pass:'PirateTest9!',role:'Agent caisse'}});assert.equal(r.status,403);
const cashierMove=env.DB.prepare("SELECT id FROM moves WHERE bank_id=? AND created_by<>'' ORDER BY created_at DESC LIMIT 1").bind(bankId).first();
r=await call('/api/correction-requests',{method:'POST',cookie:cashierCookie,body:{movement_id:cashierMove.id,request_type:'correction',reason:'Montant à vérifier avec le reçu.'}});assert.equal(r.status,200,r.text);

// Browser-supplied incompatible extra permissions are filtered; compatible client create is accepted.
const cashier2Login='cashier2@example.invalid';
r=await call('/api/user',{method:'POST',cookie:adminCookie,body:{name:'Caisse Client',login:cashier2Login,pass:'CashierTwo9!',role:'Agent caisse',permissions:{allow:['clients.create','users.manage.agents'],deny:[]}}});assert.equal(r.status,200,r.text);
r=await call('/api/login',{method:'POST',body:{login:cashier2Login,pass:'CashierTwo9!'}});assert.equal(r.status,200,r.text);const cashier2Cookie=r.cookie;
r=await call('/api/load',{cookie:cashier2Cookie});assert.ok(r.json.user.permissions.includes('clients.create'));assert.equal(r.json.user.permissions.includes('users.manage.agents'),false);
r=await call('/api/client',{method:'POST',cookie:cashier2Cookie,body:{name:'Client par caisse',contact:'0500000000',piece:'CAISSE-NEW'}});assert.equal(r.status,200,r.text);

// Individual deny applies immediately, even to an existing session.
const cashierRow=env.DB.prepare('SELECT id FROM users WHERE login=?').bind(cashierLogin).first();
r=await call('/api/user/update',{method:'POST',cookie:adminCookie,body:{id:cashierRow.id,name:'Caisse Test',login:cashierLogin,role:'Agent caisse',status:'Actif',permissions:{allow:[],deny:['moves.create.withdrawal']}}});assert.equal(r.status,200,r.text);
r=await call('/api/move',{method:'POST',cookie:cashierCookie,body:{accountId:ordinary.id,type:'Retrait',amount:100}});assert.equal(r.status,403,'deny must apply to existing sessions');

// Credit agent: credit account/payment allowed; ordinary withdrawal/account denied.
const company=env.DB.prepare("SELECT id FROM accounts WHERE bank_id=? AND number LIKE 'ENT-%'").bind(bankId).first();
r=await call('/api/move',{method:'POST',cookie:adminCookie,body:{accountId:company.id,type:'Approvisionnement',amount:200000,description:'Source crédit RBAC'}});assert.equal(r.status,200,r.text);
const source=env.DB.prepare("SELECT id FROM moves WHERE bank_id=? AND account_id=? AND type='Approvisionnement' ORDER BY created_at DESC LIMIT 1").bind(bankId,company.id).first();
const creditLogin='credit@example.invalid',creditPass='CreditAgent9!';
r=await call('/api/user',{method:'POST',cookie:adminCookie,body:{name:'Crédit Test',login:creditLogin,pass:creditPass,role:'Agent crédit',permissions:{allow:[],deny:[]}}});assert.equal(r.status,200,r.text);
r=await call('/api/login',{method:'POST',body:{login:creditLogin,pass:creditPass}});assert.equal(r.status,200,r.text);const creditCookie=r.cookie;
r=await call('/api/load',{cookie:creditCookie});assert.equal(r.status,200,r.text);assert.equal(r.json.user.role_key,'agent_credit');assert.ok(Array.isArray(r.json.credit_sources)&&r.json.credit_sources.length>0);
r=await call('/api/account',{method:'POST',cookie:creditCookie,body:{clientId:client.id,type:'Compte crédit',creditChoice:'Crédit test',creditSourceApprovisionnementId:source.id,creditAmount:10000,creditRate:10,creditDuration:2,fee:0}});assert.equal(r.status,200,r.text);
const creditAccount=env.DB.prepare("SELECT id FROM accounts WHERE bank_id=? AND client_id=? AND type='Compte crédit' ORDER BY created_at DESC LIMIT 1").bind(bankId,client.id).first();
r=await call('/api/move',{method:'POST',cookie:creditCookie,body:{accountId:creditAccount.id,type:'paiement credit',amount:1000}});assert.equal(r.status,200,r.text);
r=await call('/api/move',{method:'POST',cookie:creditCookie,body:{accountId:ordinary.id,type:'Retrait',amount:100,role:'admin_bank'}});assert.equal(r.status,403);
r=await call('/api/account',{method:'POST',cookie:creditCookie,body:{clientId:client.id,type:'Compte courant',deposit:100}});assert.equal(r.status,403);

// Auditor remains read-only for banking data but may submit a correction request.
const auditLogin='audit@example.invalid',auditPass='AuditorTest9!';
r=await call('/api/user',{method:'POST',cookie:adminCookie,body:{name:'Audit Test',login:auditLogin,pass:auditPass,role:'Agent consultation / auditeur',permissions:{allow:['clients.create'],deny:[]}}});assert.equal(r.status,200,r.text);
r=await call('/api/login',{method:'POST',body:{login:auditLogin,pass:auditPass}});assert.equal(r.status,200,r.text);let auditCookie=r.cookie;
r=await call('/api/load',{cookie:auditCookie});assert.equal(r.status,200);assert.equal(r.json.user.readonly,true);assert.equal(r.json.user.permissions.includes('clients.create'),false);assert.equal(r.json.user.permissions.includes('correction.request'),true);assert.equal(r.json.security_logs,undefined);const auditMove=r.json.moves[0];assert.ok(auditMove,'Auditor must receive at least one readable movement');r=await call('/api/correction-requests',{method:'POST',cookie:auditCookie,body:{movement_id:auditMove.id,request_type:'verification',reason:'Demande de vérification transmise par l’auditeur.'}});assert.equal(r.status,200,r.text);r=await call('/api/load',{cookie:auditCookie});assert.ok(Array.isArray(r.json.operation_requests)&&r.json.operation_requests.length>=1);
r=await call('/api/client',{method:'POST',cookie:auditCookie,body:{name:'Interdit'}});assert.equal(r.status,403);
r=await call('/api/move',{method:'POST',cookie:auditCookie,body:{accountId:ordinary.id,type:'Dépôt',amount:1}});assert.equal(r.status,403);
r=await call('/api/client/delete',{method:'POST',cookie:auditCookie,body:{id:client.id}});assert.equal(r.status,403);

// Blocking a user invalidates the old session immediately.
const auditRow=env.DB.prepare('SELECT id FROM users WHERE login=?').bind(auditLogin).first();
r=await call('/api/user/toggle',{method:'POST',cookie:adminCookie,body:{id:auditRow.id}});assert.equal(r.status,200,r.text);
r=await call('/api/load',{cookie:auditCookie});assert.equal(r.status,401);

// Admin receives correction requests and can review; financial deletes are logical.
r=await call('/api/load',{cookie:adminCookie});assert.ok(r.json.operation_requests.length>=1);
const requestId=r.json.operation_requests[0].id;
r=await call('/api/correction-requests/review',{method:'POST',cookie:adminCookie,body:{id:requestId,status:'approved',review_note:'Vérification autorisée'}});assert.equal(r.status,200,r.text);
r=await call('/api/move/delete',{method:'POST',cookie:adminCookie,body:{id:cashierMove.id,reason:'Annulation après contrôle'}});assert.equal(r.status,200,r.text);assert.equal(env.DB.prepare('SELECT is_voided FROM moves WHERE id=?').bind(cashierMove.id).first().is_voided,1);
r=await call('/api/client/delete',{method:'POST',cookie:adminCookie,body:{id:client.id}});assert.equal(r.status,200,r.text);assert.equal(env.DB.prepare('SELECT is_deleted FROM clients WHERE id=?').bind(client.id).first().is_deleted,1);
r=await call('/api/client/restore',{method:'POST',cookie:adminCookie,body:{id:client.id}});assert.equal(r.status,200,r.text);assert.equal(env.DB.prepare('SELECT is_deleted FROM clients WHERE id=?').bind(client.id).first().is_deleted,0);

// Invalid session is 401 and forbidden route is 403.
r=await call('/api/load',{cookie:'gb_session=invalid'});assert.equal(r.status,401);
r=await call('/api/settings/cga',{method:'POST',cookie:creditCookie,body:{cga_conditions:'x'}});assert.equal(r.status,403);

console.log('ALL RBAC V9 TESTS PASSED');
