# ASSOCIATION OUKAMI DE DIABO — adaptation

Projet mono-association dérivé de ASSOCIATION OUKAMI DE DIABO.

## Cloudflare bindings
- KV binding `KV` → namespace `OUKAMI_KV`, ID `25eac34d165240bfbd8c1bcd14c2954d`
- D1 binding `DB` → base `oukami_d1`, ID `001c173e-694b-434d-a8fc-8c5fa2351438`
- Super Admin login : `mega@services.local`
- Le mot de passe Super Admin n’est volontairement pas présent dans ce dépôt. Configurez le secret Cloudflare `SUPER_ADMIN_PASSWORD`.

## Initialisation
La route d’initialisation `/api/register` ne peut créer qu’une seule structure et force son nom à `ASSOCIATION OUKAMI DE DIABO`. Une fois créée, toute seconde structure est refusée.

## Accès client
Le client saisit son numéro de compte depuis « Espace client ». L’API `/api/client-view` renvoie uniquement les informations du titulaire, l’état du compte et les mouvements. Aucun endpoint de modification n’est accessible depuis ce portail.

> Sécurité : un numéro de compte seul constitue un facteur d’authentification faible. Pour une mise en production contenant des données personnelles, il est recommandé d’ajouter un code PIN client ou un OTP SMS.
