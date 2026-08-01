# Correction PBKDF2

- Ancienne valeur incompatible : une valeur supérieure à `100000` itérations.
- Nouvelle valeur Cloudflare-compatible : `100000` itérations.
- Algorithme : PBKDF2-HMAC-SHA-256.
- Sel : 16 octets aléatoires par mot de passe.
- Sortie : 256 bits.
- Les secrets Super Admin ne figurent dans aucun fichier du projet.
