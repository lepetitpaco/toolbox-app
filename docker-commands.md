# Commandes Docker pour toolbox-app

## Reconstruire et démarrer le container

### Option 1 : Reconstruire complètement (recommandé après modifications du Dockerfile)
```bash
cd /mnt/f/dev/projects/toolbox-app
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Option 2 : Redémarrer simplement (si pas de changement dans Dockerfile)
```bash
cd /mnt/f/dev/projects/toolbox-app
docker-compose restart
```

### Option 3 : Arrêter, supprimer et recréer
```bash
cd /mnt/f/dev/projects/toolbox-app
docker-compose down
docker-compose up -d --build
```

## Voir les logs
```bash
docker logs toolbox_web -f
```

## Entrer dans le container
```bash
docker exec -it toolbox_web sh
```

## Nettoyer complètement (si problèmes persistants)
```bash
cd /mnt/f/dev/projects/toolbox-app
docker-compose down -v
docker rmi toolbox-app-web 2>/dev/null || true
docker-compose build --no-cache
docker-compose up -d
```

## Vérifier que le container tourne
```bash
docker ps | grep toolbox_web
```

## Accéder à l'application
Une fois le container démarré, accédez à :
- http://localhost:3000
- http://localhost:3000/anilist
