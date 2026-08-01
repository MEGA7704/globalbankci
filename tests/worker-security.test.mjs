import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import worker from '../public/_worker.js';

class BoundStatement {
  constructor(db, sql, params=[]) { this.db=db; this.sql=sql; this.params=params; }
  bind(...params){ return new BoundStatement(this.db,this.sql,params); }
  first(){ const st=this.db.sqlite.prepare(this.sql); return st.get(...this.params) ?? null; }
  all(){ const st=this.db.sqlite.prepare(this.sql); return {results:st.all(...this.params)}; }
  run(){ const st=this.db.sqlite.prepare(this.sql); const r=st.run(...this.params); return {success:true,meta:{changes:Number(r.changes||0),last_row_id:r.lastInsertRowid}}; }
}
class D1Mock {
  constructor(){ this.sqlite=new DatabaseSync(':memory:'); }
  exec(sql){ this.sqlite.exec(sql); return {count:0,duration:0}; }
  prepare(sql){ return new BoundStatement(this,sql); }
  batch(statements){
    this.sqlite.exec('BEGIN');
    try { const out=statements.map(s=>s.run()); this.sqlite.exec('COMMIT'); return out; }
    catch(e){ this.sqlite.exec('ROLLBACK'); throw e; }
  }
}
class KVMock {
  constructor(){this.map=new Map();}
  async put(key,val,opt={}){this.map.set(key,{val:String(val),exp:opt.expirationTtl?Date.now()+opt.expirationTtl*1000:Infinity});}
  async get(key){const x=this.map.get(key);if(!x)return null;if(x.exp<Date.now()){this.map.delete(key);return null;}return x.val;}
  async delete(key){this.map.delete(key);}
}
const env={
  DB:new D1Mock(), KV:new KVMock(),
  SUPER_ADMIN_LOGIN:'root-test@example.invalid',
  SUPER_ADMIN_PASSWORD:'TestSecret9!',
  SUPER_ADMIN_SESSION_VERSION:'1',
  ASSETS:{fetch:async()=>new Response('asset')}
};

