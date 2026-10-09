# GLOBAL BANK V9 — Gestion sécurisée des rôles et autorisations

## Rôles bancaires officiels

- `admin_bank` — Administrateur banque
- `agent_caisse` — Agent caisse
- `agent_credit` — Agent crédit
- `auditeur` — Agent consultation / auditeur

Le Super Administrateur reste un espace global indépendant. Il ne fait pas partie de la matrice ordinaire d'une banque.

## Principes appliqués

- Le rôle, le `bank_id`, l'identité de l'utilisateur et les permissions sont issus exclusivement de la session serveur.
- Chaque requête authentifiée recharge l'utilisateur D1 afin qu'un blocage, une modification de rôle, une restriction ou une invalidation de session prenne effet immédiatement.
- Une matrice `ROLE_PERMISSIONS` centralise les droits par défaut.
- La colonne D1 `users.permissions` utilise le format JSON `{ "allow": [], "deny": [] }`.
- `deny` réduit les droits du rôle. `allow` ne peut ajouter que des permissions explicitement compatibles avec le rôle.
- Une permission envoyée librement par le navigateur ne modifie jamais les droits de la session.
- Les routes sensibles contrôlent la session, le rôle, la permission, l'état de l'utilisateur, l'état de la banque, l'abonnement, l'exercice et l'appartenance de la donnée au `bank_id`.
- Les menus, boutons et données chargées sont filtrés selon le rôle, mais la sécurité réelle reste dans `public/_worker.js`.

## Espaces séparés

### Administrateur banque

Gestion complète de sa banque : clients, comptes, mouvements, crédits, agents, rapports, exercices, paramètres, sécurité, demandes de correction et messagerie. Il ne peut ni créer un Super Administrateur ni accéder à une autre banque.

### Agent caisse

Clients et comptes consultables, dépôts et retraits autorisés, reçus, propres opérations et demandes de correction. Les paramètres, utilisateurs, crédits et données des autres agents sont absents.

### Agent crédit

Clients nécessaires, comptes crédit, création/préparation des crédits, échéanciers, paiements crédit, documents crédit et demandes de correction. Les opérations ordinaires de caisse et les paramètres généraux sont refusés.

### Auditeur

Consultation et impression seulement. Toute route d'écriture bancaire retourne `403 Forbidden`.

## Traçabilité

Les mutations authentifiées sont journalisées côté serveur avec l'utilisateur réel, son rôle, sa banque, la route, la permission, la ressource, le résultat et le motif éventuel. Les opérations financières ne sont pas supprimées physiquement : elles sont annulées logiquement. Les clients, comptes et utilisateurs sont archivés afin de préserver les historiques.

## Demandes de correction

La table `operation_requests` permet aux agents de demander une correction, annulation, vérification ou réimpression exceptionnelle. L'Administrateur banque approuve ou refuse la demande sans permettre à l'agent de modifier directement une opération validée.

## Migration

La migration `migrations/0003_rbac_v9.sql` crée la table et les index des demandes de correction. Les colonnes complémentaires sont préparées de façon idempotente par `ensureSchema()` dans le Worker, ce qui évite les conflits si la base a déjà été mise à niveau.
