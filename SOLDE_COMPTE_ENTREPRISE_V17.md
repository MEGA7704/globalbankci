# GLOBAL BANK V17 — Solde du Compte entreprise automatique

Règle officielle appliquée :

**Solde Compte entreprise automatique = Total du capital crédit remboursé, limité au montant Crédit accordé + Total Revenu banque.**

- Chaque paiement de crédit alimente progressivement la part « capital remboursé ».
- Le cumul de cette part ne peut jamais dépasser le montant `credit_amount` / « Crédit accordé » de chaque compte crédit.
- Les frais, intérêts et pénalités ne sont pas ajoutés à la part capital.
- Les frais, intérêts et pénalités classés comme revenus sont pris en compte une seule fois dans « Total Revenu banque ».
- Approvisionnement et Décaissement restent des flux/source de financement et sont exclus du solde officiel du Compte entreprise automatique.
- Les mouvements annulés (`is_voided=1`) sont exclus du calcul serveur des revenus.
