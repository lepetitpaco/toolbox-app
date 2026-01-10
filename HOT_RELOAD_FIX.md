# Fix Hot Reload - Guide de dépannage

## Problème
Le hot reload ne fonctionne pas dans Docker avec Next.js 16 et Turbopack.

## Solution appliquée
1. ✅ Utilisation de Webpack au lieu de Turbopack (`--webpack`)
2. ✅ Configuration du polling dans `next.config.ts`
3. ✅ Variables d'environnement pour le polling
4. ✅ Volume monté avec `:cached` pour de meilleures performances

## Commandes pour appliquer le fix

### 1. Arrêter le container actuel
```bash
cd /mnt/f/dev/projects/toolbox-app
docker-compose down
```

### 2. Reconstruire avec les nouvelles configurations
```bash
docker-compose build --no-cache
docker-compose up -d
```

### 3. Vérifier les logs
```bash
docker logs toolbox_web -f
```

Vous devriez voir :
```
> next dev --webpack -H 0.0.0.0
```

## Test du hot reload

1. Ouvrez `http://localhost:3000/anilist`
2. Modifiez `app/anilist/page.tsx` (par exemple, changez le titre)
3. Sauvegardez le fichier
4. Attendez 1-2 secondes
5. Rafraîchissez la page (F5) - les changements devraient apparaître

## Si ça ne fonctionne toujours pas

### Option 1 : Vérifier que les fichiers sont bien montés
```bash
docker exec toolbox_web ls -la /app/app/anilist/
```

### Option 2 : Tester la détection de fichiers
```bash
# Dans un terminal, surveillez les logs
docker logs toolbox_web -f

# Dans un autre terminal, touchez un fichier
touch app/anilist/page.tsx

# Vous devriez voir une recompilation dans les logs
```

### Option 3 : Nettoyer complètement
```bash
docker-compose down -v
docker rmi toolbox-app-web 2>/dev/null || true
rm -rf .next
docker-compose build --no-cache
docker-compose up -d
```

### Option 4 : Vérifier les permissions
```bash
# Vérifier que les fichiers sont accessibles
docker exec toolbox_web ls -la /app/app/anilist/page.tsx

# Si problème de permissions, ajuster
docker exec toolbox_web chown -R node:node /app
```

## Dépannage avancé

### Vérifier la configuration Webpack
Les logs devraient montrer :
- `webpack compiled` au lieu de `Turbopack`
- Pas d'erreurs de polling

### Forcer un rechargement manuel
Si le hot reload ne fonctionne pas, vous pouvez toujours :
1. Modifier le fichier
2. Attendre 2-3 secondes
3. Faire un hard refresh (Ctrl+F5)

Le serveur devrait recompiler automatiquement même si le navigateur ne se rafraîchit pas automatiquement.
