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

const login='active-appro@example.invalid',pass='BankSecure9!';
let r=await call('/api/register',{method:'POST',body:{name:'ACTIVE APPRO BANK',manager:'Admin',contact:'0101010101',address:'Diabo',login,pass}});assert.equal(r.status,200,r.text);
r=await call('/api/login',{method:'POST',body:{login,pass}});assert.equal(r.status,200,r.text);const cookie=r.cookie;const bankId=r.json.bankId;
const company=env.DB.prepare("SELECT id,balance FROM accounts WHERE bank_id=? AND number LIKE 'ENT-%'").bind(bankId).first();assert.ok(company?.id);

r=await call('/api/client',{method:'POST',cookie,body:{name:'Client Crédit',contact:'0700000000',piece:'CNI-ACTIVE-APPRO'}});assert.equal(r.status,200,r.text);
const client=env.DB.prepare('SELECT id FROM clients WHERE bank_id=? AND piece=?').bind(bankId,'CNI-ACTIVE-APPRO').first();assert.ok(client?.id);

// 1) Approvisionnement 115 000 : entièrement actif tant qu'aucun crédit ne l'utilise.
r=await call('/api/move',{method:'POST',cookie,body:{accountId:company.id,type:'Approvisionnement',amount:115000,description:'Source active V20'}});assert.equal(r.status,200,r.text);
let stored=env.DB.prepare('SELECT balance FROM accounts WHERE id=? AND bank_id=?').bind(company.id,bankId).first();assert.equal(Number(stored.balance),115000);
const source=env.DB.prepare("SELECT id FROM moves WHERE bank_id=? AND account_id=? AND type='Approvisionnement' ORDER BY rowid DESC LIMIT 1").bind(bankId,company.id).first();assert.ok(source?.id);

// 2) Le crédit consomme tout l'approvisionnement : actif = 0, donc solde entreprise = 0.
r=await call('/api/account',{method:'POST',cookie,body:{clientId:client.id,type:'Compte crédit',creditChoice:'Crédit V20',creditSourceApprovisionnementId:source.id,creditAmount:115000,creditRate:0,creditDuration:12,creditPenalty:0,fee:0}});assert.equal(r.status,200,r.text);
stored=env.DB.prepare('SELECT balance FROM accounts WHERE id=? AND bank_id=?').bind(company.id,bankId).first();assert.equal(Number(stored.balance),0,'un approvisionnement entièrement affecté au crédit ne doit plus rester dans le solde entreprise');

// 3) Un remboursement de 10 000 fait revenir uniquement 10 000 de capital dans le Compte entreprise.
const credit=env.DB.prepare("SELECT id FROM accounts WHERE bank_id=? AND client_id=? AND type='Compte crédit' ORDER BY rowid DESC LIMIT 1").bind(bankId,client.id).first();assert.ok(credit?.id);
r=await call('/api/move',{method:'POST',cookie,body:{accountId:credit.id,type:'Paiement de crédit',amount:10000}});assert.equal(r.status,200,r.text);
stored=env.DB.prepare('SELECT balance FROM accounts WHERE id=? AND bank_id=?').bind(company.id,bankId).first();assert.equal(Number(stored.balance),10000);

console.log('COMPANY ACTIVE APPROVISIONNEMENT V20 FUNCTIONAL TESTS PASSED');
