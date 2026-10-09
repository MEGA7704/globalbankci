# GLOBAL BANK — Cloudflare Pages + GitHub sécurisé

Cette version relie directement le Worker aux ressources Cloudflare sans inscrire les identifiants Super Admin dans le dépôt.


## Interface agents V11

Les sessions Agent caisse, Agent crédit et Auditeur utilisent maintenant une interface bancaire professionnelle commune. Les menus restent strictement limités aux autorisations RBAC de chaque rôle. Le doublon « Déconnexion » a été retiré du menu horizontal ; le bouton de sortie unique se trouve dans le bloc utilisateur.

## Configuration GitHub / Cloudflare Pages

- Branche de production : `main`
- Infrastructure prédéfinie : `Aucun`
- Commande de compilation : `npm run build`
- Répertoire de sortie : `public`
- Répertoire racine : laisser vide

## Liaisons déjà intégrées

Le fichier `wrangler.toml` est la source de vérité du projet :

- `env.DB` est relié à la base D1 `bankdb` ;
- `env.KV` est relié au namespace KV indiqué dans la configuration ;
- `env.SUPER_ADMIN_SESSION_VERSION` reçoit automatiquement la valeur texte `1` ;
- `SUPER_ADMIN_LOGIN` et `SUPER_ADMIN_PASSWORD` sont lus uniquement comme secrets chiffrés Cloudflare via `env`, sans aucune valeur dans le projet.

Le navigateur ne reçoit jamais les secrets, le hash ou le sel. Le mot de passe Super Admin est comparé uniquement dans `public/_worker.js`.


## Correction Cloudflare Pages V3

La section `[secrets]` a été retirée de `wrangler.toml` pour rester compatible avec le lecteur de configuration utilisé par les déploiements Git Cloudflare Pages. Les valeurs sensibles restent exclusivement dans **Cloudflare → Variables et secrets**.

Le script de build ne s'arrête plus lorsque `.gitignore` est absent après un téléversement manuel sur GitHub. Il refuse toutefois toujours tout vrai fichier `.env` ou `.dev.vars`, afin de maintenir la sécurité.

## Première configuration sécurisée

Installez les dépendances et connectez Wrangler :

```bash
npm install
npx wrangler login
```

Configurez ensuite les deux secrets avec la commande interactive incluse :

```bash
npm run secrets:configure
```

Wrangler demandera les valeurs directement dans le terminal. Elles ne seront ni ajoutées à la commande, ni enregistrées dans un fichier du projet.

Vous pouvez vérifier uniquement les **noms** des secrets configurés :

```bash
npm run secrets:list
```

## Développement local

Copiez `.dev.vars.example` vers `.dev.vars`, puis saisissez uniquement des valeurs locales de test :

```bash
cp .dev.vars.example .dev.vars
npm run dev
```

Le vrai fichier `.dev.vars` est bloqué par `.gitignore`. Ne l’ajoutez jamais manuellement à Git.

## Initialisation D1

```bash
npm run db:migrate:remote
```

## Vérification avant GitHub

```bash
npm run build
npm run test:security
```

La construction vérifie notamment :

- les bindings D1 et KV ;
- la présence de la variable de version de session ;
- les références serveur aux secrets Cloudflare ;
- l’absence de `.env` et `.dev.vars` réels ;
- l’utilisation des secrets uniquement par `env` dans le Worker ;
- l’utilisation exclusive du cookie de session `HttpOnly`.

## Déploiement

```bash
npm run deploy
```

Les secrets doivent être configurés avant le déploiement qui les utilise. Un redéploiement du code ne place jamais leurs valeurs dans GitHub.

## Changement du mot de passe Super Admin

1. Mettez à jour `SUPER_ADMIN_PASSWORD` dans les secrets Cloudflare.
2. Changez `SUPER_ADMIN_SESSION_VERSION` dans `wrangler.toml`, par exemple de `"1"` à `"2"`.
3. Redéployez le projet.