async function call(path,{method='GET',body,cookie,origin=true}={}){
  const headers={};
  if(body!==undefined)headers['content-type']='application/json';
  if(cookie)headers.cookie=cookie;
  if(origin)headers.origin='https://example.pages.dev';
  const req=new Request('https://example.pages.dev'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  const res=await worker.fetch(req,env,{});
  const text=await res.text();let json=null;try{json=text?JSON.parse(text):null}catch{}
  return {res,json,text,cookie:res.headers.get('set-cookie')?.split(';')[0]||''};
}
function containsHash(value){return JSON.stringify(value).includes('pbkdf2_sha256$');}

let r=await call('/api/status');assert.equal(r.res.status,200);
r=await call('/api/load');assert.equal(r.res.status,401,'load must require session');

// A missing session version disables Super Admin access (fail closed).
const envMissingVersion={...env,SUPER_ADMIN_SESSION_VERSION:''};
{
  const req=new Request('https://example.pages.dev/api/login',{method:'POST',headers:{origin:'https://example.pages.dev','content-type':'application/json'},body:JSON.stringify({login:env.SUPER_ADMIN_LOGIN,pass:env.SUPER_ADMIN_PASSWORD})});
  const res=await worker.fetch(req,envMissingVersion,{});
  assert.equal(res.status,401,'super login must fail when required configuration is incomplete');
}

// Super Admin secret login via Worker only.
r=await call('/api/login',{method:'POST',body:{login:env.SUPER_ADMIN_LOGIN,pass:env.SUPER_ADMIN_PASSWORD}});
assert.equal(r.res.status,200);assert.ok(r.cookie.includes('gb_session='));const superCookie=r.cookie;assert.equal(r.json.role,'super');assert.equal('token' in r.json,false);
r=await call('/api/load',{cookie:superCookie});assert.equal(r.res.status,200);assert.equal(r.json.role,'super');assert.equal(containsHash(r.json),false);

// Bearer tokens are intentionally unsupported; only the HttpOnly cookie authenticates.
{
  const token=superCookie.split('=')[1];
  const req=new Request('https://example.pages.dev/api/load',{headers:{authorization:`Bearer ${token}`}});
  const res=await worker.fetch(req,env,{});
  assert.equal(res.status,401,'Bearer authentication must remain disabled');
}

// Rate limiting per account/IP.
for(let i=1;i<=5;i++){
  r=await call('/api/login',{method:'POST',body:{login:'unknown-rate-test',pass:'Wrong9!x'}});
  if(i<5) assert.equal(r.res.status,401); else {assert.equal(r.res.status,429);assert.ok(r.json.retry_after>0);}
}

// Register two banks; hashes stay server-side.
const bank1Login='bank-one@example.invalid', bank1Pass='BankOne9!';
r=await call('/api/register',{method:'POST',body:{name:'Bank One',manager:'Manager One',contact:'0101010101',address:'Diabo',login:bank1Login,pass:bank1Pass}});assert.equal(r.res.status,200,r.text);const bank1Id=r.json.id;
const bank2Login='bank-two@example.invalid', bank2Pass='BankTwo9!';
r=await call('/api/register',{method:'POST',body:{name:'Bank Two',manager:'Manager Two',contact:'0202020202',address:'Bouaké',login:bank2Login,pass:bank2Pass}});assert.equal(r.res.status,200,r.text);const bank2Id=r.json.id;
const storedBank=env.DB.prepare('SELECT pass,auth_version FROM banks WHERE id=?').bind(bank1Id).first();assert.match(storedBank.pass,/^pbkdf2_sha256\$100000\$/);assert.equal(storedBank.auth_version,1);

// Two independent admin sessions for bank 1.
r=await call('/api/login',{method:'POST',body:{login:bank1Login,pass:bank1Pass}});assert.equal(r.res.status,200,r.text);let bankCookie1=r.cookie;
r=await call('/api/login',{method:'POST',body:{login:bank1Login,pass:bank1Pass}});assert.equal(r.res.status,200,r.text);const bankCookie2=r.cookie;
r=await call('/api/load',{cookie:bankCookie1});assert.equal(r.res.status,200);assert.equal(r.json.bank.id,bank1Id);assert.equal(containsHash(r.json),false);

// A client secret never comes back in /api/load, and account creation cannot cross tenants.
r=await call('/api/login',{method:'POST',body:{login:bank2Login,pass:bank2Pass}});assert.equal(r.res.status,200,r.text);const bank2Cookie=r.cookie;
r=await call('/api/client',{method:'POST',cookie:bank2Cookie,body:{name:'Client Bank Two',contact:'0200000000',piece:'CI-2',pass:'NeverReturnThisClientSecret'}});assert.equal(r.res.status,200,r.text);
const bank2Client=env.DB.prepare('SELECT id FROM clients WHERE bank_id=? AND name=?').bind(bank2Id,'Client Bank Two').first();assert.ok(bank2Client?.id);
r=await call('/api/load',{cookie:bank2Cookie});assert.equal(r.res.status,200);assert.equal(JSON.stringify(r.json).includes('NeverReturnThisClientSecret'),false);assert.equal(Object.prototype.hasOwnProperty.call(r.json.clients[0]||{},'pass'),false);
r=await call('/api/account',{method:'POST',cookie:bankCookie1,body:{clientId:bank2Client.id,type:'Compte courant',deposit:1000}});assert.equal(r.res.status,404,'a bank must not create an account for another tenant client');

// Professional client form: structured fields, safe image format, no duplicated image in JSON, and image preservation on update.
const tinyClientImage='data:image/png;base64,iVBORw0KGgo=';
const physicalDetails={typeClient:'personne_physique',nom:'KOUASSI',prenoms:'Aya',dateNaissance:'1994-02-12',lieuNaissance:'Diabo',sexe:'Féminin',profession:'Commerçante',typePiece:'CNI',numeroPiece:'CI-PHY-1',telephone:'0700000001',whatsapp:'0700000001',commune:'Diabo',villageQuartier:'Centre',personneAContacter:'KOUASSI Jean',contactPersonneAContacter:'0700000002',lienPersonneAContacter:'Frère',photoClient:true};
r=await call('/api/client',{method:'POST',cookie:bankCookie1,body:{client_type:'personne_physique',client_details:JSON.stringify(physicalDetails),photo_logo:tinyClientImage}});assert.equal(r.res.status,200,r.text);
let professionalClient=env.DB.prepare('SELECT * FROM clients WHERE bank_id=? AND piece=?').bind(bank1Id,'CI-PHY-1').first();assert.ok(professionalClient?.id);assert.equal(professionalClient.client_type,'personne_physique');assert.match(professionalClient.photo_logo,/^kv:client-media:/);const physicalMediaRef=professionalClient.photo_logo;assert.equal(await env.KV.get(physicalMediaRef.slice(3)),tinyClientImage);assert.equal(String(professionalClient.client_details).includes('data:image'),false,'image must not be duplicated in client_details');assert.equal(professionalClient.pass,'','client password must never be accepted from the form');
r=await call('/api/load',{cookie:bankCookie1});const loadedProfessional=r.json.clients.find(c=>c.id===professionalClient.id);assert.equal(loadedProfessional.photo_logo,'/api/client/media?id='+encodeURIComponent(professionalClient.id));
r=await call(loadedProfessional.photo_logo,{cookie:bankCookie1});assert.equal(r.res.status,200);assert.equal(r.res.headers.get('content-type'),'image/png');
r=await call(loadedProfessional.photo_logo,{cookie:bank2Cookie});assert.equal(r.res.status,404,'another bank must not read client media');
const updatedPhysical={...physicalDetails,profession:'Entrepreneure'};
r=await call('/api/client/update',{method:'POST',cookie:bankCookie1,body:{id:professionalClient.id,client_type:'personne_physique',client_details:JSON.stringify(updatedPhysical),photo_logo:''}});assert.equal(r.res.status,200,r.text);
professionalClient=env.DB.prepare('SELECT * FROM clients WHERE id=? AND bank_id=?').bind(professionalClient.id,bank1Id).first();assert.equal(professionalClient.photo_logo,physicalMediaRef,'existing photo reference must be preserved when no replacement is uploaded');assert.equal(await env.KV.get(physicalMediaRef.slice(3)),tinyClientImage);assert.equal(JSON.parse(professionalClient.client_details).profession,'Entrepreneure');
const moralDetails={typeClient:'personne_morale',denomination:'GLOBAL TEST SARL',sigle:'GTS',formeJuridique:'SARL',domaineActivite:'Services',numeroRccmRecepisseAgrement:'CI-ABJ-2026-B-1',numeroContribuable:'CC-1',dateCreationEntreprise:'2026-01-02',ville:'Bouaké',commune:'Diabo',villageQuartier:'Commerce',siegeSocial:'Route principale',contactPrincipal:'0500000001',whatsapp:'0500000001',emailProfessionnel:'contact@example.invalid',logoEntreprise:true,representantLegalNom:'KONAN',representantLegalPrenoms:'Jean',representantLegalFonction:'Gérant',representantLegalContact:'0500000002',representantLegalTypePiece:'CNI',representantLegalNumeroPiece:'CI-REP-1'};
r=await call('/api/client',{method:'POST',cookie:bankCookie1,body:{client_type:'personne_morale',client_details:JSON.stringify(moralDetails),photo_logo:tinyClientImage}});assert.equal(r.res.status,200,r.text);
const moralClient=env.DB.prepare('SELECT * FROM clients WHERE bank_id=? AND name=?').bind(bank1Id,'GLOBAL TEST SARL').first();assert.ok(moralClient?.id);assert.equal(moralClient.client_type,'personne_morale');assert.equal(JSON.parse(moralClient.client_details).representantLegalNom,'KONAN');
r=await call('/api/client',{method:'POST',cookie:bankCookie1,body:{client_type:'personne_physique',client_details:JSON.stringify(physicalDetails),photo_logo:'data:image/svg+xml;base64,PHN2Zz4='}});assert.equal(r.res.status,400,'SVG uploads must be rejected');

// Tenant isolation on compatibility save route.
r=await call('/api/save',{method:'POST',cookie:bankCookie1,body:{bank_id:bank2Id,management_settings:{year:2026,month:8,status:'open'}}});assert.equal(r.res.status,403);
r=await call('/api/save',{method:'POST',cookie:bankCookie1,body:{management_settings:{year:2026,month:8,status:'open'}}});assert.equal(r.res.status,200);

// Create an agent and verify password hashing.
const agentLogin='agent-one@example.invalid',agentPass='AgentOne9!';
r=await call('/api/user',{method:'POST',cookie:bankCookie1,body:{name:'Agent One',login:agentLogin,pass:agentPass,role:'Agent caisse',status:'Actif'}});assert.equal(r.res.status,200,r.text);
const agent=env.DB.prepare('SELECT id,pass,auth_version,bank_id FROM users WHERE login=?').bind(agentLogin).first();assert.equal(agent.bank_id,bank1Id);assert.match(agent.pass,/^pbkdf2_sha256\$100000\$/);
r=await call('/api/login',{method:'POST',body:{login:agentLogin,pass:agentPass}});assert.equal(r.res.status,200,r.text);const agentCookie=r.cookie;
r=await call('/api/save',{method:'POST',cookie:agentCookie,body:{management_settings:{year:2026,month:8,status:'open'}}});assert.equal(r.res.status,403);

// Agent password change invalidates all old agent sessions.
const agentNew='AgentNew9!';
r=await call('/api/user/update',{method:'POST',cookie:bankCookie1,body:{id:agent.id,name:'Agent One',login:agentLogin,pass:agentNew,role:'Agent caisse',status:'Actif'}});assert.equal(r.res.status,200,r.text);
r=await call('/api/load',{cookie:agentCookie});assert.equal(r.res.status,401,'old agent session must be invalid');
r=await call('/api/login',{method:'POST',body:{login:agentLogin,pass:agentPass}});assert.equal(r.res.status,401,'old agent password must fail');
r=await call('/api/login',{method:'POST',body:{login:agentLogin,pass:agentNew}});assert.equal(r.res.status,200,'new agent password must work');

// Bank password change renews current session and invalidates other sessions.
const bankNew='BankNew9!';
r=await call('/api/bank/update',{method:'POST',cookie:bankCookie1,body:{name:'Bank One',manager:'Manager One',contact:'0101010101',address:'Diabo',login:bank1Login,pass:bankNew,admin_password:bank1Pass,currency:'FCFA'}});assert.equal(r.res.status,200,r.text);assert.equal(r.json.session_renewed,true);bankCookie1=r.cookie;
r=await call('/api/load',{cookie:bankCookie2});assert.equal(r.res.status,401,'other bank sessions must be invalidated');
r=await call('/api/load',{cookie:bankCookie1});assert.equal(r.res.status,200,'renewed current session must work');
r=await call('/api/login',{method:'POST',body:{login:bank1Login,pass:bank1Pass}});assert.equal(r.res.status,401,'old bank password must fail');
r=await call('/api/login',{method:'POST',body:{login:bank1Login,pass:bankNew}});assert.equal(r.res.status,200,'new bank password must work');

// Cross-origin mutation is blocked.
r=await call('/api/logout',{method:'POST',cookie:bankCookie1,origin:false});assert.equal(r.res.status,200);
const badReq=new Request('https://example.pages.dev/api/login',{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:JSON.stringify({login:'x',pass:'y'})});
const badRes=await worker.fetch(badReq,env,{});assert.equal(badRes.status,403);

console.log('ALL WORKER SECURITY TESTS PASSED');
