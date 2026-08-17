# GLOBAL BANK V19 — Décaissement et Carte Performance Approvisionnements

## Synchronisation du Compte entreprise

La formule officielle du Compte entreprise automatique tient désormais compte des mouvements de trésorerie réels :

**Solde Compte entreprise = capital crédit remboursé (limité au capital accordé) + revenus banque + approvisionnements - décaissements.**

Conséquences :
- un décaissement diminue immédiatement le solde du Compte entreprise ;
- la carte « Solde banque » suit ce nouveau solde ;
- la ligne « Solde actif Compte entreprise automatique » suit le mouvement ;
- le bénéfice net / solde Compte entreprise affiché sur le tableau de bord suit le mouvement ;
- les calculs mensuels de Gestion qui utilisent le Compte entreprise suivent également la période ;
- l’annulation logique d’un mouvement resynchronise le solde stocké du Compte entreprise.

## Nouvelle Carte performance — Approvisionnements

La carte affiche :
- **Approvisionnement total** : total des mouvements « Approvisionnement » du Compte entreprise ;
- **Approvisionnement admis en crédit** : part des approvisionnements déjà affectée comme source de comptes crédit ;
- **Approvisionnement restant** : Approvisionnement total - Approvisionnement admis en crédit.

Aucune migration D1 supplémentaire n’est nécessaire.
