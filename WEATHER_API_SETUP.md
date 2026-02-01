# Configuration de l'API Météo WeatherAPI.com

## Pourquoi WeatherAPI.com ?

L'application utilise **WeatherAPI.com** (https://www.weatherapi.com/) pour :
- ✅ **Recherche de villes** : Utilise l'API Search/Autocomplete de WeatherAPI.com pour une recherche précise avec support des IDs
- ✅ **Prévisions détaillées** : Prévisions sur 5 jours avec données complètes
- ✅ **Support français** : Toutes les descriptions en français
- ✅ **Fallback automatique** : Si pas de clé API, utilise Nominatim (OpenStreetMap) pour la recherche et wttr.in pour les données météo

## Obtenir une clé API gratuite

1. Allez sur https://www.weatherapi.com/
2. Cliquez sur **"Sign Up"** (gratuit) ou connectez-vous sur https://www.weatherapi.com/my/
3. Créez un compte gratuit
4. Allez dans votre dashboard pour voir votre clé API
5. Copiez votre clé API

## Configuration

1. Copiez `env.example` vers `.env.local` :
   ```bash
   cp env.example .env.local
   ```

2. Ajoutez votre clé API dans `.env.local` :
   ```
   WEATHER_API_KEY=votre_cle_api_ici
   ```

3. Redémarrez votre serveur de développement :
   ```bash
   npm run dev
   ```

## Limites du plan gratuit

- ✅ **1,000,000 appels/mois**
- ✅ Suffisant pour un usage personnel

## Sans clé API

Si vous n'ajoutez pas de clé API, l'application utilisera automatiquement **wttr.in** comme avant. Tout fonctionnera, mais avec moins de fonctionnalités de recherche.
