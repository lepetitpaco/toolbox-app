#!/bin/bash

echo "🚀 Configuration Docker pour Toolbox App"
echo ""

# Vérifier si Docker est installé
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé. Veuillez l'installer d'abord."
    exit 1
fi

# Vérifier si Docker Compose est installé
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose n'est pas installé. Veuillez l'installer d'abord."
    exit 1
fi

# Créer le fichier .env s'il n'existe pas
if [ ! -f .env ]; then
    echo "📝 Création du fichier .env..."
    cp env.example .env
    echo "✅ Fichier .env créé. N'oubliez pas de le configurer avec vos credentials AniList (optionnel)."
else
    echo "✅ Fichier .env existe déjà."
fi

# Créer le réseau Docker s'il n'existe pas
if ! docker network ls | grep -q "infra_net"; then
    echo "🌐 Création du réseau Docker 'infra_net'..."
    docker network create infra_net
    echo "✅ Réseau créé."
else
    echo "✅ Réseau 'infra_net' existe déjà."
fi

echo ""
echo "✅ Configuration terminée !"
echo ""
echo "Pour lancer le projet :"
echo "  docker-compose up -d"
echo ""
echo "Pour voir les logs :"
echo "  docker-compose logs -f"
echo ""
echo "Pour arrêter le projet :"
echo "  docker-compose down"
echo ""
