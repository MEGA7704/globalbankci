# GLOBAL BANK — Cloudflare Pages + GitHub + KV + D1

Cette version est préparée pour un dépôt GitHub connecté à Cloudflare Pages. Le code serveur se trouve dans `public/_worker.js` en mode avancé Cloudflare Pages.

## Configuration Cloudflare Pages

- **Branche de production :** `main`
- **Infrastructure / Framework prédéfini :** `Aucun`
- **Commande de compilation :** `npm run build`
- **Répertoire de sortie :** `public`
- **Répertoire racine :** laisser vide, ou `/` selon l’interface

Les liaisons D1 et KV sont déjà déclarées dans `wrangler.toml` avec les noms suivants :

- D1 : binding `DB`, base `bankdb`
- KV : binding `KV`

## Installation et migration D1

```bash
npm install
npx wrangler login
npm run db:migrate:remote
```

La migration initiale est dans `migrations/0001_schema.sql`. Le Worker garde également une procédure de compatibilité qui complète automatiquement les colonnes absentes lors du premier appel API.

## Secrets Super Admin

Les identifiants Super Admin ne sont présents dans aucun fichier. Ils doivent être ajoutés comme secrets chiffrés Cloudflare Pages :

```bash
npx wrangler pages secret put SUPER_ADMIN_LOGIN --project-name global-bank
npx wrangler pages secret put SUPER_ADMIN_PASSWORD --project-name global-bank
npx wrangler pages secret put SUPER_ADMIN_SESSION_VERSION --project-name global-bank
```

Wrangler demande chaque valeur dans le terminal. Ne mettez jamais ces valeurs dans GitHub, `wrangler.toml`, le README, `.env`, une capture d’écran ou le code source.

Dans le tableau de bord Cloudflare, la même configuration est disponible dans : **Workers & Pages → global-bank → Settings → Variables and Secrets**. Utiliser le type **Secret / Encrypté**.

Pour le développement local, créer un fichier `.dev.vars` non versionné :

```text
SUPER_ADMIN_LOGIN=valeur-locale
SUPER_ADMIN_PASSWORD=valeur-locale
SUPER_ADMIN_SESSION_VERSION=1
```

## Changement du mot de passe Super Admin

1. Mettre à jour le secret `SUPER_ADMIN_PASSWORD`.
2. Modifier `SUPER_ADMIN_SESSION_VERSION` avec une nouvelle valeur, par exemple passer de `1` à `2`.
3. Redéployer le projet.

Le changement de version invalide automatiquement toutes les anciennes sessions Super Admin. Pour les administrateurs de banque et les agents, l’invalidation est automatique dès qu’un mot de passe est modifié ou réinitialisé.

## Sécurité intégrée

- route serveur réelle `POST /api/login` ;
- vérification des mots de passe uniquement dans `_worker.js` ;
- empreintes PBKDF2-SHA256 avec sel aléatoire et 210 000 itérations pour les comptes D1 ;
- aucun hash ni sel envoyé au navigateur ;
- session en cookie HttpOnly, SameSite Strict et Secure en HTTPS ;
- `/api/load` et `/api/save` exigent une session valide ;
- sauvegarde globale des données sensibles désactivée ;
- contrôle du rôle Super Admin sur les routes centrales ;
- contrôle du rôle Administrateur banque sur les paramètres sensibles ;
- `bank_id` toujours obtenu depuis la session pour les actions d’entreprise ;
- limitation des tentatives de connexion par adresse IP et par compte ;
- invalidation des sessions après changement, réinitialisation ou blocage d’un compte ;
- absence de données métier sensibles dans `localStorage` ;
- validation de l’origine des requêtes POST et en-têtes de sécurité.

## Déploiement GitHub

1. Créer un dépôt GitHub privé ou public et placer ces fichiers à la racine.
2. Envoyer le projet sur la branche `main`.
3. Dans Cloudflare Pages, choisir **Connect to Git**, sélectionner le dépôt et appliquer les paramètres ci-dessus.
4. Ajouter les trois secrets avant le déploiement final, ou les ajouter puis relancer un déploiement.
5. Appliquer la migration D1 une seule fois avec `npm run db:migrate:remote`.

## Vérifications avant envoi GitHub

```bash
npm run build
node --check public/_worker.js
npm run test:security
```

Le déploiement utilise Wrangler `4.114.0`. Le test local de sécurité nécessite Node.js 22 ou une version plus récente à cause du module SQLite intégré ; il ne fait pas partie de la commande de compilation Cloudflare.

Le script de construction bloque le déploiement si un identifiant Super Admin codé en dur, un secret ou un stockage de jeton navigateur est détecté. Le test de sécurité utilise le Worker réel avec D1/SQLite et KV en mémoire, sans vos identifiants de production.
