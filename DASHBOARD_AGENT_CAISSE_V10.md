# GLOBAL BANK V10 — Tableau de bord Agent caisse

Cette version améliore uniquement la présentation du tableau de bord de l’Agent caisse sans élargir ses autorisations RBAC.

## Interface

- barre supérieure vert bancaire et doré ;
- logo bancaire vectoriel ;
- menu adapté au rôle `agent_caisse` ;
- vrai nom et vrai rôle de l’utilisateur connecté ;
- quatre cartes quotidiennes ;
- tableau des dernières opérations de l’agent ;
- état vide professionnel ;
- deux cartes par ligne sur tablette ;
- une carte par ligne et menu hamburger sur téléphone.

## Sécurité conservée

Les pages Rapports administratifs et Paramètres ne sont pas ajoutées au menu Agent caisse, car elles sont interdites par le RBAC V9. Le texte du bandeau précise que seules les fonctions autorisées sont contrôlées par le serveur.
