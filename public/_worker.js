const SESSION_TTL = 60 * 60 * 12;
const PASSWORD_ITERATIONS = 210000;
const LOGIN_WINDOW_SECONDS = 15 * 60;
const LOGIN_BLOCK_SECONDS = 15 * 60;
const LOGIN_ACCOUNT_LIMIT = 5;
const LOGIN_IP_LIMIT = 20;
const SESSION_COOKIE = 'gb_session';
const FREE_SUBSCRIPTION_DAYS = 20;
const BUSINESS_SUBSCRIPTION_DAYS = 365;

const DEFAULT_CHARGE_BASES_BANK_MANAGER = [
 ['Frais Compte courant','Frais',0],['Frais Compte épargne','Frais',0],['Frais Compte entreprise','Frais',0],['Frais Compte association','Frais',0],['Frais Dépôt à terme','Frais',0],['Frais Compte crédit','Frais',0],['Frais Dépôt espèces','Frais',0],['Frais Retrait espèces','Frais',0],['Frais de recouvrement','Frais',0],['Frais de relevé bancaire','Frais',0],['Frais de clôture','Frais',0],['Frais de gestion mensuelle','Frais',0],['Frais Carnet','Frais',0]
];
async function seedDefaultCharges(env,bankId){
 const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM charge_bases WHERE bank_id=?').bind(bankId).first();
 if(count && Number(count.n||0)>0)return;
 for(const [name,cat,percent] of DEFAULT_CHARGE_BASES_BANK_MANAGER){
  await env.DB.prepare('INSERT INTO charge_bases(id,bank_id,name,category,percent) VALUES(?,?,?,?,?)').bind(uid('CHG'),bankId,name,cat,percent).run();
 }
}
async function resetDefaultCharges(env,bankId){
 await env.DB.prepare('DELETE FROM charge_bases WHERE bank_id=?').bind(bankId).run();
 for(const [name,cat,percent] of DEFAULT_CHARGE_BASES_BANK_MANAGER){
  await env.DB.prepare('INSERT INTO charge_bases(id,bank_id,name,category,percent) VALUES(?,?,?,?,?)').bind(uid('CHG'),bankId,name,cat,percent).run();
 }
}
let schemaReady = false;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS banks (id TEXT PRIMARY KEY,name TEXT NOT NULL,manager TEXT,contact TEXT,address TEXT,email TEXT DEFAULT '',slogan TEXT DEFAULT '',logo TEXT DEFAULT '',stamp TEXT DEFAULT '',signature TEXT DEFAULT '',primary_color TEXT DEFAULT '#003b3b',secondary_color TEXT DEFAULT '#e7ad2f',footer_text TEXT DEFAULT 'Document généré automatiquement',legal_mentions TEXT DEFAULT '',cga_conditions TEXT DEFAULT '',currency TEXT DEFAULT 'FCFA',country TEXT DEFAULT '',city TEXT DEFAULT '',login TEXT NOT NULL UNIQUE,pass TEXT NOT NULL,auth_version INTEGER NOT NULL DEFAULT 1,status TEXT NOT NULL DEFAULT 'Actif',subscription TEXT NOT NULL DEFAULT 'FREE',subscription_started_at TEXT DEFAULT '',subscription_expires_at TEXT DEFAULT '',subscription_updated_at TEXT DEFAULT '',created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS clients (id TEXT PRIMARY KEY,bank_id TEXT NOT NULL,name TEXT NOT NULL,contact TEXT,job TEXT,address TEXT,piece TEXT,pass TEXT,client_type TEXT DEFAULT 'personne_physique',client_details TEXT DEFAULT '',photo_logo TEXT DEFAULT '',is_blocked INTEGER NOT NULL DEFAULT 0,is_deleted INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY,bank_id TEXT NOT NULL,client_id TEXT NOT NULL,number TEXT NOT NULL UNIQUE,type TEXT NOT NULL,balance REAL NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'Actif',is_blocked INTEGER NOT NULL DEFAULT 0,block_reason TEXT DEFAULT '',credit_fee REAL DEFAULT 0,credit_carnet_fee REAL DEFAULT 0,credit_amount REAL DEFAULT 0,credit_rate REAL DEFAULT 0,credit_duration INTEGER DEFAULT 0,credit_monthly REAL DEFAULT 0,credit_due_count INTEGER DEFAULT 0,credit_penalty_rate REAL DEFAULT 0,credit_total REAL DEFAULT 0,credit_choice TEXT DEFAULT '',created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS moves (id TEXT PRIMARY KEY,bank_id TEXT NOT NULL,account_id TEXT NOT NULL,type TEXT NOT NULL,description TEXT,amount REAL NOT NULL,balance_after REAL NOT NULL,created_by TEXT DEFAULT '',created_by_role TEXT DEFAULT '',created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY,bank_id TEXT NOT NULL,name TEXT,login TEXT,pass TEXT,auth_version INTEGER NOT NULL DEFAULT 1,role TEXT,status TEXT NOT NULL DEFAULT 'Actif',permissions TEXT DEFAULT '[]',last_login TEXT DEFAULT '',created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS logs (id TEXT PRIMARY KEY,bank_id TEXT NOT NULL,message TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS security_logs (id TEXT PRIMARY KEY,bank_id TEXT NOT NULL,action TEXT,section TEXT,result TEXT,agent TEXT,role TEXT DEFAULT '',motif TEXT DEFAULT '',user_id TEXT DEFAULT '',created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS charge_bases (id TEXT PRIMARY KEY,bank_id TEXT NOT NULL,name TEXT NOT NULL,category TEXT,percent REAL DEFAULT 0,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS obligations (id TEXT PRIMARY KEY,bank_id TEXT NOT NULL,name TEXT NOT NULL,amount REAL DEFAULT 0,due_day INTEGER DEFAULT 1,base_type TEXT DEFAULT 'Bénéfice général',base_item TEXT DEFAULT '',created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS reset_requests (id TEXT PRIMARY KEY,bank_id TEXT NOT NULL,user_id TEXT,message TEXT,status TEXT DEFAULT 'En attente',created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS account_types (id TEXT PRIMARY KEY,bank_id TEXT NOT NULL,name TEXT NOT NULL,is_active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS movement_types (id TEXT PRIMARY KEY,bank_id TEXT NOT NULL,name TEXT NOT NULL,is_active INTEGER NOT NULL DEFAULT 1,category TEXT DEFAULT '',is_bank_revenue INTEGER,description TEXT DEFAULT '',created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS manual_revenues (id TEXT PRIMARY KEY,bank_id TEXT NOT NULL,name TEXT NOT NULL,operations INTEGER DEFAULT 0,amount REAL DEFAULT 0,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS ignored_revenues (id TEXT PRIMARY KEY,bank_id TEXT NOT NULL,revenue_key TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS management_settings (bank_id TEXT PRIMARY KEY,year INTEGER NOT NULL,month INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'open',updated_at TEXT NOT NULL DEFAULT (datetime('now')));

`;

function norm(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();}
function creditCurrentInstallmentBase(acc){
 if(!acc)return 0;
 const monthly=Number(acc.credit_monthly||0)||0;
 const total=Number(acc.credit_total||0)||0;
 const dueCount=Number(acc.credit_due_count||acc.credit_duration||0)||0;
 if(monthly>0)return Math.round(monthly*100)/100;
 if(total>0&&dueCount>0)return Math.round((total/dueCount)*100)/100;
 return Math.max(0,Number(acc.balance||0));
}
function uid(prefix='ID'){return `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0,8).toUpperCase()}`;}
const COMPANY_CLIENT_MARKER='__BANK_COMPANY_CLIENT__';
function companyClientId(bankId){return 'COMPANY-CLIENT-'+String(bankId||'').replace(/[^A-Za-z0-9_-]/g,'');}
function companyAccountId(bankId){return 'COMPANY-ACCOUNT-'+String(bankId||'').replace(/[^A-Za-z0-9_-]/g,'');}
function companyAccountNumber(bankId){const clean=String(bankId||'').replace(/[^A-Za-z0-9]/g,'').toUpperCase().slice(-8)||'BANK';return 'ENT-'+clean;}
function isCompanyClientRow(c,bankId){return !!c&&(String(c.id||'')===companyClientId(bankId)||String(c.piece||'')===COMPANY_CLIENT_MARKER);}
function isCompanyAccountRow(a,bankId){return !!a&&(String(a.id||'')===companyAccountId(bankId)||String(a.number||'')===companyAccountNumber(bankId));}
function isCompanyMovementType(type){const t=norm(type);return t==='approvisionnement'||t==='decaissement';}
function isCompanyDecaissementType(type){return norm(type)==='decaissement';}
function isCompanyApprovisionnementType(type){return norm(type)==='approvisionnement';}
function rowDateValue(row){
 const raw=String((row&&row.created_at)||(row&&row.date)||(row&&row.createdAt)||'').replace(' ','T');
 const d=new Date(raw);
 return isNaN(d.getTime())?null:d;
}
function rowInScope(row,scope={}){
 const d=rowDateValue(row);
 if(!d)return false;
 if(scope.year&&d.getFullYear()!==Number(scope.year))return false;
 if(scope.month&&(d.getMonth()+1)!==Number(scope.month))return false;
 if(scope.start){const s=new Date(String(scope.start)+'T00:00:00');if(!isNaN(s.getTime())&&d<s)return false;}
 if(scope.end){const e=new Date(String(scope.end)+'T23:59:59');if(!isNaN(e.getTime())&&d>e)return false;}
 return true;
}
function isCreditAccountType(type){const t=norm(type);return t.includes('credit')||t.includes('crédit');}
function isCreditPaymentTypeServer(type){
 const t=norm(type);
 return t==='paiement credit'||t==='paiement de credit'||t==='paiement crédit'||t==='paiement de crédit'||t.includes('remboursement credit')||t.includes('remboursement crédit');
}
function isRevenueTextServer(type,desc=''){
 const t=norm(String(type||'')+' '+String(desc||''));
 return t.includes('frais')||t.includes('penalite')||t.includes('retard')||t.includes('interet')||t.includes('commission')||t.includes('service')||t.includes('carnet')||t.includes('ouverture')||t.includes('dossier')||t.includes('recouvrement')||t.includes('releve')||t.includes('cloture');
}
function companyCreditRepaymentSourceMarker(moveId){return '[CREDIT_REPAYMENT_SOURCE:'+String(moveId||'').replace(/[^A-Za-z0-9_-]/g,'')+']';}

function creditDecaissementSourceMarkerServer(moveId){return '[DECAISSEMENT_SOURCE:'+String(moveId||'').replace(/[^A-Za-z0-9_-]/g,'')+']';}
async function usedCreditAmountForDecaissementSource(env,bankId,moveId){
 const marker=creditDecaissementSourceMarkerServer(moveId);
 const rows=(await env.DB.prepare("SELECT credit_amount FROM accounts WHERE bank_id=? AND COALESCE(is_deleted,0)=0 AND credit_choice LIKE ?").bind(bankId,'%'+marker+'%').all()).results||[];
 return rows.reduce((s,a)=>s+Math.abs(Number((a&&a.credit_amount)||0)||0),0);
}
async function availableCreditSourceDecaissement(env,bankId,moveId){
 const companyId=companyAccountId(bankId);
 const m=await env.DB.prepare("SELECT id,type,amount,balance_after FROM moves WHERE id=? AND bank_id=? AND account_id=? LIMIT 1").bind(moveId,bankId,companyId).first();
 if(!m)return {ok:false,error:'Source du montant introuvable.'};
 if(norm(m.type)!=='decaissement')return {ok:false,error:'La source du montant doit être un décaissement du Compte entreprise automatique.'};
 const soldeApres=Math.round((Number(m.balance_after||0)||0)*100)/100;
 if(!(soldeApres>0))return {ok:false,error:'Ce décaissement ne peut pas être choisi : son Solde après doit être supérieur à 0 FCFA.'};
 const initial=Math.abs(Number(m.amount||0)||0);
 const used=await usedCreditAmountForDecaissementSource(env,bankId,moveId);
 const available=Math.max(0,Math.round((initial-used)*100)/100);
 return {ok:true,move:m,initial,used,available,soldeApres,marker:creditDecaissementSourceMarkerServer(moveId)};
}
function creditApprovisionnementSourceMarkerServer(moveId){return '[APPROVISIONNEMENT_SOURCE:'+String(moveId||'').replace(/[^A-Za-z0-9_-]/g,'')+']';}
async function usedCreditAmountForApprovisionnementSource(env,bankId,moveId){
 const marker=creditApprovisionnementSourceMarkerServer(moveId);
 const rows=(await env.DB.prepare("SELECT credit_amount FROM accounts WHERE bank_id=? AND COALESCE(is_deleted,0)=0 AND credit_choice LIKE ?").bind(bankId,'%'+marker+'%').all()).results||[];
 return rows.reduce((sum,a)=>sum+Math.abs(Number((a&&a.credit_amount)||0)||0),0);
}
async function availableCreditSourceApprovisionnement(env,bankId,moveId){
 const companyId=companyAccountId(bankId);
 const m=await env.DB.prepare("SELECT id,type,amount,balance_after FROM moves WHERE id=? AND bank_id=? AND account_id=? LIMIT 1").bind(moveId,bankId,companyId).first();
 if(!m)return {ok:false,error:'Source du montant introuvable.'};
 if(norm(m.type)!=='approvisionnement')return {ok:false,error:'La source du montant doit être un approvisionnement du Compte entreprise automatique.'};
 const soldeApres=Math.round((Number(m.balance_after||0)||0)*100)/100;
 if(!(soldeApres>0))return {ok:false,error:'Cet approvisionnement ne peut pas être choisi : son Solde après doit être supérieur à 0 FCFA.'};
 const initial=Math.abs(Number(m.amount||0)||0);
 const used=await usedCreditAmountForApprovisionnementSource(env,bankId,moveId);
 const available=Math.max(0,Math.round((initial-used)*100)/100);
 return {ok:true,move:m,initial,used,available,soldeApres,marker:creditApprovisionnementSourceMarkerServer(moveId)};
}
async function computeDecaissementRemainingAvailableTotal(env,bankId,scope={}){
 const companyId=companyAccountId(bankId);
 const rows=(await env.DB.prepare("SELECT id,type,amount,balance_after,created_at FROM moves WHERE bank_id=? AND account_id=? ORDER BY datetime(created_at) ASC, id ASC").bind(bankId,companyId).all()).results||[];
 let total=0;
 for(const m of rows){
  if(!isCompanyDecaissementType(m.type))continue;
  if(scope&&(scope.year||scope.month||scope.start||scope.end)&&!rowInScope(m,scope))continue;
  const info=await availableCreditSourceDecaissement(env,bankId,m.id);
  if(info&&info.ok)total+=Number(info.available||0);
 }
 return Math.round(total*100)/100;
}

async function computeCreditRepaidPrincipalTotal(env,bankId,scope={}){
 const rows=(await env.DB.prepare("SELECT id,number,type,credit_amount FROM accounts WHERE bank_id=? AND COALESCE(is_deleted,0)=0 AND lower(COALESCE(status,'Actif')) NOT LIKE '%supprim%' AND lower(COALESCE(status,'Actif')) NOT LIKE '%delete%' AND lower(COALESCE(status,'Actif')) NOT LIKE '%desactiv%' AND lower(COALESCE(status,'Actif')) NOT LIKE '%archive%' AND lower(COALESCE(status,'Actif')) NOT LIKE '%ferme%' AND lower(COALESCE(status,'Actif')) NOT LIKE '%clotur%' AND lower(COALESCE(status,'Actif')) NOT LIKE '%inactif%' AND (lower(COALESCE(type,'')) LIKE '%credit%' OR lower(COALESCE(type,'')) LIKE '%crédit%') AND COALESCE(credit_amount,0)>0 ORDER BY created_at ASC").bind(bankId).all()).results||[];
 let total=0;
 for(const acc of rows){
  const principal=Math.abs(Number(acc.credit_amount||0)||0);
  if(principal<=0)continue;
  let remaining=principal;
  const pays=(await env.DB.prepare("SELECT id,type,description,amount,created_at FROM moves WHERE bank_id=? AND account_id=? ORDER BY datetime(created_at) ASC, id ASC").bind(bankId,acc.id).all()).results||[];
  for(const m of pays){
   if(!isCreditPaymentTypeServer(m.type))continue;
   const paid=Math.abs(Number(m.amount||0)||0);
   if(paid<=0||remaining<=0)continue;
   const part=Math.min(paid,remaining);
   remaining=Math.max(0,remaining-part);
   if(!scope||(!scope.year&&!scope.month&&!scope.start&&!scope.end)||rowInScope(m,scope))total+=part;
  }
 }
 return Math.round(total*100)/100;
}
async function computeTotalRevenueBank(env,bankId,scope={}){
 const accountId=companyAccountId(bankId);
 const rows=(await env.DB.prepare("SELECT m.id,m.account_id,m.type,m.description,m.amount,m.created_at,a.number AS acc_number,a.type AS acc_type FROM moves m JOIN accounts a ON a.id=m.account_id AND a.bank_id=m.bank_id WHERE m.bank_id=? AND COALESCE(a.is_deleted,0)=0 AND lower(COALESCE(a.status,'Actif')) NOT LIKE '%supprim%' AND lower(COALESCE(a.status,'Actif')) NOT LIKE '%delete%' AND lower(COALESCE(a.status,'Actif')) NOT LIKE '%desactiv%' AND lower(COALESCE(a.status,'Actif')) NOT LIKE '%archive%' AND lower(COALESCE(a.status,'Actif')) NOT LIKE '%ferme%' AND lower(COALESCE(a.status,'Actif')) NOT LIKE '%clotur%' AND lower(COALESCE(a.status,'Actif')) NOT LIKE '%inactif%' ORDER BY datetime(m.created_at) ASC, m.id ASC").bind(bankId).all()).results||[];
 let total=0;
 for(const m of rows){
  if(scope&&(scope.year||scope.month||scope.start||scope.end)&&!rowInScope(m,scope))continue;
  const amount=Math.abs(Number(m.amount||0)||0);
  if(amount<=0)continue;
  const isCompany=String(m.account_id||'')===String(accountId)||String(m.acc_number||'')===companyAccountNumber(bankId);
  if(isCompany){
   if(isCompanyApprovisionnementType(m.type))total+=amount;
   else if(isCompanyDecaissementType(m.type))total-=amount;
   continue;
  }
  if(isCreditPaymentTypeServer(m.type))continue;
  if(isRevenueTextServer(m.type,m.description))total+=amount;
 }
 return Math.round(total*100)/100;
}
async function computeCompanyOfficialBalance(env,bankId,scope={}){
 const revenue=await computeTotalRevenueBank(env,bankId,scope||{});
 const repaid=await computeCreditRepaidPrincipalTotal(env,bankId,scope||{});
 const remaining=await computeDecaissementRemainingAvailableTotal(env,bankId,scope||{});
 return Math.round((Number(revenue||0)+Number(repaid||0)+Number(remaining||0))*100)/100;
}
async function updateCompanyAccountStoredBalance(env,bankId){
 const accountId=companyAccountId(bankId);
 const official=await computeCompanyOfficialBalance(env,bankId,{});
 await env.DB.prepare('UPDATE accounts SET balance=? WHERE id=? AND bank_id=?').bind(official,accountId,bankId).run();
 return official;
}
async function syncCreditRepaymentsToCompanyAccount(env,bankId){
 const accountId=companyAccountId(bankId);
 const company=await env.DB.prepare('SELECT id FROM accounts WHERE id=? AND bank_id=?').bind(accountId,bankId).first();
 if(!company)return 0;
 const credits=(await env.DB.prepare("SELECT id,number,type,credit_amount FROM accounts WHERE bank_id=? AND id<>? AND COALESCE(is_deleted,0)=0 AND lower(COALESCE(status,'Actif')) NOT LIKE '%supprim%' AND lower(COALESCE(status,'Actif')) NOT LIKE '%delete%' AND lower(COALESCE(status,'Actif')) NOT LIKE '%desactiv%' AND lower(COALESCE(status,'Actif')) NOT LIKE '%archive%' AND lower(COALESCE(status,'Actif')) NOT LIKE '%ferme%' AND lower(COALESCE(status,'Actif')) NOT LIKE '%clotur%' AND lower(COALESCE(status,'Actif')) NOT LIKE '%inactif%' AND (lower(COALESCE(type,'')) LIKE '%credit%' OR lower(COALESCE(type,'')) LIKE '%crédit%') AND COALESCE(credit_amount,0)>0 ORDER BY created_at ASC").bind(bankId,accountId).all()).results||[];
 let inserted=0;
 for(const acc of credits){
  const principal=Math.abs(Number(acc.credit_amount||0)||0);
  if(principal<=0)continue;
  let remaining=principal;
  const payments=(await env.DB.prepare("SELECT id,type,description,amount,created_at FROM moves WHERE bank_id=? AND account_id=? ORDER BY datetime(created_at) ASC, id ASC").bind(bankId,acc.id).all()).results||[];
  for(const m of payments){
   if(!isCreditPaymentTypeServer(m.type))continue;
   const paid=Math.abs(Number(m.amount||0)||0);
   if(paid<=0||remaining<=0)continue;
   const part=Math.min(paid,remaining);
   remaining=Math.max(0,remaining-part);
   if(part<=0)continue;
   const marker=companyCreditRepaymentSourceMarker(m.id);
   const exists=await env.DB.prepare('SELECT id FROM moves WHERE bank_id=? AND account_id=? AND description LIKE ? LIMIT 1').bind(bankId,accountId,'%'+marker+'%').first();
   if(exists)continue;
   const bal=await computeCompanyOfficialBalance(env,bankId,{});
   const desc='Alimentation automatique du Compte entreprise par paiement crédit remboursé limité au capital accordé - compte '+String(acc.number||acc.id)+' '+marker;
   await env.DB.prepare('INSERT INTO moves(id,bank_id,account_id,type,description,amount,balance_after,created_by,created_by_role,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .bind(uid('MOV'),bankId,accountId,'Paiement crédit remboursé',desc,part,bal,'SYSTEME','Système',m.created_at||new Date().toISOString()).run();
   inserted+=part;
  }
 }
 await updateCompanyAccountStoredBalance(env,bankId);
 return Math.round(inserted*100)/100;
}
// Ancienne synchronisation du montant crédit accordé : désactivée.
// Le Compte entreprise est désormais alimenté par les paiements crédits remboursés, pas par le crédit accordé.
async function syncCreditAmountsToCompanyAccount(env,bankId){return syncCreditRepaymentsToCompanyAccount(env,bankId);}
async function ensureCompanyAccount(env,bankId){
 const b=await env.DB.prepare('SELECT id,name,manager,contact,address,email,city,country FROM banks WHERE id=?').bind(bankId).first();
 if(!b)return;
 const clientId=companyClientId(bankId), accountId=companyAccountId(bankId), number=companyAccountNumber(bankId);
 const name=String(b.name||'Banque').trim()||'Banque';
 const address=String(b.address||[b.city,b.country].filter(Boolean).join(' - ')||'').trim();
 await env.DB.prepare("INSERT INTO clients(id,bank_id,name,contact,job,address,piece,pass,is_blocked,is_deleted) VALUES(?,?,?,?,?,?,?,?,0,0) ON CONFLICT(id) DO UPDATE SET name=excluded.name,contact=excluded.contact,job=excluded.job,address=excluded.address,piece=excluded.piece,is_deleted=0,is_blocked=0")
  .bind(clientId,bankId,name,String(b.contact||''),'Compte entreprise de la banque',address,COMPANY_CLIENT_MARKER,'').run();
 await env.DB.prepare("INSERT INTO accounts(id,bank_id,client_id,number,type,balance,status,is_blocked,block_reason,is_deleted) VALUES(?,?,?,?,?,0,'Actif',0,'',0) ON CONFLICT(id) DO UPDATE SET client_id=excluded.client_id,number=excluded.number,type='Compte entreprise',status='Actif',is_deleted=0,is_blocked=0,block_reason='' ")
  .bind(accountId,bankId,clientId,number,'Compte entreprise').run();
 await syncCreditAmountsToCompanyAccount(env,bankId);
}

function json(data,status=200,extraHeaders={}){
 const headers=new Headers({'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});
 for(const [k,v] of Object.entries(extraHeaders||{}))headers.set(k,String(v));
 return new Response(JSON.stringify(data),{status,headers});
}
async function body(req){try{return await req.json()}catch{return {}}}
function hasBindings(env){return !!(env && env.DB && env.KV)}
function assertSameOrigin(request){
 if(!['POST','PUT','PATCH','DELETE'].includes(request.method))return;
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)throw json({error:'Origine de la requête refusée.'},403);
}
function bytesToB64(bytes){let bin='';for(const b of bytes)bin+=String.fromCharCode(b);return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function b64ToBytes(value){const s=String(value||'').replace(/-/g,'+').replace(/_/g,'/');const padded=s+'='.repeat((4-s.length%4)%4);const bin=atob(padded);return Uint8Array.from(bin,c=>c.charCodeAt(0));}
function constantTimeEqual(a,b){
 const aa=new TextEncoder().encode(String(a||'')),bb=new TextEncoder().encode(String(b||''));
 let diff=aa.length^bb.length;const len=Math.max(aa.length,bb.length);
 for(let i=0;i<len;i++)diff|=(aa[i%Math.max(aa.length,1)]||0)^(bb[i%Math.max(bb.length,1)]||0);
 return diff===0;
}
function assertPasswordStrength(password){
 const p=String(password||'');
 if(p.length<8||p.length>128)return 'Le mot de passe doit contenir entre 8 et 128 caractères.';
 if(!/[a-z]/.test(p)||!/[A-Z]/.test(p)||!/[0-9]/.test(p)||!/[^A-Za-z0-9]/.test(p))return 'Le mot de passe doit contenir une minuscule, une majuscule, un chiffre et un caractère spécial.';
 return '';
}
async function derivePassword(password,salt,iterations=PASSWORD_ITERATIONS){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(String(password||'')),{name:'PBKDF2'},false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations},key,256);
 return new Uint8Array(bits);
}
async function hashPassword(password){
 const salt=crypto.getRandomValues(new Uint8Array(16));
 const hash=await derivePassword(password,salt,PASSWORD_ITERATIONS);
 return `pbkdf2_sha256$${PASSWORD_ITERATIONS}$${bytesToB64(salt)}$${bytesToB64(hash)}`;
}
async function verifyPassword(password,stored){
 const raw=String(stored||'');
 const parts=raw.split('$');
 if(parts.length===4&&parts[0]==='pbkdf2_sha256'){
  const iterations=Number(parts[1]);
  if(!Number.isInteger(iterations)||iterations<100000||iterations>1000000)return {ok:false,needsUpgrade:false};
  try{
   const actual=await derivePassword(password,b64ToBytes(parts[2]),iterations);
   const expected=b64ToBytes(parts[3]);
   let diff=actual.length^expected.length;const len=Math.max(actual.length,expected.length);
   for(let i=0;i<len;i++)diff|=(actual[i%Math.max(actual.length,1)]||0)^(expected[i%Math.max(expected.length,1)]||0);
   return {ok:diff===0,needsUpgrade:diff===0&&iterations<PASSWORD_ITERATIONS};
  }catch{return {ok:false,needsUpgrade:false};}
 }
 // Compatibilité de migration : ancien mot de passe en clair, immédiatement rehaché après une connexion réussie.
 const ok=constantTimeEqual(password,raw);
 return {ok,needsUpgrade:ok};
}
async function sha256Hex(value){const d=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(value||''))));return Array.from(d,b=>b.toString(16).padStart(2,'0')).join('');}
function clientIp(request){return request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';}
async function rateKeys(request,login){
 const account=await sha256Hex(norm(login));const ip=await sha256Hex(clientIp(request));
 return {account:`login-limit:account:${account}`,ip:`login-limit:ip:${ip}`};
}
async function readRate(env,key){try{return JSON.parse(await env.KV.get(key)||'{}')}catch{return {}}}
async function checkLoginLimit(env,request,login){
 const keys=await rateKeys(request,login);const now=Math.floor(Date.now()/1000);
 for(const key of [keys.account,keys.ip]){const r=await readRate(env,key);if(Number(r.blockedUntil||0)>now)return {blocked:true,retryAfter:Number(r.blockedUntil)-now,keys};}
 return {blocked:false,retryAfter:0,keys};
}
async function bumpRate(env,key,limit){
 const now=Math.floor(Date.now()/1000);let r=await readRate(env,key);
 if(!r.windowStarted||now-Number(r.windowStarted)>LOGIN_WINDOW_SECONDS)r={count:0,windowStarted:now,blockedUntil:0};
 r.count=Number(r.count||0)+1;
 if(r.count>=limit)r.blockedUntil=now+LOGIN_BLOCK_SECONDS;
 await env.KV.put(key,JSON.stringify(r),{expirationTtl:Math.max(LOGIN_WINDOW_SECONDS,LOGIN_BLOCK_SECONDS)+60});
 return r;
}
async function recordLoginFailure(env,request,login){
 const keys=await rateKeys(request,login);const [a,i]=await Promise.all([bumpRate(env,keys.account,LOGIN_ACCOUNT_LIMIT),bumpRate(env,keys.ip,LOGIN_IP_LIMIT)]);const now=Math.floor(Date.now()/1000);
 return Math.max(0,Number(a.blockedUntil||0)-now,Number(i.blockedUntil||0)-now);
}
async function clearAccountLoginFailures(env,request,login){const keys=await rateKeys(request,login);await env.KV.delete(keys.account);}
function parseCookies(request){const out={};for(const part of String(request.headers.get('cookie')||'').split(';')){const i=part.indexOf('=');if(i>0)out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim());}return out;}
function sessionCookie(request,token){const secure=new URL(request.url).protocol==='https:'?'; Secure':'';return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL}`;}
function clearSessionCookie(request){const secure=new URL(request.url).protocol==='https:'?'; Secure':'';return `${SESSION_COOKIE}=; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=0`;}
function superLogin(env){return String(env.SUPER_ADMIN_LOGIN||'').trim();}
function superSessionVersion(env){return String(env.SUPER_ADMIN_SESSION_VERSION||'').trim();}
function ensureSuperSecrets(env){return !!(superLogin(env)&&String(env.SUPER_ADMIN_PASSWORD||'')&&superSessionVersion(env));}
function loginReserved(env,login){return !!superLogin(env)&&norm(login)===norm(superLogin(env));}
async function loginExists(env,login,exclude={}){
 const b=await env.DB.prepare('SELECT id FROM banks WHERE login=? AND id<>? LIMIT 1').bind(login,String(exclude.bankId||'')).first();if(b)return true;
 const u=await env.DB.prepare('SELECT id FROM users WHERE login=? AND id<>? LIMIT 1').bind(login,String(exclude.userId||'')).first();return !!u;
}
async function ensureSchema(env){if(schemaReady)return; await env.DB.exec(SCHEMA); const bankCols=[
  "email TEXT DEFAULT ''","slogan TEXT DEFAULT ''","logo TEXT DEFAULT ''","stamp TEXT DEFAULT ''","signature TEXT DEFAULT ''",
  "primary_color TEXT DEFAULT '#003b3b'","secondary_color TEXT DEFAULT '#e7ad2f'",
  "footer_text TEXT DEFAULT 'Document généré automatiquement'","legal_mentions TEXT DEFAULT ''","cga_conditions TEXT DEFAULT ''",
  "currency TEXT DEFAULT 'FCFA'","country TEXT DEFAULT ''","city TEXT DEFAULT ''",
  "subscription_started_at TEXT","subscription_expires_at TEXT","subscription_updated_at TEXT","auth_version INTEGER NOT NULL DEFAULT 1"
 ]; for(const col of bankCols){try{await env.DB.exec('ALTER TABLE banks ADD COLUMN '+col)}catch(e){}}
 try{await env.DB.prepare("UPDATE banks SET subscription=CASE WHEN lower(COALESCE(subscription,'')) LIKE '%business%' THEN 'BUSINESS' ELSE 'FREE' END WHERE COALESCE(subscription,'')<>''").run();}catch(e){}
 try{await env.DB.prepare("UPDATE banks SET subscription='FREE' WHERE COALESCE(subscription,'')=''").run();}catch(e){}
 try{await env.DB.prepare("UPDATE banks SET subscription_started_at=COALESCE(NULLIF(subscription_started_at,''),created_at,datetime('now'))").run();}catch(e){}
 try{await env.DB.prepare("UPDATE banks SET subscription_expires_at=CASE WHEN COALESCE(subscription_expires_at,'')='' THEN datetime(COALESCE(subscription_started_at,created_at,datetime('now')), CASE WHEN subscription='BUSINESS' THEN '+365 days' ELSE '+20 days' END) ELSE subscription_expires_at END").run();}catch(e){}
 try{await env.DB.prepare("UPDATE banks SET subscription_updated_at=COALESCE(NULLIF(subscription_updated_at,''),subscription_started_at,created_at,datetime('now'))").run();}catch(e){}
 try{await env.DB.exec('CREATE TABLE IF NOT EXISTS security_logs (id TEXT PRIMARY KEY,bank_id TEXT NOT NULL,action TEXT,section TEXT,result TEXT,agent TEXT,created_at TEXT NOT NULL DEFAULT (datetime(\'now\')))')}catch(e){} const accountCols=['credit_fee REAL DEFAULT 0','credit_carnet_fee REAL DEFAULT 0','credit_amount REAL DEFAULT 0','credit_rate REAL DEFAULT 0','credit_duration INTEGER DEFAULT 0','credit_monthly REAL DEFAULT 0','credit_due_count INTEGER DEFAULT 0','credit_penalty_rate REAL DEFAULT 0','credit_total REAL DEFAULT 0',"credit_choice TEXT DEFAULT \"\"",'is_blocked INTEGER NOT NULL DEFAULT 0',"block_reason TEXT DEFAULT ''",'is_deleted INTEGER NOT NULL DEFAULT 0']; for(const col of accountCols){try{await env.DB.exec('ALTER TABLE accounts ADD COLUMN '+col)}catch(e){}} const obligationCols=["base_type TEXT DEFAULT 'Bénéfice général'","base_item TEXT DEFAULT ''"]; for(const col of obligationCols){try{await env.DB.exec('ALTER TABLE obligations ADD COLUMN '+col)}catch(e){}} for(const col of ['is_active INTEGER NOT NULL DEFAULT 1']){try{await env.DB.exec('ALTER TABLE account_types ADD COLUMN '+col)}catch(e){} try{await env.DB.exec('ALTER TABLE movement_types ADD COLUMN '+col)}catch(e){}} const movementTypeCols=["category TEXT DEFAULT ''",'is_bank_revenue INTEGER',"description TEXT DEFAULT ''"]; for(const col of movementTypeCols){try{await env.DB.exec('ALTER TABLE movement_types ADD COLUMN '+col)}catch(e){}} for(const col of ['is_blocked INTEGER NOT NULL DEFAULT 0','is_deleted INTEGER NOT NULL DEFAULT 0',"client_type TEXT DEFAULT 'personne_physique'","client_details TEXT DEFAULT ''","photo_logo TEXT DEFAULT ''"]){try{await env.DB.exec('ALTER TABLE clients ADD COLUMN '+col)}catch(e){}}
 const userCols=["status TEXT NOT NULL DEFAULT 'Actif'","permissions TEXT DEFAULT '[]'","last_login TEXT DEFAULT ''","auth_version INTEGER NOT NULL DEFAULT 1"]; for(const col of userCols){try{await env.DB.exec('ALTER TABLE users ADD COLUMN '+col)}catch(e){}}
 const moveCols=["created_by TEXT DEFAULT ''","created_by_role TEXT DEFAULT ''"]; for(const col of moveCols){try{await env.DB.exec('ALTER TABLE moves ADD COLUMN '+col)}catch(e){}}
 const secCols=["role TEXT DEFAULT ''","motif TEXT DEFAULT ''","user_id TEXT DEFAULT ''"]; for(const col of secCols){try{await env.DB.exec('ALTER TABLE security_logs ADD COLUMN '+col)}catch(e){}}
 try{await env.DB.exec(`CREATE TABLE IF NOT EXISTS security_logs (id TEXT PRIMARY KEY,bank_id TEXT NOT NULL,action TEXT,section TEXT,result TEXT,agent TEXT,role TEXT DEFAULT '',motif TEXT DEFAULT '',user_id TEXT DEFAULT '',created_at TEXT NOT NULL DEFAULT (datetime('now')))`)}catch(e){}
 for(const sql of [
  'CREATE INDEX IF NOT EXISTS idx_clients_bank ON clients(bank_id)',
  'CREATE INDEX IF NOT EXISTS idx_accounts_bank ON accounts(bank_id)',
  'CREATE INDEX IF NOT EXISTS idx_moves_bank ON moves(bank_id)',
  'CREATE INDEX IF NOT EXISTS idx_users_bank ON users(bank_id)',
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_login_global ON users(login) WHERE login IS NOT NULL AND login<>''"
 ]){try{await env.DB.exec(sql)}catch(e){}}
 schemaReady=true;}

async function managementSettings(env,bankId){
 const now=new Date();
 let row=await env.DB.prepare('SELECT * FROM management_settings WHERE bank_id=?').bind(bankId).first();
 if(!row){row={bank_id:bankId,year:now.getFullYear(),month:now.getMonth()+1,status:'open'};try{await env.DB.prepare('INSERT INTO management_settings(bank_id,year,month,status) VALUES(?,?,?,?)').bind(bankId,row.year,row.month,row.status).run();}catch(e){}}
 return row;
}
async function rejectIfExerciseClosed(env,bankId){const s=await managementSettings(env,bankId);const st=String(s.status||'open').toLowerCase();if(st==='locked'||st==='closed')throw json({error:'Exercice '+(st==='locked'?'verrouillé':'clôturé')+' : modification impossible. Consultation et impression restent autorisées.'},403);}

async function addLog(env,bankId,message){await env.DB.prepare('INSERT INTO logs(id,bank_id,message) VALUES(?,?,?)').bind(uid('LOG'),bankId,message).run();}
function canonicalRole(v){const n=norm(v);if(n.includes('super'))return 'super_admin';if(n.includes('administrateur')||n==='admin'||n.includes('admin banque'))return 'admin_bank';if(n.includes('caisse')||n.includes('caissier'))return 'agent_caisse';if(n.includes('credit'))return 'agent_credit';if(n.includes('audit')||n.includes('consult'))return 'auditeur';return 'admin_bank';}
function roleLabel(v){const k=canonicalRole(v);return {super_admin:'Super Admin',admin_bank:'Administrateur banque',agent_caisse:'Agent caisse',agent_credit:'Agent crédit',auditeur:'Agent consultation / auditeur'}[k]||'Administrateur banque';}
function parsePermissions(v){if(Array.isArray(v))return v.map(String);try{const x=JSON.parse(String(v||'[]'));return Array.isArray(x)?x.map(String):[]}catch(e){return String(v||'').split(',').map(x=>x.trim()).filter(Boolean)}}
function defaultPermissionsForRole(v){const k=canonicalRole(v);if(k==='agent_caisse'||k==='agent_credit'||k==='auditeur')return ['clients_view','clients_manage','comptes_view','comptes_manage','caisse','mouvements_view','credit','rapports_read','print'];return []}
function sessionPermissions(s){const k=sessionRoleKey(s);if(k==='super_admin'||k==='admin_bank')return ['ALL'];return Array.from(new Set([...defaultPermissionsForRole((s&&s.userRole)||''),'clients_view','clients_manage','comptes_view','comptes_manage']))}
function hasPermission(s,key){const p=sessionPermissions(s);return p.includes('ALL')||p.includes(key)}
function safePermissionsPayload(v,role){return defaultPermissionsForRole(role)}
async function addSecurityLog(env,bankId,ctx,action,section,result='autorisé',motif=''){
 try{await env.DB.prepare('INSERT INTO security_logs(id,bank_id,action,section,result,agent,role,motif,user_id) VALUES(?,?,?,?,?,?,?,?,?)').bind(uid('SEC'),bankId||'',String(action||''),String(section||''),String(result||''),String((ctx&&ctx.userName)||'Super Admin'),roleLabel((ctx&&ctx.userRole)||ctx?.role||''),String(motif||''),String((ctx&&ctx.userId)||'')).run();}catch(e){}
}
function sessionRoleKey(s){if(!s)return '';if(s.role==='super')return 'super_admin';return canonicalRole(s.userRole||'Administrateur banque');}
async function denyRole(env,bankId,s,action,section,motif){await addSecurityLog(env,bankId,s,action,section,'refusé',motif);return json({error:'Accès refusé. Vous n’avez pas l’autorisation d’ouvrir cette section.'},403)}
async function enforceRoleApiAccess(env,bankId,s,path,request){
 const key=sessionRoleKey(s); if(key==='super_admin'||key==='admin_bank')return null;
 const method=request.method;
 if(path==='/api/security/log'||path==='/api/logout')return null;
 if(method==='GET'&&path==='/api/me')return null;
 if(method==='GET')return null;
 const deny=(action,section,motif)=>denyRole(env,bankId,s,action,section,motif);
 if(path==='/api/client'&&method==='POST'){return null;}
 if(path==='/api/client/update'&&method==='POST'){return null;}
 if(path==='/api/client/delete'||path==='/api/account/delete'||path==='/api/move/delete'||path.includes('/delete')){
  return deny('Suppression refusée','Sécurité','Les agents n’ont aucun droit de suppression');
 }
 if(path==='/api/account'&&method==='POST'){return null;}
 if(path==='/api/move'&&method==='POST'){return null;}
 return deny('Action refusée','Sécurité',`Route non autorisée pour ce rôle : ${path}`);
}
async function createSession(env,payload){const token=crypto.randomUUID().replace(/-/g,'')+crypto.randomUUID().replace(/-/g,'');await env.KV.put('session:'+token,JSON.stringify({...payload,issuedAt:Date.now()}),{expirationTtl:SESSION_TTL});return token;}
async function getSession(req,env){
 const token=parseCookies(req)[SESSION_COOKIE]||'';if(!token)return null;
 const raw=await env.KV.get('session:'+token);if(!raw)return null;
 let s;try{s=JSON.parse(raw)}catch{await env.KV.delete('session:'+token);return null;}
 if(s.role==='super'){
  if(!ensureSuperSecrets(env)||String(s.authVersion||'')!==superSessionVersion(env)){await env.KV.delete('session:'+token);return null;}
  return {...s,token};
 }
 if(s.role!=='bank'||!s.bankId){await env.KV.delete('session:'+token);return null;}
 if(s.userId){
  const u=await env.DB.prepare('SELECT bank_id,name,login,role,status,auth_version FROM users WHERE id=? LIMIT 1').bind(s.userId).first();
  if(!u||String(u.bank_id)!==String(s.bankId)||String(u.status||'Actif')!=='Actif'||Number(u.auth_version||1)!==Number(s.authVersion||1)){await env.KV.delete('session:'+token);return null;}
  return {...s,userName:u.name||u.login,userLogin:u.login,userRole:u.role,token};
 }
 const b=await env.DB.prepare('SELECT id,manager,login,status,auth_version FROM banks WHERE id=? LIMIT 1').bind(s.bankId).first();
 if(!b||Number(b.auth_version||1)!==Number(s.authVersion||1)){await env.KV.delete('session:'+token);return null;}
 return {...s,userName:b.manager||'Administrateur banque',userLogin:b.login,userRole:'Administrateur banque',token};
}
async function requireSession(req,env){const s=await getSession(req,env);if(!s)throw json({error:'Session expirée. Reconnectez-vous.'},401,{'set-cookie':clearSessionCookie(req)});return s;}
function dbDateToDate(v){if(!v)return null;const raw=String(v).trim();if(!raw)return null;const iso=raw.includes('T')?raw:raw.replace(' ','T')+'Z';const d=new Date(iso);return isNaN(d.getTime())?null:d;}
function dbDateText(d){const z=n=>String(n).padStart(2,'0');return `${d.getUTCFullYear()}-${z(d.getUTCMonth()+1)}-${z(d.getUTCDate())} ${z(d.getUTCHours())}:${z(d.getUTCMinutes())}:${z(d.getUTCSeconds())}`;}
function addDaysDate(d,days){const x=new Date(d.getTime());x.setUTCDate(x.getUTCDate()+days);return x;}
function planCode(v){return norm(v).includes('business')?'BUSINESS':'FREE';}
function planDays(v){return planCode(v)==='BUSINESS'?BUSINESS_SUBSCRIPTION_DAYS:FREE_SUBSCRIPTION_DAYS;}
function subscriptionInfo(bank){
 const plan=planCode(bank&&bank.subscription); const start=dbDateToDate(bank&&bank.subscription_started_at)||dbDateToDate(bank&&bank.created_at)||new Date();
 const end=dbDateToDate(bank&&bank.subscription_expires_at)||addDaysDate(start,planDays(plan)); const now=new Date();
 const diff=end.getTime()-now.getTime(); const days=Math.max(0,Math.ceil(diff/86400000)); const expired=diff<0;
 return {subscription:plan,subscription_label:plan==='BUSINESS'?'Business':'Free',subscription_started_at:bank&&bank.subscription_started_at?bank.subscription_started_at:dbDateText(start),subscription_expires_at:bank&&bank.subscription_expires_at?bank.subscription_expires_at:dbDateText(end),days_remaining:days,subscription_state:expired?'Expiré':(bank&&bank.status==='Suspendu'?'Suspendu':'Actif'),expired};
}
async function requireActiveBankSubscription(env,bankId){
 const bank=await env.DB.prepare('SELECT id,status,subscription,subscription_started_at,subscription_expires_at,created_at FROM banks WHERE id=?').bind(bankId).first();
 if(!bank)throw json({error:'Banque introuvable.'},404);
 const sub=subscriptionInfo(bank);
 if(bank.status==='Suspendu')throw json({error:'Banque suspendue.'},403);
 if(sub.expired){try{await env.DB.prepare("UPDATE banks SET status='Expiré' WHERE id=? AND status<>'Suspendu'").bind(bankId).run();}catch(e){} throw json({error:'Abonnement expiré. Contactez le Super Admin pour activer la version Business.'},403);}
 return sub;
}
function bankListSelect(){return "SELECT id,name,manager,contact,address,login,status,subscription,subscription_started_at,subscription_expires_at,subscription_updated_at,created_at, CAST(MAX(0, (julianday(COALESCE(NULLIF(subscription_expires_at,''),created_at))-julianday('now')+0.9999)) AS INTEGER) AS days_remaining, CASE WHEN datetime(COALESCE(NULLIF(subscription_expires_at,''),created_at)) < datetime('now') THEN 'Expiré' WHEN status='Suspendu' THEN 'Suspendu' ELSE 'Actif' END AS subscription_state FROM banks ORDER BY created_at DESC";}

async function bankPayload(env,bankId,session={}){
 const bank=await env.DB.prepare('SELECT id,name,manager,contact,address,email,slogan,logo,stamp,signature,primary_color,secondary_color,footer_text,legal_mentions,cga_conditions,currency,country,city,login,status,subscription,subscription_started_at,subscription_expires_at,subscription_updated_at,created_at FROM banks WHERE id=?').bind(bankId).first();
 if(bank)Object.assign(bank,subscriptionInfo(bank));
 await seedDefaultCharges(env,bankId);
 await ensureCompanyAccount(env,bankId);
const clients=await env.DB.prepare("SELECT id,bank_id,name,contact,job,address,piece,client_type,client_details,photo_logo,is_blocked,is_deleted,created_at FROM clients WHERE bank_id=? AND COALESCE(is_deleted,0)=0 ORDER BY created_at DESC").bind(bankId).all();
 const accounts=await env.DB.prepare("SELECT * FROM accounts WHERE bank_id=? AND COALESCE(is_deleted,0)=0 AND lower(COALESCE(status,'actif')) NOT LIKE '%supprim%' AND lower(COALESCE(status,'actif')) NOT LIKE '%delete%' AND lower(COALESCE(status,'actif')) NOT LIKE '%desactiv%' AND lower(COALESCE(status,'actif')) NOT LIKE '%archive%' AND lower(COALESCE(status,'actif')) NOT LIKE '%ferme%' AND lower(COALESCE(status,'actif')) NOT LIKE '%clotur%' AND lower(COALESCE(status,'actif')) NOT LIKE '%inactif%' ORDER BY created_at DESC").bind(bankId).all();
 const moves=await env.DB.prepare("SELECT m.* FROM moves m JOIN accounts a ON a.id=m.account_id AND a.bank_id=m.bank_id WHERE m.bank_id=? AND COALESCE(a.is_deleted,0)=0 AND lower(COALESCE(a.status,'actif')) NOT LIKE '%supprim%' AND lower(COALESCE(a.status,'actif')) NOT LIKE '%delete%' AND lower(COALESCE(a.status,'actif')) NOT LIKE '%desactiv%' AND lower(COALESCE(a.status,'actif')) NOT LIKE '%archive%' AND lower(COALESCE(a.status,'actif')) NOT LIKE '%ferme%' AND lower(COALESCE(a.status,'actif')) NOT LIKE '%clotur%' AND lower(COALESCE(a.status,'actif')) NOT LIKE '%inactif%' ORDER BY m.created_at DESC LIMIT 1000").bind(bankId).all();
 const users=await env.DB.prepare('SELECT id,bank_id,name,login,role,status,permissions,last_login,created_at FROM users WHERE bank_id=? ORDER BY created_at DESC').bind(bankId).all();
 const logs=await env.DB.prepare('SELECT * FROM logs WHERE bank_id=? ORDER BY created_at DESC LIMIT 300').bind(bankId).all();
 const charge_bases=await env.DB.prepare('SELECT * FROM charge_bases WHERE bank_id=? ORDER BY created_at DESC').bind(bankId).all();
 const obligations=await env.DB.prepare('SELECT * FROM obligations WHERE bank_id=? ORDER BY created_at DESC').bind(bankId).all();
 const reset_requests=await env.DB.prepare('SELECT * FROM reset_requests WHERE bank_id=? ORDER BY created_at DESC LIMIT 100').bind(bankId).all();
 const account_types=await env.DB.prepare('SELECT * FROM account_types WHERE bank_id=? ORDER BY created_at DESC').bind(bankId).all();
 const movement_types=await env.DB.prepare('SELECT * FROM movement_types WHERE bank_id=? ORDER BY created_at DESC').bind(bankId).all();
 const manual_revenues=await env.DB.prepare('SELECT * FROM manual_revenues WHERE bank_id=? ORDER BY created_at DESC').bind(bankId).all();
 const ignored_revenues=await env.DB.prepare('SELECT * FROM ignored_revenues WHERE bank_id=? ORDER BY created_at DESC').bind(bankId).all();
 const management_settings=await managementSettings(env,bankId);
 const security_logs=await env.DB.prepare('SELECT * FROM security_logs WHERE bank_id=? ORDER BY created_at DESC LIMIT 200').bind(bankId).all();
 let payload={bank,user:{id:session.userId||'',name:session.userName||bank.manager||'Administrateur banque',login:session.userLogin||bank.login||'',role:roleLabel(session.userRole||'Administrateur banque'),role_key:sessionRoleKey(session),permissions:sessionPermissions(session),status:'Actif',last_login:session.lastLogin||''},clients:clients.results||[],accounts:accounts.results||[],moves:moves.results||[],users:users.results||[],logs:logs.results||[],charge_bases:charge_bases.results||[],obligations:obligations.results||[],reset_requests:reset_requests.results||[],account_types:account_types.results||[],movement_types:movement_types.results||[],manual_revenues:manual_revenues.results||[],ignored_revenues:ignored_revenues.results||[],security_logs:security_logs.results||[],management_settings};
 const rk=sessionRoleKey(session);
 if(!['super_admin','admin_bank'].includes(rk)){
  const perms=sessionPermissions(session);
  payload.users=[]; payload.security_logs=[]; payload.obligations=[]; payload.manual_revenues=[]; payload.ignored_revenues=[]; payload.charge_bases=[]; payload.logs=[];
  let allowedMoves=[];
  if(perms.includes('mouvements_view')) allowedMoves=payload.moves||[];
  else {
   const uid=String(session.userId||'');
   if(perms.includes('caisse')) allowedMoves=allowedMoves.concat((payload.moves||[]).filter(m=>String(m.created_by||'')===uid));
   if(perms.includes('credit')){
    const creditIds=new Set((payload.accounts||[]).filter(a=>norm(a.type).includes('credit')).map(a=>String(a.id)));
    allowedMoves=allowedMoves.concat((payload.moves||[]).filter(m=>creditIds.has(String(m.account_id||''))));
   }
  }
  const seen=new Set(); payload.moves=allowedMoves.filter(m=>{const id=String(m.id||'');if(seen.has(id))return false;seen.add(id);return true;});
 }
 return payload;
}
async function handleApi(request,env,path){
 try{
  if(request.method==='OPTIONS')return new Response(null,{status:204});
  assertSameOrigin(request);
  if(!hasBindings(env))return json({ok:false,error:'Bindings manquants : créez et liez une base D1 avec le nom DB, puis un KV avec le nom KV dans Cloudflare Pages > Settings > Functions > Bindings.'},500);
  await ensureSchema(env);
  if(path==='/api/status')return json({ok:true,cloudflare:true,d1:true,kv:true,message:'API connectée. D1 + KV actifs.'});
  if(path==='/api/register'&&request.method==='POST'){
   const b=await body(request);const login=String(b.login||'').trim(),password=String(b.pass||'');
   if(!b.name||!login||!password)return json({error:'Nom de banque, identifiant et mot de passe obligatoires.'},400);
   const weak=assertPasswordStrength(password);if(weak)return json({error:weak},400);
   if(loginReserved(env,login)||await loginExists(env,login))return json({error:'Identifiant déjà utilisé.'},409);
   const id=uid('BANK'),passHash=await hashPassword(password);
   await env.DB.prepare("INSERT INTO banks(id,name,manager,contact,address,email,city,country,login,pass,auth_version,status,subscription,subscription_started_at,subscription_expires_at,subscription_updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,1,?,?,datetime('now'),datetime('now','+20 days'),datetime('now'))").bind(id,b.name,b.manager||'',b.contact||'',b.address||'',b.email||'',b.city||'',b.country||'',login,passHash,'Actif','FREE').run();
   await ensureCompanyAccount(env,id);await addLog(env,id,'Banque inscrite en version Free — 20 jours');return json({ok:true,id,subscription:'FREE'});
  }
  if(path==='/api/login'&&request.method==='POST'){
   const b=await body(request);const login=String(b.login||'').trim(),password=String(b.pass||'');
   if(!login||!password)return json({error:'Identifiant ou mot de passe incorrect.'},401);
   const limit=await checkLoginLimit(env,request,login);if(limit.blocked)return json({error:'Trop de tentatives. Réessayez plus tard.',retry_after:limit.retryAfter},429,{'retry-after':limit.retryAfter});
   const failure=async()=>{const retry=await recordLoginFailure(env,request,login);return json({error:retry>0?'Trop de tentatives. Réessayez plus tard.':'Identifiant ou mot de passe incorrect.',...(retry>0?{retry_after:retry}:{})},retry>0?429:401,retry>0?{'retry-after':retry}:{});};
   if(ensureSuperSecrets(env)&&norm(login)===norm(superLogin(env))){
    if(!constantTimeEqual(password,String(env.SUPER_ADMIN_PASSWORD||'')))return failure();
    await clearAccountLoginFailures(env,request,login);
    const ctx={role:'super',userRole:'Super Admin',userName:'Super Admin',authVersion:superSessionVersion(env)};const token=await createSession(env,ctx);
    return json({ok:true,role:'super',user:{name:'Super Admin',role:'Super Admin'}},200,{'set-cookie':sessionCookie(request,token)});
   }
   const bank=await env.DB.prepare('SELECT * FROM banks WHERE login=? LIMIT 1').bind(login).first();
   if(bank){
    const verified=await verifyPassword(password,bank.pass);if(!verified.ok)return failure();
    if(verified.needsUpgrade){const upgraded=await hashPassword(password);await env.DB.prepare('UPDATE banks SET pass=? WHERE id=?').bind(upgraded,bank.id).run();}
    if(bank.status==='Suspendu')return json({error:'Banque suspendue.'},403);const sub=subscriptionInfo(bank);if(sub.expired){try{await env.DB.prepare("UPDATE banks SET status='Expiré' WHERE id=? AND status<>'Suspendu'").bind(bank.id).run();}catch(e){}await addSecurityLog(env,bank.id,{userName:bank.manager||'Administrateur banque',userRole:'Administrateur banque'},'Connexion refusée','Connexion','refusé','Abonnement expiré');return json({error:'Abonnement expiré. Contactez le Super Admin pour activer la version Business.'},403);}
    await clearAccountLoginFailures(env,request,login);const ctx={role:'bank',bankId:bank.id,userRole:'Administrateur banque',userName:bank.manager||'Administrateur banque',userLogin:bank.login,userId:'',authVersion:Number(bank.auth_version||1)};const token=await createSession(env,ctx);
    await addLog(env,bank.id,'Connexion administrateur');await addSecurityLog(env,bank.id,ctx,'Connexion','Connexion','autorisé','');return json({ok:true,role:'bank',bankId:bank.id,user:{name:ctx.userName,role:roleLabel(ctx.userRole)},subscription:sub.subscription,days_remaining:sub.days_remaining},200,{'set-cookie':sessionCookie(request,token)});
   }
   const candidates=(await env.DB.prepare('SELECT u.*,b.status AS bank_status,b.subscription,b.subscription_started_at,b.subscription_expires_at,b.created_at AS bank_created_at FROM users u JOIN banks b ON b.id=u.bank_id WHERE u.login=? LIMIT 2').bind(login).all()).results||[];
   if(candidates.length!==1)return failure();const user=candidates[0];const verified=await verifyPassword(password,user.pass);if(!verified.ok)return failure();
   if(verified.needsUpgrade){const upgraded=await hashPassword(password);await env.DB.prepare('UPDATE users SET pass=? WHERE id=? AND bank_id=?').bind(upgraded,user.id,user.bank_id).run();}
   if(String(user.status||'Actif')!=='Actif')return json({error:'Utilisateur bloqué. Contactez l’administrateur.'},403);if(user.bank_status==='Suspendu')return json({error:'Banque suspendue.'},403);
   const bankForSub={status:user.bank_status,subscription:user.subscription,subscription_started_at:user.subscription_started_at,subscription_expires_at:user.subscription_expires_at,created_at:user.bank_created_at};const sub=subscriptionInfo(bankForSub);if(sub.expired)return json({error:'Abonnement expiré. Contactez le Super Admin pour activer la version Business.'},403);
   await clearAccountLoginFailures(env,request,login);await env.DB.prepare("UPDATE users SET last_login=datetime('now') WHERE id=? AND bank_id=?").bind(user.id,user.bank_id).run();const ctx={role:'bank',bankId:user.bank_id,userRole:user.role||'Agent consultation / auditeur',userName:user.name||user.login,userLogin:user.login,userId:user.id,userPermissions:safePermissionsPayload(user.permissions,user.role||'Agent consultation / auditeur'),lastLogin:new Date().toISOString(),authVersion:Number(user.auth_version||1)};const token=await createSession(env,ctx);
   await addSecurityLog(env,user.bank_id,ctx,'Connexion','Connexion','autorisé','');await addLog(env,user.bank_id,'Connexion utilisateur : '+(user.name||user.login)+' ('+roleLabel(user.role)+')');return json({ok:true,role:'bank',bankId:user.bank_id,user:{id:user.id,name:user.name||user.login,role:roleLabel(user.role),permissions:safePermissionsPayload(user.permissions,user.role)},subscription:sub.subscription,days_remaining:sub.days_remaining},200,{'set-cookie':sessionCookie(request,token)});
  }

  if(path==='/api/password-forgot'&&request.method==='POST'){
   const p=await body(request); const login=String(p.login||'').trim();
   if(!login)return json({error:'Identifiant obligatoire.'},400);
   const bank=await env.DB.prepare('SELECT id,name,manager,login FROM banks WHERE login=? LIMIT 1').bind(login).first();
   if(bank){
    await env.DB.prepare('INSERT INTO reset_requests(id,bank_id,user_id,message,status) VALUES(?,?,?,?,?)').bind(uid('RST'),bank.id,'','Demande de réinitialisation du mot de passe Administrateur banque pour '+(bank.name||bank.login)+' — traitement réservé au Super Admin','En attente Super Admin').run();
    await addSecurityLog(env,bank.id,{userName:bank.manager||'Administrateur banque',userRole:'Administrateur banque'},'Demande mot de passe oublié','Connexion','autorisé','Administrateur banque');
    return json({ok:true,message:'Demande enregistrée.'});
   }
   const user=await env.DB.prepare('SELECT u.id,u.bank_id,u.name,u.login,u.role,b.name AS bank_name FROM users u JOIN banks b ON b.id=u.bank_id WHERE u.login=? LIMIT 1').bind(login).first();
   if(user){
    const rkey=canonicalRole(user.role||'');
    const status=rkey==='admin_bank'?'En attente Super Admin':'En attente Administrateur';
    const msg=(rkey==='admin_bank')
      ? 'Demande de réinitialisation du mot de passe Administrateur banque pour '+(user.bank_name||user.bank_id)+' — traitement réservé au Super Admin'
      : 'Demande de réinitialisation du mot de passe pour '+(user.name||user.login)+' ('+roleLabel(user.role)+') — traitement par l’Administrateur banque';
    await env.DB.prepare('INSERT INTO reset_requests(id,bank_id,user_id,message,status) VALUES(?,?,?,?,?)').bind(uid('RST'),user.bank_id,user.id,msg,status).run();
    await addSecurityLog(env,user.bank_id,{userName:user.name||user.login,userRole:user.role,userId:user.id},'Demande mot de passe oublié','Connexion','autorisé','');
    return json({ok:true,message:'Demande enregistrée.'});
   }
   try{await env.DB.prepare('INSERT INTO security_logs(id,bank_id,action,section,result,agent,role,motif) VALUES(?,?,?,?,?,?,?,?)').bind(uid('SEC'),'','Demande mot de passe oublié','Connexion','refusé',login,'Inconnu','Identifiant introuvable').run();}catch(e){}
   return json({ok:true,message:'Demande enregistrée.'});
  }

  if(path==='/api/logout'&&request.method==='POST'){const current=await getSession(request,env);if(current)await env.KV.delete('session:'+current.token);return json({ok:true},200,{'set-cookie':clearSessionCookie(request)});}
  const s=await requireSession(request,env);
  if((path==='/api/me'||path==='/api/load')&&request.method==='GET'){
   if(s.role==='super'){const banks=await env.DB.prepare(bankListSelect()).all();const users=await env.DB.prepare('SELECT u.id,u.bank_id,u.name,u.login,u.role,u.status,u.last_login,u.created_at,b.name AS bank_name FROM users u LEFT JOIN banks b ON b.id=u.bank_id ORDER BY u.created_at DESC LIMIT 500').all();return json({role:'super',banks:banks.results||[],users:users.results||[]});}
   await requireActiveBankSubscription(env,s.bankId);return json({role:'bank',...(await bankPayload(env,s.bankId,s))});
  }
  if(path==='/api/save'&&request.method==='POST'){
   if(s.role!=='bank'||sessionRoleKey(s)!=='admin_bank')return json({error:'Enregistrement global réservé à l’Administrateur banque.'},403);
   const payload=await body(request);if(payload.bank_id&&String(payload.bank_id)!==String(s.bankId))return json({error:'Accès inter-entreprise interdit.'},403);
   const ms=payload.management_settings;if(!ms)return json({error:'La sauvegarde globale des données sensibles est désactivée. Utilisez les routes métier sécurisées.'},400);
   const y=Number(ms.year||new Date().getFullYear()),m=Number(ms.month||new Date().getMonth()+1),status=String(ms.status||'open').toLowerCase();if(!y||m<1||m>12||!['open','locked','closed'].includes(status))return json({error:'Paramètres de gestion invalides.'},400);
   await env.DB.prepare("INSERT INTO management_settings(bank_id,year,month,status,updated_at) VALUES(?,?,?,?,datetime('now')) ON CONFLICT(bank_id) DO UPDATE SET year=excluded.year,month=excluded.month,status=excluded.status,updated_at=datetime('now')").bind(s.bankId,y,m,status).run();return json({ok:true});
  }
  if(path.startsWith('/api/super/')||path==='/api/bank/action'){if(s.role!=='super')return json({error:'Action réservée au Super Admin.'},403);}
  if(path==='/api/super/user'&&request.method==='POST'&&s.role==='super'){
   return json({error:'La création des utilisateurs est réservée à l’Administrateur banque.'},403);
  }
  if(path==='/api/super/user/toggle'&&request.method==='POST'&&s.role==='super'){
   return json({error:'Le blocage/déblocage des utilisateurs de banque est réservé à l’Administrateur banque.'},403);
  }
  if(path==='/api/super/user/reset'&&request.method==='POST'&&s.role==='super'){
   const u=await body(request); const row=await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(u.id).first();
   if(!row)return json({error:'Utilisateur introuvable.'},404);
   if(canonicalRole(row.role)!=='admin_bank')return json({error:'Le Super Admin réinitialise uniquement le mot de passe Administrateur banque. Les agents sont gérés par l’Administrateur banque.'},403);
   const password=String(u.newpass||'');const weak=assertPasswordStrength(password);if(weak)return json({error:weak},400);const passHash=await hashPassword(password);await env.DB.prepare('UPDATE users SET pass=?,auth_version=COALESCE(auth_version,1)+1 WHERE id=?').bind(passHash,u.id).run();
   await addSecurityLog(env,row.bank_id,{role:'super',userRole:'Super Admin',userName:'Super Admin'},'Réinitialisation mot de passe Administrateur banque','Super Admin','autorisé','');
   return json({ok:true});
  }
  if(path==='/api/bank/action'&&request.method==='POST'&&s.role==='super'){
   const b=await body(request);const bank=await env.DB.prepare('SELECT id,status FROM banks WHERE id=?').bind(String(b.id||'')).first();if(!bank)return json({error:'Banque introuvable.'},404);
   if(b.action==='toggle'){await env.DB.prepare('UPDATE banks SET status=? WHERE id=?').bind(bank.status==='Actif'?'Suspendu':'Actif',bank.id).run();}
   else if(b.action==='activate_business'||b.action==='business'){await env.DB.prepare("UPDATE banks SET subscription='BUSINESS',subscription_started_at=datetime('now'),subscription_expires_at=datetime('now','+365 days'),subscription_updated_at=datetime('now'),status='Actif' WHERE id=?").bind(bank.id).run();await addLog(env,bank.id,'Version Business activée pour 365 jours par le Super Admin');}
   else if(b.action==='reset'){const password=String(b.newpass||'');const weak=assertPasswordStrength(password);if(weak)return json({error:weak},400);const passHash=await hashPassword(password);await env.DB.prepare('UPDATE banks SET pass=?,auth_version=COALESCE(auth_version,1)+1 WHERE id=?').bind(passHash,bank.id).run();await addSecurityLog(env,bank.id,s,'Réinitialisation mot de passe Administrateur banque','Super Admin','autorisé','Toutes les sessions précédentes invalidées');}
   else if(b.action==='delete'){
    const id=bank.id;await env.DB.batch([
     env.DB.prepare('DELETE FROM moves WHERE bank_id=?').bind(id),env.DB.prepare('DELETE FROM accounts WHERE bank_id=?').bind(id),env.DB.prepare('DELETE FROM clients WHERE bank_id=?').bind(id),env.DB.prepare('DELETE FROM users WHERE bank_id=?').bind(id),env.DB.prepare('DELETE FROM logs WHERE bank_id=?').bind(id),env.DB.prepare('DELETE FROM security_logs WHERE bank_id=?').bind(id),env.DB.prepare('DELETE FROM charge_bases WHERE bank_id=?').bind(id),env.DB.prepare('DELETE FROM obligations WHERE bank_id=?').bind(id),env.DB.prepare('DELETE FROM reset_requests WHERE bank_id=?').bind(id),env.DB.prepare('DELETE FROM account_types WHERE bank_id=?').bind(id),env.DB.prepare('DELETE FROM movement_types WHERE bank_id=?').bind(id),env.DB.prepare('DELETE FROM manual_revenues WHERE bank_id=?').bind(id),env.DB.prepare('DELETE FROM ignored_revenues WHERE bank_id=?').bind(id),env.DB.prepare('DELETE FROM management_settings WHERE bank_id=?').bind(id),env.DB.prepare('DELETE FROM banks WHERE id=?').bind(id)
    ]);
   }else return json({error:'Action inconnue.'},400);
   return json({ok:true});
  }
  if(s.role!=='bank')return json({error:'Action réservée à une banque.'},403); const bankId=s.bankId; await requireActiveBankSubscription(env,bankId);
  const roleDenied=await enforceRoleApiAccess(env,bankId,s,path,request); if(roleDenied)return roleDenied;

  if(path==='/api/admin/verify-password'&&request.method==='POST'){
   if(sessionRoleKey(s)!=='admin_bank')return json({error:'Action réservée à l’Administrateur banque.'},403);
   const p=await body(request);const password=String(p.password||'');const row=await env.DB.prepare('SELECT pass FROM banks WHERE id=?').bind(bankId).first();const verified=row?await verifyPassword(password,row.pass):{ok:false};
   if(verified.ok){if(verified.needsUpgrade){const upgraded=await hashPassword(password);await env.DB.prepare('UPDATE banks SET pass=? WHERE id=?').bind(upgraded,bankId).run();}if(p.action)try{await env.DB.prepare('INSERT INTO security_logs(id,bank_id,action,section,result,agent,role,motif,user_id) VALUES(?,?,?,?,?,?,?,?,?)').bind(uid('SEC'),bankId,String(p.action||''),String(p.section||''),String(p.result||'autorisé'),String(p.agent||s.userName||'Administrateur'),roleLabel(s.userRole||'Administrateur banque'),String(p.motif||''),String(s.userId||'')).run();}catch(e){}return json({ok:true});}
   return json({error:'Mot de passe administrateur incorrect.'},403);
  }

  if(path==='/api/security/log'&&request.method==='POST'){
   const g=await body(request);
   await env.DB.prepare('INSERT INTO security_logs(id,bank_id,action,section,result,agent,role,motif,user_id) VALUES(?,?,?,?,?,?,?,?,?)').bind(uid('SEC'),bankId,String(g.action||''),String(g.section||''),String(g.result||''),String(g.agent||s.userName||'Administrateur'),roleLabel(s.userRole||'Administrateur banque'),String(g.motif||''),String(s.userId||'')).run();
   await addLog(env,bankId,'Sécurité : '+String(g.action||'action')+' — '+String(g.result||'journalisée'));
   return json({ok:true});
  }

  if(path==='/api/management/settings'&&request.method==='POST'){
   const g=await body(request); const y=Number(g.year||new Date().getFullYear()), m=Number(g.month||1); const current=await managementSettings(env,bankId); const status=String(g.status||current.status||'open').toLowerCase();
   if(!y||m<1||m>12)return json({error:'Année ou mois invalide.'},400);
   await env.DB.prepare("INSERT INTO management_settings(bank_id,year,month,status,updated_at) VALUES(?,?,?,?,datetime('now')) ON CONFLICT(bank_id) DO UPDATE SET year=excluded.year,month=excluded.month,status=excluded.status,updated_at=datetime('now')").bind(bankId,y,m,['open','locked','closed'].includes(status)?status:'open').run();
   await addLog(env,bankId,'Gestion appliquée : '+m+'/'+y+' - '+status); return json({ok:true});
  }
  if(path==='/api/management/status'&&request.method==='POST'){
   const g=await body(request); const current=await managementSettings(env,bankId); const status=String(g.status||'open').toLowerCase(); if(!['open','locked','closed'].includes(status))return json({error:'État invalide.'},400);
   await env.DB.prepare("INSERT INTO management_settings(bank_id,year,month,status,updated_at) VALUES(?,?,?,?,datetime('now')) ON CONFLICT(bank_id) DO UPDATE SET status=excluded.status,updated_at=datetime('now')").bind(bankId,Number(current.year||new Date().getFullYear()),Number(current.month||new Date().getMonth()+1),status).run();
   await addLog(env,bankId,'État de l’exercice : '+status); return json({ok:true});
  }


  if(path==='/api/bank/update'&&request.method==='POST'){
   if(sessionRoleKey(s)!=='admin_bank')return json({error:'Action réservée à l’Administrateur banque.'},403);
   const b=await body(request);const current=await env.DB.prepare('SELECT * FROM banks WHERE id=?').bind(bankId).first();if(!current)return json({error:'Banque introuvable.'},404);
   const name=String(b.name||'').trim(),manager=String(b.manager||'').trim(),contact=String(b.contact||'').trim(),address=String(b.address||'').trim(),login=String(b.login||current.login||'').trim(),logo=String(b.logo||'');
   if(!name)return json({error:'Nom de banque obligatoire.'},400);if(!manager)return json({error:'Responsable obligatoire.'},400);if(!contact)return json({error:'Contact obligatoire.'},400);if(!address)return json({error:'Adresse obligatoire.'},400);if(!login)return json({error:'Identifiant obligatoire.'},400);
   const passwordChanged=String(b.pass||'')!=='';const sensitive=String(current.name||'').trim()!==name||String(current.manager||'').trim()!==manager||String(current.login||'').trim()!==login||passwordChanged||String(current.logo||'')!==logo||String(current.stamp||'')!==String(b.stamp||'')||String(current.signature||'')!==String(b.signature||'');
   if(sensitive){const adminPassword=String(b.admin_password||'');const verified=await verifyPassword(adminPassword,current.pass);if(!verified.ok){await addSecurityLog(env,bankId,s,'changement profil banque','Profil banque','refusé','Mot de passe administrateur incorrect ou absent');return json({error:'Mot de passe incorrect. Action refusée.'},403);}}
   if(loginReserved(env,login)||await loginExists(env,login,{bankId}))return json({error:'Identifiant déjà utilisé.'},409);
   let passHash=current.pass;if(passwordChanged){const weak=assertPasswordStrength(String(b.pass));if(weak)return json({error:weak},400);passHash=await hashPassword(String(b.pass));}
   const nextVersion=Number(current.auth_version||1)+(passwordChanged?1:0);
   await env.DB.prepare('UPDATE banks SET name=?,manager=?,contact=?,address=?,email=?,slogan=?,logo=?,stamp=?,signature=?,primary_color=?,secondary_color=?,footer_text=?,legal_mentions=?,currency=?,country=?,city=?,login=?,pass=?,auth_version=? WHERE id=?')
    .bind(name,manager,contact,address,String(b.email||''),String(b.slogan||''),logo,String(b.stamp||''),String(b.signature||''),String(b.primary_color||'#003b3b'),String(b.secondary_color||'#e7ad2f'),String(b.footer_text||'Document généré automatiquement'),String(b.legal_mentions||''),String(b.currency||'FCFA'),String(b.country||''),String(b.city||''),login,passHash,nextVersion,bankId).run();
   await addSecurityLog(env,bankId,s,'changement profil banque','Profil banque','autorisé',passwordChanged?'Mot de passe modifié et anciennes sessions invalidées':(sensitive?'Modification sensible validée':'Modification simple'));await addLog(env,bankId,'Profil banque modifié');await ensureCompanyAccount(env,bankId);
   if(passwordChanged){await env.KV.delete('session:'+s.token);const token=await createSession(env,{...s,token:undefined,userName:manager,userLogin:login,authVersion:nextVersion});return json({ok:true,session_renewed:true},200,{'set-cookie':sessionCookie(request,token)});}
   return json({ok:true});
  }


  if(path==='/api/settings/cga'&&request.method==='POST'){
   const g=await body(request);
   const html=String(g.cga_conditions||'');
   await env.DB.prepare('UPDATE banks SET cga_conditions=? WHERE id=?').bind(html,bankId).run();
   await addLog(env,bankId,'Fiche condition générale d’adhésion modifiée');
   await addSecurityLog(env,bankId,s,'modification fiche CGA','Paramètres','autorisé','Conditions générales d’adhésion enregistrées');
   return json({ok:true});
  }

  if(path==='/api/client'&&request.method==='POST'){
   const c=await body(request); const name=String(c.name||c.nomAffiche||'').trim();
   if(!name)return json({error:'Nom obligatoire.'},400);
   const clientType=String(c.client_type||c.typeClient||'personne_physique');
   const details=typeof c.client_details==='string'?c.client_details:JSON.stringify(c.client_details||{});
   await env.DB.prepare('INSERT INTO clients(id,bank_id,name,contact,job,address,piece,pass,client_type,client_details,photo_logo,is_blocked,is_deleted) VALUES(?,?,?,?,?,?,?,?,?,?,?,0,0)').bind(uid('CL'),bankId,name,c.contact||'',c.job||'',c.address||'',c.piece||'',c.pass||'',clientType,details,c.photo_logo||'').run();
   await addLog(env,bankId,'Nouveau client ajouté : '+name); return json({ok:true});
  }
  if(path==='/api/client/update'&&request.method==='POST'){
   const c=await body(request); if(!c.id)return json({error:'Client obligatoire.'},400); const name=String(c.name||c.nomAffiche||'').trim(); if(!name)return json({error:'Nom obligatoire.'},400);
   const clientType=String(c.client_type||c.typeClient||'personne_physique');
   const details=typeof c.client_details==='string'?c.client_details:JSON.stringify(c.client_details||{});
   await env.DB.prepare('UPDATE clients SET name=?,contact=?,job=?,address=?,piece=?,client_type=?,client_details=?,photo_logo=? WHERE id=? AND bank_id=?').bind(name,c.contact||'',c.job||'',c.address||'',c.piece||'',clientType,details,c.photo_logo||'',c.id,bankId).run();
   await addLog(env,bankId,'Client modifié : '+name); return json({ok:true});
  }
  if(path==='/api/client/block'&&request.method==='POST'){const c=await body(request); if(!c.id)return json({error:'Client obligatoire.'},400); const b=Number(c.is_blocked||0)?1:0; await env.DB.prepare('UPDATE clients SET is_blocked=? WHERE id=? AND bank_id=?').bind(b,c.id,bankId).run(); await addLog(env,bankId,b?'Client bloqué':'Client débloqué'); return json({ok:true});}
  if(path==='/api/client/delete'&&request.method==='POST'){
   const c=await body(request); if(!c.id)return json({error:'Client obligatoire.'},400);
   const row=await env.DB.prepare('SELECT * FROM clients WHERE id=? AND bank_id=?').bind(c.id,bankId).first();
   if(!row)return json({error:'Client introuvable.'},404);
   if(isCompanyClientRow(row,bankId))return json({error:'Le client entreprise de la banque est protégé : suppression impossible.'},403);
   const countAcc=await env.DB.prepare('SELECT COUNT(*) AS n FROM accounts WHERE client_id=? AND bank_id=?').bind(c.id,bankId).first();
   const countMov=await env.DB.prepare('SELECT COUNT(*) AS n FROM moves WHERE bank_id=? AND account_id IN (SELECT id FROM accounts WHERE client_id=? AND bank_id=?)').bind(bankId,c.id,bankId).first();
   await env.DB.prepare('DELETE FROM moves WHERE bank_id=? AND account_id IN (SELECT id FROM accounts WHERE client_id=? AND bank_id=?)').bind(bankId,c.id,bankId).run();
   await env.DB.prepare('DELETE FROM accounts WHERE client_id=? AND bank_id=?').bind(c.id,bankId).run();
   await env.DB.prepare('DELETE FROM clients WHERE id=? AND bank_id=?').bind(c.id,bankId).run();
   await addLog(env,bankId,'Client supprimé définitivement avec '+Number((countAcc&&countAcc.n)||0)+' compte(s) et '+Number((countMov&&countMov.n)||0)+' mouvement(s) liés');
   return json({ok:true,deleted_client:true,deleted_accounts:Number((countAcc&&countAcc.n)||0),deleted_moves:Number((countMov&&countMov.n)||0)});
  }
  if(path==='/api/account'&&request.method==='POST'){await rejectIfExerciseClosed(env,bankId);
   const a=await body(request);
   if(!a.clientId)return json({error:'Client obligatoire.'},400);
   const owner=await env.DB.prepare('SELECT id FROM clients WHERE id=? AND bank_id=? AND COALESCE(is_deleted,0)=0 LIMIT 1').bind(a.clientId,bankId).first();
   if(!owner)return json({error:'Client introuvable pour cette entreprise.'},404);
   const id=uid('ACC'),number=`BM-${new Date().getFullYear()}-${Math.floor(100000+Math.random()*899999)}`,type=a.type||'Compte courant';
   let dep=Number(a.deposit||0),fee=Number(a.fee||0),balance=dep-fee;
   let normalOpenFee=Number(a.openFee||0), normalCarnetFee=Number(a.carnetFee||0), normalBonus=Number(a.bonus||0), normalOpenDate=String(a.openDate||new Date().toISOString().slice(0,10));
   let creditAmount=0,creditRate=0,creditDuration=0,creditMonthly=0,creditDueCount=0,creditPenalty=0,creditTotal=0,creditChoice='',creditCarnetFee=0;
   const tnorm=norm(type);
   const isCredit=tnorm.includes('credit');
   const isTerm=tnorm==='depot a terme';
   if(!isCredit && !isTerm){
    fee=Number(a.fee||0);
    const bonusAmount=dep*normalBonus/100;
    balance=dep+bonusAmount-fee;
    creditRate=normalBonus;
    creditChoice=`Date ouverture: ${normalOpenDate||'—'} | Frais ouverture: ${normalOpenFee} | Frais carnet: ${normalCarnetFee} | Bonus: ${normalBonus}%`;
   }
   if(isCredit){
    creditChoice=String(a.creditChoice||'');
    if(a.creditStartDate||a.creditEndDate) creditChoice += ` | Date début: ${a.creditStartDate||'—'} | Date fin: ${a.creditEndDate||'—'}`;
    creditAmount=Number(a.creditAmount||0); creditRate=Number(a.creditRate||0); creditDuration=Number(a.creditDuration||0); creditPenalty=Number(a.creditPenalty||0); fee=Number(a.fee||0); creditCarnetFee=Number(a.creditCarnetFee||a.credit_carnet_fee||0)||0;
    if(creditCarnetFee>0 && !String(creditChoice).includes('Frais carnet')) creditChoice += ` | Frais carnet: ${creditCarnetFee}`;
    if(creditAmount<=0)return json({error:'Montant du crédit obligatoire.'},400);
    const sourceApprovisionnementId=String(a.creditSourceApprovisionnementId||a.credit_source_approvisionnement_id||a.creditSourceDecaissementId||a.credit_source_decaissement_id||'').trim();
    if(!sourceApprovisionnementId)return json({error:'Source du montant obligatoire : choisissez un N° d’enregistrement d’approvisionnement disponible.'},400);
    const sourceInfo=await availableCreditSourceApprovisionnement(env,bankId,sourceApprovisionnementId);
    if(!sourceInfo.ok)return json({error:sourceInfo.error||'Source du montant invalide.'},400);
    if(sourceInfo.available<=0)return json({error:'Cet approvisionnement n’a plus de montant disponible.'},400);
    if(creditAmount>sourceInfo.available)return json({error:'Montant du crédit supérieur au montant disponible de l’approvisionnement choisi.'},400);
    const sourceRef=String(a.creditSourceApprovisionnementRegister||a.creditSourceDecaissementRegister||sourceApprovisionnementId).replace(/[^A-Za-z0-9 _|.:/-]/g,'').slice(0,80);
    creditChoice += ` | Source du montant: approvisionnement ${sourceRef} ${sourceInfo.marker} | Montant disponible avant crédit: ${sourceInfo.available} | Reste approvisionnement: ${Math.max(0,Math.round((sourceInfo.available-creditAmount)*100)/100)}`;
    if(creditDuration<=0)return json({error:'Durée du crédit obligatoire.'},400);
    creditTotal=Number(a.creditTotal||0)||(creditAmount+(creditAmount*creditRate/100)+fee);
    creditMonthly=Number(a.creditMonthly||0)||(creditTotal/creditDuration); creditDueCount=Number(a.creditDueCount||0)||creditDuration; balance=creditTotal;
   }else if(isTerm){
    creditChoice=`Date début: ${a.termStartDate||'—'} | Date fin: ${a.termEndDate||'—'}`;
    creditAmount=Number(a.termAmount||0); creditRate=Number(a.termRate||0); creditDuration=Number(a.termDuration||0); fee=Number(a.fee||0);
    if(creditAmount<=0)return json({error:'Montant du dépôt obligatoire.'},400);
    if(creditDuration<=0)return json({error:'Durée du dépôt à terme obligatoire.'},400);
    creditTotal=Number(a.termTotal||0)||(creditAmount+(creditAmount*creditRate/100));
    creditMonthly=0; creditDueCount=creditDuration; balance=creditTotal;
   }
   await env.DB.prepare('INSERT INTO accounts(id,bank_id,client_id,number,type,balance,status,credit_fee,credit_carnet_fee,credit_amount,credit_rate,credit_duration,credit_monthly,credit_due_count,credit_penalty_rate,credit_total,credit_choice) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,bankId,a.clientId,number,type,balance,'Actif',fee,creditCarnetFee,creditAmount,creditRate,creditDuration,creditMonthly,creditDueCount,creditPenalty,creditTotal,creditChoice).run();
   if(isCredit){
    await env.DB.prepare('INSERT INTO moves(id,bank_id,account_id,type,description,amount,balance_after) VALUES(?,?,?,?,?,?,?)').bind(uid('MOV'),bankId,id,'Crédit accordé','Montant crédit accordé - solde total à régler enregistré',creditAmount,balance).run();
    const carnet=Number(creditCarnetFee||0);
    const dossier=Math.max(0,fee-carnet);
    const creditInterest=Math.max(0,Math.round((Number(creditTotal||0)-Number(creditAmount||0)-Number(fee||0))*100)/100);
    if(dossier>0) await env.DB.prepare('INSERT INTO moves(id,bank_id,account_id,type,description,amount,balance_after) VALUES(?,?,?,?,?,?,?)').bind(uid('MOV'),bankId,id,'Frais de dossiers crédit','Frais de dossier liés à l’ouverture du compte crédit',dossier,balance).run();
    if(carnet>0) await env.DB.prepare('INSERT INTO moves(id,bank_id,account_id,type,description,amount,balance_after) VALUES(?,?,?,?,?,?,?)').bind(uid('MOV'),bankId,id,'Frais Carnet','Frais de carnet liés à l’ouverture du compte crédit',carnet,balance).run();
    if(creditInterest>0) await env.DB.prepare('INSERT INTO moves(id,bank_id,account_id,type,description,amount,balance_after) VALUES(?,?,?,?,?,?,?)').bind(uid('MOV'),bankId,id,'Intérêts sur crédits','Intérêts cumulés du crédit comptabilisés comme revenu banque',creditInterest,balance).run();
    // Règle officielle : le Compte entreprise automatique n'est plus alimenté
    // par le crédit accordé. Il sera alimenté au fur et à mesure des paiements
    // crédits remboursés, limités au capital accordé.
    await ensureCompanyAccount(env,bankId);
   }else if(isTerm){
    await env.DB.prepare('INSERT INTO moves(id,bank_id,account_id,type,description,amount,balance_after) VALUES(?,?,?,?,?,?,?)').bind(uid('MOV'),bankId,id,'Dépôt à terme','Montant du dépôt à terme - solde total à régler au client',creditAmount,balance).run();
    if(fee>0) await env.DB.prepare('INSERT INTO moves(id,bank_id,account_id,type,description,amount,balance_after) VALUES(?,?,?,?,?,?,?)').bind(uid('MOV'),bankId,id,'Frais Dépôt à terme','Frais de dossier dépôt à terme versés à la banque',fee,balance).run();
   }else{
    if(dep>0)await env.DB.prepare('INSERT INTO moves(id,bank_id,account_id,type,description,amount,balance_after) VALUES(?,?,?,?,?,?,?)').bind(uid('MOV'),bankId,id,'Dépôt','Premier dépôt - '+type,dep,balance).run();
    if(normalBonus>0)await env.DB.prepare('INSERT INTO moves(id,bank_id,account_id,type,description,amount,balance_after) VALUES(?,?,?,?,?,?,?)').bind(uid('MOV'),bankId,id,'Bonus client','Bonus à verser au client - '+type,dep*normalBonus/100,balance).run();
    if(normalOpenFee>0)await env.DB.prepare('INSERT INTO moves(id,bank_id,account_id,type,description,amount,balance_after) VALUES(?,?,?,?,?,?,?)').bind(uid('MOV'),bankId,id,'Frais d’ouverture','Frais d’ouverture versés à la banque - '+type,normalOpenFee,balance).run();
    if(normalCarnetFee>0)await env.DB.prepare('INSERT INTO moves(id,bank_id,account_id,type,description,amount,balance_after) VALUES(?,?,?,?,?,?,?)').bind(uid('MOV'),bankId,id,'Frais Carnet','Frais de carnet versés à la banque - '+type,normalCarnetFee,balance).run();
   }
   await addLog(env,bankId,'Nouveau compte créé : '+number); return json({ok:true});
  }

  if(path==='/api/account/delete'&&request.method==='POST'){await rejectIfExerciseClosed(env,bankId);
   const a=await body(request); if(!a.id)return json({error:'Compte obligatoire.'},400);
   const acc=await env.DB.prepare('SELECT * FROM accounts WHERE id=? AND bank_id=?').bind(a.id,bankId).first();
   if(!acc)return json({error:'Compte introuvable.'},404);
   if(isCompanyAccountRow(acc,bankId))return json({error:'Le compte entreprise de la banque est protégé : suppression impossible.'},403);
   const countRow=await env.DB.prepare('SELECT COUNT(*) AS n FROM moves WHERE account_id=? AND bank_id=?').bind(a.id,bankId).first();
   const nbMoves=Number((countRow&&countRow.n)||0);
   await env.DB.prepare('DELETE FROM moves WHERE account_id=? AND bank_id=?').bind(a.id,bankId).run();
   await env.DB.prepare('DELETE FROM accounts WHERE id=? AND bank_id=?').bind(a.id,bankId).run();
   await addLog(env,bankId,'Compte supprimé définitivement du système avec '+nbMoves+' mouvement(s) lié(s) : '+(acc.number||a.id));
   return json({ok:true,deleted_account:true,deleted_moves:nbMoves});
  }

  if(path==='/api/account/block'&&request.method==='POST'){await rejectIfExerciseClosed(env,bankId);
   const a=await body(request); if(!a.id)return json({error:'Compte obligatoire.'},400);
   const acc=await env.DB.prepare('SELECT * FROM accounts WHERE id=? AND bank_id=?').bind(a.id,bankId).first();
   if(!acc)return json({error:'Compte introuvable.'},404);
   if(isCompanyAccountRow(acc,bankId))return json({error:'Le compte entreprise de la banque est protégé : blocage impossible.'},403);
   if(String(acc.status||'Actif')==='Supprimé')return json({error:'Compte supprimé : action impossible.'},403);
   const b=Number(a.is_blocked||0)?1:0;
   const reason=String(a.reason||'').trim();
   if(b && !reason)return json({error:'Raison du blocage obligatoire.'},400);
   if(b) await env.DB.prepare('UPDATE accounts SET is_blocked=1, block_reason=? WHERE id=? AND bank_id=?').bind(reason,a.id,bankId).run();
   else await env.DB.prepare('UPDATE accounts SET is_blocked=0 WHERE id=? AND bank_id=?').bind(a.id,bankId).run();
   await addLog(env,bankId,b?'Compte bloqué : '+(acc.number||a.id):'Compte débloqué : '+(acc.number||a.id));
   return json({ok:true});
  }
  if(path==='/api/move'&&request.method==='POST'){
   await rejectIfExerciseClosed(env,bankId);
   const m=await body(request);
   let amount=Number(m.amount||0);
   let operationFee=Number(m.operationFee||m.operation_fee||0)||0;
   if(operationFee<0)return json({error:'Frais d’opération invalide.'},400);
   if(!m.accountId)return json({error:'Compte obligatoire.'},400);
   const acc=await env.DB.prepare('SELECT * FROM accounts WHERE id=? AND bank_id=?').bind(m.accountId,bankId).first();
   if(!acc)return json({error:'Compte introuvable.'},404);
   if(String(acc.status||'Actif')==='Supprimé')return json({error:'Compte supprimé : mouvement impossible.'},403);
   if(Number(acc.is_blocked||0)){const reason=String(acc.block_reason||'').trim();return json({error:'Compte bloqué par l’administrateur : mouvement impossible.'+(reason?' Raison : '+reason:'')},403);}
   const cli=await env.DB.prepare('SELECT is_blocked FROM clients WHERE id=? AND bank_id=?').bind(acc.client_id,bankId).first();
   if(cli&&Number(cli.is_blocked||0))return json({error:'Client bloqué : mouvement impossible.'},403);
   const type=m.type||'Dépôt';
   const tnorm=norm(type);
   const isCompanyAccount=isCompanyAccountRow(acc,bankId);
   if(isCompanyAccount){
    if(!['super_admin','admin_bank'].includes(sessionRoleKey(s)))return json({error:'La gestion du Compte entreprise automatique est réservée uniquement à l’Administrateur.'},403);
    if(!isCompanyMovementType(type))return json({error:'Ce compte entreprise accepte uniquement les mouvements Approvisionnement et Décaissement.'},403);
    // Compte entreprise automatique :
    // - Approvisionnement augmente le solde du compte entreprise et sera repris comme revenu banque dans les rapports.
    // - Décaissement diminue le solde du compte entreprise. Côté interface, il est repris
    //   dans le rapport des revenus comme une ligne négative afin de diminuer le total.
    // Aucun frais d’opération ne doit être généré ici.
    operationFee=0;
   }else if(isCompanyMovementType(type)){
    return json({error:'Les mouvements Approvisionnement et Décaissement sont réservés uniquement au Compte entreprise automatique.'},403);
   }
   const isCredit=norm(acc.type).includes('credit');
   const allowedCreditTypes=['paiement credit','paiement de credit','frais de recouvrement','frais de penalites de retard'];
   if(isCredit && !isCompanyAccount && !allowedCreditTypes.includes(tnorm)){
    await addSecurityLog(env,bankId,s,'Mouvement refusé','Mouvements','refusé','opération incompatible');
    return json({error:'opération incompatible'},403);
   }
   const isPaymentCredit=(tnorm==='paiement credit'||tnorm==='paiement de credit');
   const isRecoveryFee=(tnorm==='frais de recouvrement');
   const isPenalty=(tnorm==='frais de penalites de retard');
   const isOperationFeeType=(tnorm.startsWith('frais')&&tnorm.includes('operation'));
   if(isCredit && isPenalty){
    const rate=Number(acc.credit_penalty_rate||0)||0;
    amount=Math.round((creditCurrentInstallmentBase(acc)*rate/100)*100)/100;
   }
   if(amount<=0)return json({error:'Montant invalide.'},400);
   const isClientFee=tnorm.startsWith('frais') && !isPenalty && !isRecoveryFee;
   const companyDecaissementOnly=isCompanyAccount&&isCompanyDecaissementType(type);
   const debit=(tnorm==='retrait'||tnorm==='decaissement'||isPaymentCredit||isClientFee);
   const increaseDebt=(isCredit&&(isRecoveryFee||isPenalty));
   let companyAvailable=null;
   if(isCompanyAccount){
    companyAvailable=await computeCompanyOfficialBalance(env,bankId,{});
    if(companyDecaissementOnly){
     if(companyAvailable<=0)return json({error:'Décaissement impossible : le solde du Compte entreprise automatique est nul ou négatif.'},400);
     if(amount>companyAvailable)return json({error:'Décaissement impossible : montant supérieur au solde disponible du Compte entreprise automatique.'},400);
    }
   }
   if(!isCompanyAccount&&debit&&Number(acc.balance)<amount)return json({error:'Solde insuffisant.'},400);
   let newBal=isCompanyAccount?Math.round((Number(companyAvailable||0)+(companyDecaissementOnly?-amount:amount))*100)/100:Number(acc.balance)+(debit?-amount:(increaseDebt?amount:amount));
   const desc=m.description||(companyDecaissementOnly?'Décaissement du compte entreprise automatique — revenu négatif dans le rapport':(isPenalty?('Pénalité de retard automatique ('+(Number(acc.credit_penalty_rate||0)||0)+'% de l’échéance en cours)'):(isRecoveryFee?'Frais de recouvrement':type)));
   let finalBal=newBal;
   const moveId=uid('MOV');
   const statements=[
    env.DB.prepare('INSERT INTO moves(id,bank_id,account_id,type,description,amount,balance_after,created_by,created_by_role) VALUES(?,?,?,?,?,?,?,?,?)').bind(moveId,bankId,acc.id,type,desc,amount,newBal,String(s.userId||''),roleLabel(s.userRole||'Administrateur banque'))
   ];
   if(operationFee>0){
    if(isCredit){
     finalBal=Number(finalBal)+operationFee;
    }else{
     if(Number(finalBal)<operationFee)return json({error:'Solde insuffisant pour les frais d’opération.'},400);
     finalBal=Number(finalBal)-operationFee;
    }
    statements.push(env.DB.prepare('INSERT INTO moves(id,bank_id,account_id,type,description,amount,balance_after,created_by,created_by_role) VALUES(?,?,?,?,?,?,?,?,?)').bind(uid('MOV'),bankId,acc.id,'Frais d’opération','Frais d’opération imputé sur le solde du client',operationFee,finalBal,String(s.userId||''),roleLabel(s.userRole||'Administrateur banque')));
   }
   statements.unshift(env.DB.prepare('UPDATE accounts SET balance=? WHERE id=? AND bank_id=?').bind(finalBal,acc.id,bankId));
   await env.DB.batch(statements);
   if(isCredit&&isPaymentCredit){
    await syncCreditRepaymentsToCompanyAccount(env,bankId);
   }
   if(isCompanyAccount){
    await updateCompanyAccountStoredBalance(env,bankId);
   }
   await addLog(env,bankId,type+' effectué');
   await addSecurityLog(env,bankId,s,'Mouvement','Mouvements','autorisé',type);
   return json({ok:true});
  }

  if(path==='/api/move/delete'&&request.method==='POST'){await rejectIfExerciseClosed(env,bankId);
   const m=await body(request); if(!m.id)return json({error:'Opération obligatoire.'},400);
   const mv=await env.DB.prepare('SELECT * FROM moves WHERE id=? AND bank_id=?').bind(m.id,bankId).first();
   if(!mv)return json({error:'Opération introuvable.'},404);
   const acc=await env.DB.prepare('SELECT * FROM accounts WHERE id=? AND bank_id=?').bind(mv.account_id,bankId).first();
   let mustRefreshCompany=false;
   if(acc){
    const mvNorm=norm(mv.type); const accIsCredit=norm(acc.type).includes('credit');
    const accIsCompany=isCompanyAccountRow(acc,bankId);
    const mvIsOperationFee=(mvNorm.startsWith('frais')&&mvNorm.includes('operation'));
    const debit=(mvNorm==='retrait'||mvNorm==='decaissement'||mvNorm==='paiement credit'||mvNorm==='paiement de credit'||(mvNorm.startsWith('frais')&&mvNorm!=='frais de penalites de retard'&&mvNorm!=='frais de recouvrement'&&!(accIsCredit&&mvIsOperationFee)));
    const increaseDebt=(accIsCredit&&(mvNorm==='frais de recouvrement'||mvNorm==='frais de penalites de retard'||mvIsOperationFee));
    if(!accIsCompany){
     const corrected=Number(acc.balance)+(debit?Number(mv.amount):(increaseDebt?-Number(mv.amount):-Number(mv.amount)));
     await env.DB.prepare('UPDATE accounts SET balance=? WHERE id=? AND bank_id=?').bind(corrected,acc.id,bankId).run();
    }
    if(accIsCredit&&isCreditPaymentTypeServer(mv.type)){
     const marker=companyCreditRepaymentSourceMarker(mv.id);
     await env.DB.prepare('DELETE FROM moves WHERE bank_id=? AND account_id=? AND description LIKE ?').bind(bankId,companyAccountId(bankId),'%'+marker+'%').run();
     mustRefreshCompany=true;
    }
    if(accIsCompany)mustRefreshCompany=true;
   }
   await env.DB.prepare('DELETE FROM moves WHERE id=? AND bank_id=?').bind(m.id,bankId).run();
   if(mustRefreshCompany){await syncCreditRepaymentsToCompanyAccount(env,bankId);await updateCompanyAccountStoredBalance(env,bankId);}
   await addLog(env,bankId,'Opération supprimée par administrateur');
   return json({ok:true});
  }
  if(path==='/api/settings/account-type'&&request.method==='POST'){
   const t=await body(request); const name=String(t.name||'').trim(); if(!name)return json({error:'Nom obligatoire.'},400);
   const ex=await env.DB.prepare('SELECT id FROM account_types WHERE bank_id=? AND lower(name)=lower(?)').bind(bankId,name).first();
   if(ex) await env.DB.prepare('UPDATE account_types SET name=?, is_active=1 WHERE id=? AND bank_id=?').bind(name,ex.id,bankId).run();
   else await env.DB.prepare('INSERT INTO account_types(id,bank_id,name,is_active) VALUES(?,?,?,1)').bind(uid('ACT'),bankId,name).run();
   await addLog(env,bankId,'Type de compte ajouté/activé : '+name); return json({ok:true});
  }
  if(path==='/api/settings/account-type/delete'&&request.method==='POST'){
   const t=await body(request); const name=String(t.name||'').trim();
   let id=t.id||'';
   if(!id && name){ const ex=await env.DB.prepare('SELECT id FROM account_types WHERE bank_id=? AND lower(name)=lower(?)').bind(bankId,name).first(); id=ex&&ex.id; }
   if(id) await env.DB.prepare('UPDATE account_types SET is_active=0 WHERE id=? AND bank_id=?').bind(id,bankId).run();
   else if(name) await env.DB.prepare('INSERT INTO account_types(id,bank_id,name,is_active) VALUES(?,?,?,0)').bind(uid('ACT'),bankId,name).run();
   else return json({error:'Type de compte obligatoire.'},400);
   await addLog(env,bankId,'Type de compte désactivé : '+(name||id)); return json({ok:true});
  }
  if(path==='/api/settings/movement-type'&&request.method==='POST'){
   const t=await body(request); const name=String(t.name||'').trim(); if(!name)return json({error:'Nom obligatoire.'},400);
   const category=String(t.category||'client_operation').trim();
   const isBankRevenue=(Number(t.isBankRevenue??t.is_bank_revenue)===1||category==='bank_revenue')?1:0;
   const description=String(t.description||'').trim();
   const ex=await env.DB.prepare('SELECT id FROM movement_types WHERE bank_id=? AND lower(name)=lower(?)').bind(bankId,name).first();
   if(ex) await env.DB.prepare('UPDATE movement_types SET name=?, is_active=1, category=?, is_bank_revenue=?, description=? WHERE id=? AND bank_id=?').bind(name,category,isBankRevenue,description,ex.id,bankId).run();
   else await env.DB.prepare('INSERT INTO movement_types(id,bank_id,name,is_active,category,is_bank_revenue,description) VALUES(?,?,?,1,?,?,?)').bind(uid('MVT'),bankId,name,category,isBankRevenue,description).run();
   await addLog(env,bankId,'Type de mouvement ajouté/activé : '+name+(isBankRevenue?' — revenu de la banque':' — opération hors revenu banque')); return json({ok:true});
  }
  if(path==='/api/settings/movement-type/delete'&&request.method==='POST'){
   const t=await body(request); const name=String(t.name||'').trim();
   let id=t.id||'';
   if(!id && name){ const ex=await env.DB.prepare('SELECT id FROM movement_types WHERE bank_id=? AND lower(name)=lower(?)').bind(bankId,name).first(); id=ex&&ex.id; }
   if(id) await env.DB.prepare('UPDATE movement_types SET is_active=0 WHERE id=? AND bank_id=?').bind(id,bankId).run();
   else if(name) await env.DB.prepare('INSERT INTO movement_types(id,bank_id,name,is_active) VALUES(?,?,?,0)').bind(uid('MVT'),bankId,name).run();
   else return json({error:'Type de mouvement obligatoire.'},400);
   await addLog(env,bankId,'Type de mouvement désactivé : '+(name||id)); return json({ok:true});
  }
  if(path==='/api/revenue'&&request.method==='POST'){
   const r=await body(request); const name=String(r.name||'').trim(); if(!name)return json({error:'Nature du revenu obligatoire.'},400);
   await env.DB.prepare('INSERT INTO manual_revenues(id,bank_id,name,operations,amount) VALUES(?,?,?,?,?)').bind(uid('REV'),bankId,name,Number(r.operations||0),Number(r.amount||0)).run();
   const ex=await env.DB.prepare('SELECT id FROM movement_types WHERE bank_id=? AND lower(name)=lower(?)').bind(bankId,name).first();
   if(ex) await env.DB.prepare("UPDATE movement_types SET is_active=1, category='bank_revenue', is_bank_revenue=1 WHERE id=? AND bank_id=?").bind(ex.id,bankId).run();
   else await env.DB.prepare("INSERT INTO movement_types(id,bank_id,name,is_active,category,is_bank_revenue) VALUES(?,?,?,1,'bank_revenue',1)").bind(uid('MVT'),bankId,name).run();
   await addLog(env,bankId,'Revenu ajouté : '+name); return json({ok:true});
  }
  if(path==='/api/revenue/update'&&request.method==='POST'){
   const r=await body(request); const name=String(r.name||'').trim(); if(!r.id||!name)return json({error:'Revenu invalide.'},400);
   await env.DB.prepare('UPDATE manual_revenues SET name=?,operations=?,amount=? WHERE id=? AND bank_id=?').bind(name,Number(r.operations||0),Number(r.amount||0),r.id,bankId).run();
   const ex=await env.DB.prepare('SELECT id FROM movement_types WHERE bank_id=? AND lower(name)=lower(?)').bind(bankId,name).first();
   if(ex) await env.DB.prepare("UPDATE movement_types SET is_active=1, category='bank_revenue', is_bank_revenue=1 WHERE id=? AND bank_id=?").bind(ex.id,bankId).run();
   else await env.DB.prepare("INSERT INTO movement_types(id,bank_id,name,is_active,category,is_bank_revenue) VALUES(?,?,?,1,'bank_revenue',1)").bind(uid('MVT'),bankId,name).run();
   return json({ok:true});
  }
  if(path==='/api/revenue/delete'&&request.method==='POST'){
   const r=await body(request); await env.DB.prepare('DELETE FROM manual_revenues WHERE id=? AND bank_id=?').bind(r.id,bankId).run(); return json({ok:true});
  }
  if(path==='/api/revenue/ignore'&&request.method==='POST'){
   const r=await body(request); const key=String(r.key||'').trim(); if(!key)return json({error:'Ligne invalide.'},400);
   const ex=await env.DB.prepare('SELECT id FROM ignored_revenues WHERE bank_id=? AND revenue_key=?').bind(bankId,key).first();
   if(!ex)await env.DB.prepare('INSERT INTO ignored_revenues(id,bank_id,revenue_key) VALUES(?,?,?)').bind(uid('IGN'),bankId,key).run();
   return json({ok:true});
  }
  if(path==='/api/user'&&request.method==='POST'){
   if(sessionRoleKey(s)!=='admin_bank')return denyRole(env,bankId,s,'Création utilisateur refusée','Gestion des utilisateurs','Réservé à l’Administrateur banque');
   const u=await body(request);const login=String(u.login||'').trim(),password=String(u.pass||'');if(!login||!password)return json({error:'Identifiant et mot de passe obligatoires.'},400);const weak=assertPasswordStrength(password);if(weak)return json({error:weak},400);
   if(canonicalRole(u.role||'')==='admin_bank'||canonicalRole(u.role||'')==='super_admin')return json({error:'La création d’un Administrateur banque ou Super Admin n’est pas autorisée depuis Gestion des utilisateurs.'},403);
   if(loginReserved(env,login)||await loginExists(env,login))return json({error:'Identifiant utilisateur déjà utilisé.'},409);
   const permissions=JSON.stringify(defaultPermissionsForRole(u.role||'Agent caisse')),passHash=await hashPassword(password);
   await env.DB.prepare('INSERT INTO users(id,bank_id,name,login,pass,auth_version,role,status,permissions) VALUES(?,?,?,?,?,1,?,?,?)').bind(uid('USR'),bankId,u.name||'',login,passHash,roleLabel(u.role||'Agent caisse'),String(u.status||'Actif'),permissions).run();
   await addSecurityLog(env,bankId,s,'Création utilisateur','Gestion des utilisateurs','autorisé','Accès opérationnel agent, pages sensibles bloquées');return json({ok:true});
  }
  if(path==='/api/user/update'&&request.method==='POST'){
   if(sessionRoleKey(s)!=='admin_bank')return denyRole(env,bankId,s,'Modification utilisateur refusée','Gestion des utilisateurs','Réservé à l’Administrateur banque');
   const u=await body(request);if(!u.id)return json({error:'Utilisateur obligatoire.'},400);const login=String(u.login||'').trim();if(!login)return json({error:'Identifiant obligatoire.'},400);
   if(canonicalRole(u.role||'')==='admin_bank'||canonicalRole(u.role||'')==='super_admin')return json({error:'Le rôle Administrateur banque ne peut pas être attribué depuis cette page.'},403);
   const target=await env.DB.prepare('SELECT * FROM users WHERE id=? AND bank_id=?').bind(u.id,bankId).first();if(!target)return json({error:'Utilisateur introuvable.'},404);if(canonicalRole(target.role||'')==='admin_bank')return json({error:'La modification d’un Administrateur banque est réservée au Super Admin.'},403);
   if(loginReserved(env,login)||await loginExists(env,login,{userId:u.id}))return json({error:'Identifiant déjà utilisé.'},409);
   const permissions=JSON.stringify(defaultPermissionsForRole(u.role||'Agent caisse')),password=String(u.pass||'');let passHash=target.pass,nextVersion=Number(target.auth_version||1);
   if(password){const weak=assertPasswordStrength(password);if(weak)return json({error:weak},400);passHash=await hashPassword(password);nextVersion+=1;}
   await env.DB.prepare('UPDATE users SET name=?,login=?,pass=?,auth_version=?,role=?,status=?,permissions=? WHERE id=? AND bank_id=?').bind(String(u.name||''),login,passHash,nextVersion,roleLabel(u.role||'Agent caisse'),String(u.status||'Actif'),permissions,u.id,bankId).run();
   await addSecurityLog(env,bankId,s,'Modification utilisateur','Gestion des utilisateurs','autorisé',password?'Mot de passe modifié et sessions invalidées':'Accès opérationnel agent, pages sensibles bloquées');return json({ok:true});
  }
  if(path==='/api/user/toggle'&&request.method==='POST'){
   if(sessionRoleKey(s)!=='admin_bank')return denyRole(env,bankId,s,'Blocage utilisateur refusé','Gestion des utilisateurs','Réservé à l’Administrateur banque');
   const u=await body(request); const row=await env.DB.prepare('SELECT * FROM users WHERE id=? AND bank_id=?').bind(u.id,bankId).first(); if(!row)return json({error:'Utilisateur introuvable.'},404); if(canonicalRole(row.role||'')==='admin_bank')return json({error:'Le blocage/déblocage d’un Administrateur banque est réservé au Super Admin.'},403);
   const next=String(row.status||'Actif')==='Actif'?'Bloqué':'Actif'; await env.DB.prepare('UPDATE users SET status=?,auth_version=COALESCE(auth_version,1)+1 WHERE id=? AND bank_id=?').bind(next,u.id,bankId).run(); await addSecurityLog(env,bankId,s,next==='Bloqué'?'Blocage utilisateur':'Déblocage utilisateur','Gestion des utilisateurs','autorisé',''); return json({ok:true,status:next});
  }
  if(path==='/api/user/delete'&&request.method==='POST'){
   if(sessionRoleKey(s)!=='admin_bank')return denyRole(env,bankId,s,'Suppression compte agent refusée','Gestion des utilisateurs','Réservé à l’Administrateur banque');
   const u=await body(request); const row=await env.DB.prepare('SELECT * FROM users WHERE id=? AND bank_id=?').bind(u.id,bankId).first(); if(!row)return json({error:'Utilisateur introuvable.'},404); if(canonicalRole(row.role||'')==='admin_bank'||canonicalRole(row.role||'')==='super_admin')return json({error:'La suppression de ce compte est interdite depuis cette page.'},403);
   await env.DB.prepare('DELETE FROM users WHERE id=? AND bank_id=?').bind(u.id,bankId).run();
   await addSecurityLog(env,bankId,s,'Suppression compte agent','Gestion des utilisateurs','autorisé',row.name||row.login||''); return json({ok:true});
  }
  if(path==='/api/settings/charge-base'&&request.method==='POST'){const c=await body(request); if(!c.name)return json({error:'Libellé obligatoire.'},400); await env.DB.prepare('INSERT INTO charge_bases(id,bank_id,name,category,percent) VALUES(?,?,?,?,?)').bind(uid('CHG'),bankId,c.name,c.category||'Frais',Number(c.percent||0)).run(); await addLog(env,bankId,'Base de calcul des charges ajoutée : '+c.name); return json({ok:true});}
  if(path==='/api/settings/charge-base/delete'&&request.method==='POST'){const c=await body(request); await env.DB.prepare('DELETE FROM charge_bases WHERE id=? AND bank_id=?').bind(c.id,bankId).run(); await addLog(env,bankId,'Base de calcul des charges supprimée'); return json({ok:true});}

  if(path==='/api/settings/charge-base/update'&&request.method==='POST'){const c=await body(request); if(!c.id)return json({error:'Base introuvable.'},400); if(!c.name)return json({error:'Libellé obligatoire.'},400); await env.DB.prepare('UPDATE charge_bases SET name=?,category=?,percent=? WHERE id=? AND bank_id=?').bind(c.name,c.category||'Frais',Number(c.percent||0),c.id,bankId).run(); await addLog(env,bankId,'Base de calcul des charges modifiée : '+c.name); return json({ok:true});}
  if(path==='/api/settings/charge-base/reset-defaults'&&request.method==='POST'){await resetDefaultCharges(env,bankId); await addLog(env,bankId,'Liste complète des bases de calcul des charges réinitialisée'); return json({ok:true});}
  if(path==='/api/settings/obligation'&&request.method==='POST'){await rejectIfExerciseClosed(env,bankId);const o=await body(request); if(!o.name)return json({error:'Libellé obligatoire.'},400); await env.DB.prepare('INSERT INTO obligations(id,bank_id,name,amount,due_day,base_type,base_item) VALUES(?,?,?,?,?,?,?)').bind(uid('OBL'),bankId,o.name,Number(o.amount||0),Number(o.due_day||1),o.base_type||'Bénéfice général',o.base_item||'').run(); await addLog(env,bankId,'Obligation mensuelle ajoutée : '+o.name); return json({ok:true});}

  if(path==='/api/settings/obligation/update'&&request.method==='POST'){await rejectIfExerciseClosed(env,bankId);const o=await body(request); if(!o.id)return json({error:'ID obligation manquant.'},400); if(!o.name)return json({error:'Libellé obligatoire.'},400); await env.DB.prepare('UPDATE obligations SET name=?,amount=?,due_day=?,base_type=?,base_item=? WHERE id=? AND bank_id=?').bind(o.name,Number(o.amount||0),Number(o.due_day||1),o.base_type||'Bénéfice général',o.base_item||'',o.id,bankId).run(); await addLog(env,bankId,'Obligation mensuelle modifiée : '+o.name); return json({ok:true});}
  if(path==='/api/settings/obligation/delete'&&request.method==='POST'){await rejectIfExerciseClosed(env,bankId);const o=await body(request); await env.DB.prepare('DELETE FROM obligations WHERE id=? AND bank_id=?').bind(o.id,bankId).run(); await addLog(env,bankId,'Obligation mensuelle supprimée'); return json({ok:true});}
  if(path==='/api/settings/user-reset'&&request.method==='POST'){
   if(sessionRoleKey(s)!=='admin_bank')return denyRole(env,bankId,s,'Réinitialisation mot de passe refusée','Gestion des utilisateurs','Réservé à l’Administrateur banque');
   const r=await body(request); const u=await env.DB.prepare('SELECT * FROM users WHERE id=? AND bank_id=?').bind(r.id,bankId).first(); if(!u)return json({error:'Utilisateur introuvable.'},404); if(canonicalRole(u.role||'')==='admin_bank')return json({error:'La réinitialisation du mot de passe Administrateur banque est réservée au Super Admin.'},403);
   const password=String(r.newpass||'');const weak=assertPasswordStrength(password);if(weak)return json({error:weak},400);const passHash=await hashPassword(password);await env.DB.prepare('UPDATE users SET pass=?,auth_version=COALESCE(auth_version,1)+1 WHERE id=? AND bank_id=?').bind(passHash,r.id,bankId).run(); await env.DB.prepare('INSERT INTO reset_requests(id,bank_id,user_id,message,status) VALUES(?,?,?,?,?)').bind(uid('RST'),bankId,r.id,'Mot de passe réinitialisé par Administrateur banque pour '+(u.name||u.login||'utilisateur'),'Traité').run(); await addSecurityLog(env,bankId,s,'Réinitialisation mot de passe utilisateur','Gestion des utilisateurs','autorisé',''); await addLog(env,bankId,'Mot de passe utilisateur réinitialisé'); return json({ok:true});
  }
  return json({error:'Route inconnue : '+path},404);
 }catch(e){if(e instanceof Response)return e; return json({error:e && e.message ? e.message : 'Erreur serveur'},500);}
}
export default {async fetch(request,env,ctx){const url=new URL(request.url); if(url.pathname.startsWith('/api/'))return handleApi(request,env,url.pathname); return env.ASSETS.fetch(request);}};
