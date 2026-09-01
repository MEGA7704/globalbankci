import fs from 'node:fs';
const worker=fs.readFileSync(new URL('../public/_worker.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
function assert(ok,msg){if(!ok)throw new Error(msg)}
assert(worker.includes('const currentYear=now.getUTCFullYear(),currentMonth=now.getUTCMonth()+1'),'Le mois courant UTC doit être calculé automatiquement.');
assert(worker.includes('storedPeriod<currentPeriod'),'La bascule doit détecter un exercice antérieur au mois courant.');
assert(worker.includes("status='open'"),'Le nouveau mois doit repartir ouvert.');
assert(worker.includes('updatedDay<currentMonthStart'),'Une consultation historique effectuée dans le mois courant doit rester possible.');
assert(ui.includes('closeMobileMenu(); // retour tactile immédiat'),'Le menu mobile doit se fermer avant le rendu lourd.');
assert(ui.includes("requestAnimationFrame(()=>{render();window.scrollTo(0,0);});"),'Le rendu de navigation doit être différé à la frame suivante.');
assert(ui.includes('m.dataset.menuSignature'),'Le menu doit être réutilisé au lieu d’être reconstruit à chaque clic.');
assert(ui.includes('@media(max-width:1024px)'),'Les optimisations doivent couvrir téléphones et tablettes.');
console.log('OK management-auto-month-v29');
