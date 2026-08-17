# GLOBAL BANK V20 — Solde actif du Compte entreprise

## Correction ciblée

Le **Solde actif Compte entreprise automatique** ne reprend plus le cumul brut de tous les approvisionnements historiques.

La formule officielle est désormais :

**SOLDE COMPTE ENTREPRISE = CAPITAL CRÉDIT REMBOURSÉ + REVENU BANQUE + APPROVISIONNEMENTS ACTIFS - DÉCAISSEMENTS**

### Définition des Approvisionnements actifs

Pour chaque mouvement d’approvisionnement valide :

**Approvisionnement actif = max(0, montant approvisionné - capital des crédits déjà affectés à cet approvisionnement)**

Le total des Approvisionnements actifs correspond donc au **solde encore disponible/non affecté** des approvisionnements.

Exemple :
- Approvisionnement : 115 000 FCFA
- Capital crédit financé avec cette source : 115 000 FCFA
- Approvisionnement actif : 0 FCFA

Lorsque le client rembourse son crédit, seule la part de **capital effectivement remboursée**, plafonnée au capital accordé, revient dans le Solde Compte entreprise. Cela évite le double comptage du même capital.

Les décaissements continuent à diminuer immédiatement le Solde Compte entreprise et tous les indicateurs dépendants du tableau de bord.
