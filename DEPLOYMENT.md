# Guide de déploiement Docker - Toolbox App

## Prérequis

1. **Docker** et **Docker Compose** installés sur le PC
2. **Git** installé (pour cloner le projet)

## Étapes de déploiement

### 1. Cloner le projet

```bash
git clone https://github.com/lepetitpaco/toolbox-app.git
cd toolbox-app
```

### 2. Créer le fichier `.env`

Copiez le fichier `env.example` vers `.env` :

```bash
cp env.example .env
```

Puis éditez `.env` avec vos credentials AniList (optionnel si vous n'utilisez pas AniList) :

```env
ANILIST_CLIENT_ID=your_client_id_here
ANILIST_CLIENT_SECRET=your_client_secret_here
ANILIST_REDIRECT_URI=http://localhost:3000/api/anilist/auth/callback
```

**Note :** Pour obtenir les credentials AniList :
- Allez sur https://anilist.co/settings/developer
- Créez une nouvelle application
- Définissez l'URI de redirection : `http://localhost:3000/api/anilist/auth/callback`

### 3. Configuration du réseau Docker

Le `docker-compose.yml` utilise un réseau externe `infra_net`. Créez-le si nécessaire :

```bash
docker network create infra_net
```

**OU** si vous n'avez pas besoin de la base de données PostgreSQL, modifiez `docker-compose.yml` pour retirer la dépendance au réseau externe (voir section "Option : Sans base de données" ci-dessous).

### 4. Lancer le projet

```bash
docker-compose up -d
```

Le projet sera accessible sur : **http://localhost:3000**

### 5. Vérifier les logs

```bash
docker-compose logs -f
```

### 6. Arrêter le projet

```bash
docker-compose down
```

## Option : Sans base de données PostgreSQL

Si vous n'avez pas besoin de la base de données, modifiez `docker-compose.yml` :

1. Retirez la référence au réseau externe `infra_net`
2. Retirez la variable `DATABASE_URL` ou définissez-la sur une valeur par défaut

Exemple de modification :

```yaml
version: "3.9"

services:
  web:
    container_name: toolbox_web
    build:
      context: .
      dockerfile: Dockerfile
    working_dir: /app

    ports:
      - "3000:3000"

    volumes:
      - .:/app:cached
      - /app/node_modules
      - /app/.next

    environment:
      - NODE_ENV=development
      - CHOKIDAR_USEPOLLING=true
      - CHOKIDAR_INTERVAL=1000
      - WATCHPACK_POLLING=true
      - WATCHPACK_AGGREGATE_TIMEOUT=300
      - NEXT_TELEMETRY_DISABLED=1
    env_file:
      - .env

    command: npm run dev:webpack -- -H 0.0.0.0

    restart: unless-stopped
```

## Commandes utiles

### Rebuild l'image Docker
```bash
docker-compose build --no-cache
```

### Redémarrer le conteneur
```bash
docker-compose restart
```

### Voir les conteneurs en cours d'exécution
```bash
docker ps
```

### Accéder au shell du conteneur
```bash
docker exec -it toolbox_web sh
```

### Nettoyer (supprimer conteneurs, images, volumes)
```bash
docker-compose down -v
docker system prune -a
```

## Dépannage

### Le port 3000 est déjà utilisé
Modifiez le port dans `docker-compose.yml` :
```yaml
ports:
  - "3001:3000"  # Changez 3001 par le port de votre choix
```

### Hot reload ne fonctionne pas
Assurez-vous que les variables d'environnement `CHOKIDAR_*` et `WATCHPACK_*` sont bien définies dans `docker-compose.yml`.

### Erreur de réseau Docker
Si vous obtenez une erreur concernant `infra_net`, créez le réseau :
```bash
docker network create infra_net
```

### Problèmes de permissions (Linux/Mac)
Si vous avez des problèmes de permissions avec les volumes, vous pouvez ajuster les permissions :
```bash
sudo chown -R $USER:$USER .
```

## Production

Pour un déploiement en production, vous devrez :

1. Modifier le `Dockerfile` pour construire l'application :
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/package*.json ./
RUN npm install --production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["npm", "start"]
```

2. Modifier `docker-compose.yml` pour utiliser `npm start` au lieu de `npm run dev`

3. Configurer les variables d'environnement de production dans `.env`
