# GLOBAL BANK V6 — Messagerie interne sécurisée

## Fonctionnalités

- Bouton **Boîte de réception et d’envois** aligné avec le titre **Journal cloud**.
- Bouton **Contacter le support** pour l’Administrateur banque.
- Envoi de messages ou notes au Super Admin.
- Envoi Super Admin vers une ou plusieurs entreprises.
- Historique réception/envois, recherche, filtres, statut de lecture et suppression.
- Suppression séparée : chaque partie retire un message de sa propre boîte sans effacer immédiatement l’historique de l’autre partie.

## Sécurité

- Toutes les routes exigent une session HttpOnly valide.
- Les routes entreprises exigent le rôle `admin_bank`.
- Une entreprise ne peut lire, marquer ou supprimer que les lignes liées à son `bank_id`.
- Les routes globales exigent le rôle Super Admin.
- Le contenu est rendu avec échappement HTML.
- Limites : objet 160 caractères, contenu 5 000 caractères, 200 destinataires maximum par envoi.

## D1

La table `support_messages` est créée automatiquement par le Worker. Pour une migration explicite, exécutez :

```bash
npm run db:migrate:remote
```
