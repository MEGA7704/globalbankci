# GLOBAL BANK V14 — opérations caisse et crédits agents

## Agent caisse
- Le formulaire d’enregistrement n’est plus affiché directement dans la page.
- Le bouton **+ Nouveau mouvement** est aligné avec **Historique de mes opérations**.
- Le bouton ouvre un popup professionnel limité aux mouvements autorisés par les permissions serveur.
- Les comptes entreprise et les comptes crédit ne sont pas proposés dans ce formulaire caisse.

## Agent crédit
- Les boutons **Liste des crédits**, **+ Nouveau compte crédit** et **Paiement crédit** sont alignés avec **Historique des paiements crédit**.
- La création et le paiement utilisent des popups professionnels.
- La liste des crédits est une page distincte.
- Le bouton **Détail** ouvre la fiche complète du crédit en lecture seule.
- Le retour depuis la fiche détaillée ramène à la liste des crédits.
 
## Sécurité
Les vérifications RBAC restent obligatoires côté Worker. Le navigateur ne décide jamais du rôle, de la banque ou des permissions.
