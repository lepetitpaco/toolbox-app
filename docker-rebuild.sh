#!/bin/bash

# Script pour reconstruire et démarrer le container avec hot reload

cd "$(dirname "$0")"

echo "🛑 Arrêt du container..."
docker-compose down

echo "🔨 Reconstruction de l'image..."
docker-compose build --no-cache

echo "🚀 Démarrage du container..."
docker-compose up -d

echo "📋 Logs du container (Ctrl+C pour quitter):"
docker logs toolbox_web -f