Toutes les sessions Super Admin créées avec l’ancienne version seront invalidées.

## Sécurité intégrée

- authentification par `POST /api/login` côté serveur ;
- cookie de session `HttpOnly`, `SameSite=Strict` et `Secure` en HTTPS ;
- sessions stockées dans KV ;
- limitation des tentatives par adresse IP et par compte ;
- contrôles de rôle côté Worker ;
- isolation de toutes les données par `bank_id` provenant de la session ;
- routes `/api/load` et `/api/save` protégées ;
- aucun stockage complet des données sensibles dans `localStorage` ;
- aucune authentification par jeton Bearer côté navigateur ;
- invalidation des sessions après changement de mot de passe.


## Compatibilité PBKDF2 Cloudflare

Le Worker utilise **PBKDF2-SHA-256 avec 100 000 itérations**, un sel aléatoire de 16 octets et une sortie de 256 bits. Cette valeur respecte la limite observée dans l’environnement Cloudflare utilisé par le projet.

Format enregistré dans D1 :

```text
pbkdf2_sha256$100000$SEL_ALEATOIRE$EMPREINTE
```

L’identifiant et le mot de passe Super Admin restent des secrets Cloudflare et ne sont jamais enregistrés dans le dépôt.

Si une tentative précédente avec une valeur supérieure à la limite Cloudflare itérations a échoué avant l’inscription, aucune ligne de compte n’a été créée, car le hash est calculé avant l’écriture dans D1.


## Formulaire professionnel Nouveau client — V5

La section **Clients** contient un bouton **+ Nouveau client** placé sur la même ligne que **Liste des clients**. Le popup propose les profils **Personne physique** et **Personne morale**, avec les champs détaillés correspondants.

Les photos et logos sont optimisés dans le navigateur, stockés dans le binding KV existant `KV`, puis servis uniquement par la route authentifiée `GET /api/client/media`. D1 conserve les informations textuelles et une référence interne à l’image. Aucune nouvelle variable ni aucun nouveau binding Cloudflare n’est nécessaire.

Les formats autorisés sont JPG, PNG et WebP. Les SVG et les fichiers trop volumineux sont refusés côté navigateur et côté Worker.


## Messagerie interne Super Admin / entreprises — V6

La section **Notifications** contient un bouton **Boîte de réception et d’envois** aligné avec le titre **Journal cloud**.

- L’Administrateur banque dispose du bouton **Contacter le support** et peut envoyer un message ou une note au Super Admin.
- Le Super Admin dispose d’une section **Messagerie** et peut envoyer un message ou une note à une ou plusieurs entreprises inscrites.
- Chaque partie gère sa réception, ses envois, les statuts de lecture, la recherche, les filtres, l’historique et la suppression.
- La suppression est séparée : retirer un message de la boîte d’une partie ne supprime pas automatiquement l’historique de l’autre partie.
- Toutes les opérations sont contrôlées côté Worker. Une entreprise ne peut accéder qu’aux messages liés au `bank_id` de sa session.

La table D1 `support_messages` est créée par la migration `migrations/0002_support_messages.sql`. Après mise à jour du dépôt, exécutez :

```bash
npm run db:migrate:remote
```

Aucune nouvelle variable ou liaison Cloudflare n’est nécessaire.

## Corrections interface V7

- Le bouton **+ Nouveau client** est visible dans la section Clients pour les sessions bancaires autorisées.
- La vérification côté interface s’appuie sur la session sécurisée chargée par `/api/me`; aucun jeton n’est stocké ou exposé dans le navigateur.
- Le texte informatif relatif au stockage D1 a été retiré des fenêtres **Contacter le support** et **Envoyer aux entreprises**.


## Ajustements de connexion et pages internes — V8

