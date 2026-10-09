# GLOBAL BANK V15 — Types de mouvements des agents

## Agent caisse
Types autorisés par défaut et contrôlés dans `_worker.js` :

- Dépôt
- Retrait
- Frais dépôt espèce
- Frais retrait espèce
- Frais de recouvrement
- Frais de relevé bancaire
- Frais de clôture
- Frais de gestion mensuelle
- Frais de carnet

L’Agent caisse intervient uniquement sur les comptes clients ordinaires. Il ne peut ni utiliser le Compte entreprise automatique, ni agir sur un compte crédit.

## Agent crédit
Types autorisés par défaut et contrôlés dans `_worker.js` :

- Approvisionnement — uniquement sur le Compte entreprise automatique
- Paiement de crédit — uniquement sur un compte crédit
- Frais de pénalité de retard — uniquement sur un compte crédit
- Frais de carnet crédit — uniquement sur un compte crédit

Toute autre valeur envoyée depuis le navigateur est refusée avec `403 Forbidden`.
