# GLOBAL BANK — Cloudflare Pages + GitHub sécurisé

Cette version relie directement le Worker aux ressources Cloudflare sans inscrire les identifiants Super Admin dans le dépôt.

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
