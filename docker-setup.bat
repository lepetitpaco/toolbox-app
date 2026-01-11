@echo off
echo 🚀 Configuration Docker pour Toolbox App
echo.

REM Vérifier si Docker est installé
where docker >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Docker n'est pas installé. Veuillez l'installer d'abord.
    exit /b 1
)

REM Vérifier si Docker Compose est installé
where docker-compose >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Docker Compose n'est pas installé. Veuillez l'installer d'abord.
    exit /b 1
)

REM Créer le fichier .env s'il n'existe pas
if not exist .env (
    echo 📝 Création du fichier .env...
    copy env.example .env >nul
    echo ✅ Fichier .env créé. N'oubliez pas de le configurer avec vos credentials AniList (optionnel).
) else (
    echo ✅ Fichier .env existe déjà.
)

REM Créer le réseau Docker s'il n'existe pas
docker network ls | findstr /C:"infra_net" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo 🌐 Création du réseau Docker 'infra_net'...
    docker network create infra_net
    echo ✅ Réseau créé.
) else (
    echo ✅ Réseau 'infra_net' existe déjà.
)

echo.
echo ✅ Configuration terminée !
echo.
echo Pour lancer le projet :
echo   docker-compose up -d
echo.
echo Pour voir les logs :
echo   docker-compose logs -f
echo.
echo Pour arrêter le projet :
echo   docker-compose down
echo.
