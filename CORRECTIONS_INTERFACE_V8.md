# Corrections interface V8

## Page de connexion

- Réduction de 20 % de la largeur maximale de la carte centrale : 1380 px → 1104 px.
- Réduction proportionnelle de la hauteur minimale : 790 px → 632 px.
- Répartition desktop : panneau gauche 40 %, panneau droit 60 %.
- Ajustement des espacements, titres, icônes et cartes d’information pour conserver une présentation équilibrée.
- Comportement responsive conservé : sous 1120 px, les deux panneaux passent verticalement.

## Pages internes

- Suppression de la bannière horizontale « Bienvenue, … / rôle / date et heure ».
- La fonction `welcome()` ne génère plus de contenu.
- Une règle CSS de sécurité masque également tout ancien composant `.welcome` pouvant provenir d’un cache ou d’un futur rendu.
