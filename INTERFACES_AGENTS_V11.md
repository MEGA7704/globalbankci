# GLOBAL BANK V11 — Interfaces professionnelles des agents

## Changements

- Le style bancaire haut de gamme du tableau de bord Agent caisse est appliqué aux sessions Agent crédit et Auditeur.
- La barre horizontale, le logo, le bloc utilisateur, le bouton de sortie, les cartes et les tableaux sont uniformisés.
- Chaque rôle conserve exclusivement les menus autorisés par la matrice RBAC.
- Le doublon « Déconnexion » a été retiré de tous les menus horizontaux. Le seul bouton de sortie reste dans le bloc utilisateur à droite.
- Les tableaux de bord utilisent uniquement les données déjà filtrées par le serveur selon le rôle et le `bank_id`.

## Menus

### Agent caisse
Tableau de bord, Clients, Comptes, Mouvements, Mes opérations, Corrections.

### Agent crédit
Tableau de bord, Clients, Crédits, Corrections.

### Auditeur
Tableau de bord, Clients, Comptes, Mouvements, Rapports.

Aucune migration D1 et aucune nouvelle variable Cloudflare ne sont nécessaires.
