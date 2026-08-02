# GLOBAL BANK V16 — Correction `hasAnyPerm`

## Erreur corrigée

Les pages Agent caisse et Agent crédit appelaient `hasAnyPerm(...)` sans que la fonction soit définie dans `public/index.html`, ce qui bloquait le rendu avec l’erreur :

```text
hasAnyPerm is not defined
```

## Correction appliquée

```javascript
function hasAnyPerm(keys) {
  const list = Array.isArray(keys) ? keys : [keys];
  return list.filter(Boolean).some(key => hasPerm(String(key)));
}
```

Cette fonction :

- accepte une permission seule ou une liste ;
- s’appuie sur `hasPerm`, donc sur les permissions finales de la session ;
- ne fait confiance à aucun rôle ou droit envoyé depuis le navigateur ;
- rétablit l’affichage des sections Crédits, Mouvements et Mes opérations.
