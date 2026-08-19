# GLOBAL BANK V27 — MENU PERSISTANT, SCROLL ET RAPIDITÉ

## Corrections appliquées

- L'utilisateur connecté conserve ses menus métier lorsqu'il revient sur la page d'accueil.
- Sur l'accueil, une barre de menu connectée affiche les boutons autorisés selon le rôle.
- À la déconnexion, cette barre et les menus connectés disparaissent automatiquement.
- Les boutons `Se connecter` et `Créer ma banque` sont masqués sur l'accueil lorsque la session est connectée et remplacés par un état connecté.
- Les menus applicatifs utilisent une bannière horizontale vert-noir en dégradé avec ombre et accents dorés.
- Le bouton Accueil reste présent dans les menus connectés.
- Correction du défilement vertical après fermeture des popups/modales et après connexion.
- Réinitialisation propre des verrous `overflow` quand aucun popup n'est ouvert.
- Navigation vers une page métier repositionnée en haut sans bloquer le défilement.
- Réactivité des clics améliorée avec gestion événementielle globale légère et transitions réduites.

## Contrôles

- Build Cloudflare validé.
- Tests sécurité, RBAC, crédits, approvisionnements et tableau de bord validés.
- Aucune migration D1 supplémentaire nécessaire.
