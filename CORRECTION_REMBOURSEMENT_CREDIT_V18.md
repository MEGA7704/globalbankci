# Correction V18 — remboursement de crédit

## Problème corrigé
Un paiement de crédit pouvait être refusé avec **« Solde insuffisant »** lorsque le solde stocké dans `accounts.balance` était désynchronisé du **reste à rembourser réellement affiché** dans l’interface.

Exemple corrigé :
- reste à rembourser : **108 000 FCFA** ;
- paiement reçu : **10 000 FCFA** ;
- nouveau reste : **98 000 FCFA**.

## Nouvelle règle serveur
Pour un **Paiement de crédit**, le serveur récupère désormais le reste à rembourser depuis le dernier mouvement crédit valide (`balance_after`, hors mouvements annulés), qui est la même source logique que l’affichage du compte crédit.

Le contrôle « Solde insuffisant » reste réservé aux débits de comptes ordinaires. Pour un crédit, le serveur bloque uniquement un paiement qui **dépasse le reste à rembourser**.

Après paiement, `accounts.balance` est automatiquement resynchronisé sur le nouveau reste à rembourser.

## Sécurité conservée
- paiement strictement supérieur à 0 ;
- interdiction de payer plus que la dette restante ;
- contrôle du rôle et du type de mouvement maintenu côté serveur ;
- mouvements annulés exclus du calcul du reste de référence.