- La grande carte centrale de connexion est réduite de 20 % sur ordinateur : largeur maximale de 1 380 px à 1 104 px et hauteur minimale de 790 px à 632 px.
- Le panneau gauche consacré à l’identité de GLOBAL BANK occupe 40 % de la carte.
- Le panneau droit consacré au formulaire de connexion occupe 60 % de la carte.
- Les espacements, icônes, titres et cartes d’information ont été ajustés pour conserver un rendu équilibré.
- La bannière horizontale « Bienvenue, … / rôle / date et heure » a été supprimée de toutes les pages internes.
- Aucun nouveau binding, secret ou changement D1 n’est requis.

## Gestion RBAC complète — V9

La V9 sépare réellement les espaces `admin_bank`, `agent_caisse`, `agent_credit` et `auditeur`. Le Super Administrateur reste indépendant. Les menus, données renvoyées, actions et routes API sont filtrés par permission précise, avec contrôle systématique dans `public/_worker.js`.

La colonne `users.permissions` accepte une politique JSON de la forme :

```json
{"allow":["clients.create"],"deny":["moves.create.withdrawal"]}
```

Les autorisations supplémentaires sont limitées à une liste compatible avec le rôle. Elles ne peuvent jamais permettre à un agent de gérer les utilisateurs, les paramètres, une autre banque ou les secrets Cloudflare.

La V9 ajoute également :

- les demandes de correction et leur traitement par l'Administrateur banque ;
- le journal de sécurité enrichi avec la permission, la route et la ressource ;
- la suppression logique et la restauration des clients et comptes ;
- l'annulation logique des mouvements financiers ;
- l'invalidation immédiate d'une session lorsque l'utilisateur est bloqué, archivé ou que sa version d'authentification change ;
- des tests automatiques par rôle.

Après la mise à jour du dépôt :

```bash
npm install
npm run db:migrate:remote
npm run build
npm run test:security
```

Consultez `RBAC_V9.md` pour la matrice et les principes de sécurité.

## Mise à jour V10 — Tableau de bord Agent caisse

La V10 ajoute une présentation bancaire professionnelle spécifique au rôle `agent_caisse` : navigation vert foncé et dorée, cartes quotidiennes, dernières opérations, état vide et responsive mobile/tablette. Les autorisations RBAC de la V9 restent inchangées : aucun accès aux paramètres ou rapports administratifs n'est accordé à l'Agent caisse.


## Correction V15 — Comptes crédit

- La section « Crédits » a été retirée du menu horizontal de l’Administrateur banque.
- Depuis **Comptes**, le bouton **Rapport crédit** ouvre une page détaillée du crédit.
- La page présente le souscripteur, les conditions, la source d’approvisionnement, les totaux, les paiements, les pénalités, l’échéancier et tous les mouvements.
- Le retour ramène à la liste des comptes, sans passer par la section Rapports.


## Interface agents V15

Voir `AMELIORATIONS_AGENTS_V15.md` pour les nouveaux popups caisse, la liste des crédits et les fiches détaillées en lecture seule.


## Mouvements agents V15
Les listes de mouvements Agent caisse et Agent crédit sont fermées et vérifiées côté Worker. Consultez `MOUVEMENTS_AGENTS_V15.md`.


## Correction V16 — `hasAnyPerm`

La fonction d’interface `hasAnyPerm(keys)` est maintenant définie à côté de `hasPerm(key)`. Elle vérifie une liste de permissions dans la session réellement chargée par le serveur et corrige l’affichage des sections **Crédits**, **Mouvements** et **Mes opérations** des agents.

## V17 — Solde du Compte entreprise automatique

Formule officielle V20 : **capital crédit effectivement remboursé, plafonné au Crédit accordé + Total Revenu banque + solde des Approvisionnements actifs - Décaissements**. Un approvisionnement déjà affecté à un crédit n’est plus recompté dans le solde du Compte entreprise ; seule sa partie encore disponible reste active. Les frais, intérêts et pénalités ne sont jamais ajoutés au capital remboursé ; s’ils constituent un revenu bancaire, ils apparaissent uniquement dans le Total Revenu banque.
