# GLOBAL BANK — Nouveau formulaire client V5

Cette version ajoute et sécurise le formulaire professionnel **Nouveau client** dans la section **Clients**.

## Interface

- Bouton **+ Nouveau client** placé sur la même ligne que **Liste des clients**.
- Popup responsive avec choix exclusif : **Personne physique** ou **Personne morale**.
- Affichage dynamique des champs correspondant au type choisi.
- Photo du client ou logo de l’entreprise avec aperçu.
- Formats autorisés : JPG, PNG et WebP.
- Limite avant optimisation : 5 Mo.
- Redimensionnement et compression automatiques dans le navigateur.

## Sécurité serveur

- Le Worker valide à nouveau le type de client et tous les champs obligatoires.
- Seuls les champs autorisés sont enregistrés.
- Les images SVG, les formats inconnus et les images trop volumineuses sont refusés.
- Aucun mot de passe client reçu par cette route n’est enregistré.
- La photo ou le logo n’est pas dupliqué dans le JSON détaillé.
- Les images optimisées sont enregistrées dans KV ; D1 ne conserve qu’une référence interne.
- La consultation de l’image passe par `GET /api/client/media`, protégée par la session et le `bank_id`.
- L’ancienne image est conservée lorsqu’un client est modifié sans choisir un nouveau fichier.
- Chaque insertion ou modification reste limitée au `bank_id` de la session active.

Aucune nouvelle variable Cloudflare n’est nécessaire. Les colonnes D1 utilisées (`client_type`, `client_details`, `photo_logo`) sont déjà créées par le schéma et par la mise à niveau automatique du Worker.
