# Toolbox App

A Next.js application providing various tools and utilities, including AniList integration, weather forecasts, calculators, and more.

## Features

### 🏠 Homepage
- **Customizable app launcher** with draggable app icons
- **Persistent layout** saved in localStorage
- **Multiple tools** accessible from the main page

### 📺 AniList Tools

#### Home Page (`/anilist/home`)
- **View user activities** from AniList with full comment threads
- **Filter activities** by type:
  - All activities
  - List (All) - All list activities (anime + manga)
  - List (Anime) - Anime list activities only
  - List (Manga) - Manga list activities only
  - Text - Text posts
  - Message - Direct messages
- **Filter by status** (client-side, only for list activities):
  - In Progress / Watching / Reading
  - Planning
  - Completed
  - Dropped
  - Paused
  - Repeating
- **Sort activities** by date, likes, or replies
- **Like/unlike activities and comments** (requires login)
- **View user statistics** (anime/manga counts, mean scores, episodes/chapters read)
- **Persistent user preferences** (username, theme, filters per user)
- **Lazy loading of comments** with pagination
- **Link to AniList posts** for commenting

#### Search Page (`/anilist/search`)
- **Search for anime and manga** by title
- **View media details** with description, cover image, and metadata
- **View social scores** from followed users (requires login)
- **Click on user scores** to view their list activities for that specific media
- **Cached results** with TTL (10 minutes) to reduce API calls

#### Authentication
- **OAuth2 login** with AniList
- **Persistent sessions** with token storage
- **Automatic token refresh** handling

#### Customization
- **Multiple color themes** (default, blue, green, purple, orange, etc.)
- **Custom background images** with translucency effects
- **Dark mode support** with smooth transitions
- **Theme preferences** saved in localStorage

### 🌤️ Weather (`/meteo`)
- **Multi-city weather forecasts** with drag-and-drop reordering
- **5-day detailed forecasts** with hourly data
- **City search** using WeatherAPI.com Search API with precise location matching
- **Current conditions** including temperature, humidity, wind, pressure, visibility
- **Sunrise/sunset times** and astronomy data
- **Direct links** to WeatherAPI.com detailed weather pages
- **Persistent city list** saved in localStorage
- **Auto-refresh** every 10 minutes
- **Fallback support** to wttr.in if API key is not configured

### ⏰ Countdown Timer (`/countdown`)
- **Custom countdown timers** to specific dates and times
- **Visual countdown display** with days, hours, minutes, seconds
- **Multiple timers** support
- **Persistent timers** saved in localStorage

### 🔐 Encoder/Decoder (`/encoder`)
- **Base64 encoding/decoding**
- **URL encoding/decoding**
- **HTML entity encoding/decoding**
- **Copy to clipboard** functionality

### 📝 Calculator (`/calculator`)
- **Scientific calculator** with advanced functions
- **Expression evaluation**
- **History of calculations**
- **Keyboard shortcuts** support

### 📅 Date Calculator (`/date-calculator`)
- **Calculate difference** between two dates
- **Add/subtract** days, weeks, months, years to/from a date
- **Multiple date formats** support
- **Timezone handling**

### 📊 File Diff (`/file-diff`)
- **Compare two text files** or text blocks
- **Side-by-side diff view** with syntax highlighting
- **Line-by-line comparison** with added/removed indicators
- **Export diff results**

### ✨ Formatter (`/formatter`)
- **JSON formatting** and validation
- **XML formatting**
- **Code beautification**
- **Minification** support

## Tech Stack

- **Framework**: Next.js 16.1.1 (App Router)
- **Language**: TypeScript
- **Styling**: CSS Modules with CSS Variables for theming
- **APIs**:
  - AniList GraphQL API
  - WeatherAPI.com (weather data and city search)
  - Nominatim/OpenStreetMap (fallback for city search)
  - wttr.in (fallback for weather data)
- **Authentication**: OAuth2
- **Storage**: localStorage for preferences and cache
- **Containerization**: Docker & Docker Compose

## Getting Started

### Prerequisites

- **Docker** and **Docker Compose** installed
- **Git** installed (for cloning the repository)
- An external Docker network named `infra_net` (optional, for database connection)
- AniList OAuth credentials (optional, for login feature):
  - Go to [AniList Developer Settings](https://anilist.co/settings/developer)
  - Create a new application
  - Set the redirect URI to: `http://localhost:3000/api/anilist/auth/callback` (or your production URL)
  - Copy your `Client ID` and `Client Secret`
- WeatherAPI.com API key (optional, for enhanced weather features):
  - See [WeatherAPI.com Setup](#weatherapicom-setup) section below

### Installation

1. **Clone the repository:**
```bash
git clone <repository-url>
cd toolbox-app
```

2. **Update the repository (if already cloned):**
```bash
git pull
```

3. **Configure environment variables (optional):**
   - Create a `.env` file from `env.example`:
     ```bash
     cp env.example .env
     ```
   - Edit `.env` and add your credentials (all optional):
     ```env
     # AniList OAuth (optional)
     ANILIST_CLIENT_ID=your_client_id_here
     ANILIST_CLIENT_SECRET=your_client_secret_here
     ANILIST_REDIRECT_URI=http://localhost:3000/api/anilist/auth/callback
     
     # WeatherAPI.com (optional)
     WEATHER_API_KEY=your_weatherapi_key_here
     ```

4. **Create Docker network (if needed):**
```bash
docker network create infra_net
```

5. **Start the project:**
```bash
docker-compose up -d
```

### Development

#### Using Docker

**Start the project:**
```bash
docker-compose up -d
```

**View logs:**
```bash
docker-compose logs -f
# or
docker logs toolbox_web -f
```

**Access the application:**
- Homepage: http://localhost:3000
- AniList Home: http://localhost:3000/anilist/home
- AniList Search: http://localhost:3000/anilist/search
- Weather: http://localhost:3000/meteo
- Countdown: http://localhost:3000/countdown
- Encoder: http://localhost:3000/encoder
- Calculator: http://localhost:3000/calculator
- Date Calculator: http://localhost:3000/date-calculator
- File Diff: http://localhost:3000/file-diff
- Formatter: http://localhost:3000/formatter
- Settings: http://localhost:3000/settings

**Stop the container:**
```bash
docker-compose down
```

#### Local Development (without Docker)

**Note:** This project is designed to run with Docker. For local development without Docker, you'll need Node.js 20+ installed.

1. **Install dependencies:**
```bash
npm install
```

2. **Start the development server:**
```bash
npm run dev
# or with Webpack (for better hot reload)
npm run dev:webpack
```

3. **Access the application:**
- http://localhost:3000

### Docker Commands

#### Rebuild and restart (after Dockerfile changes)
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

#### Simple restart (no Dockerfile changes)
```bash
docker-compose restart
```

#### Stop and remove containers
```bash
docker-compose down
```

#### Complete cleanup (if issues persist)
```bash
docker-compose down -v
docker rmi toolbox-app-web 2>/dev/null || true
rm -rf .next
docker-compose build --no-cache
docker-compose up -d
```

#### Enter the container
```bash
docker exec -it toolbox_web sh
```

#### Check if container is running
```bash
docker ps | grep toolbox_web
```

#### View running containers
```bash
docker ps
```

#### Access container shell
```bash
docker exec -it toolbox_web sh
```

#### Clean up (remove containers, images, volumes)
```bash
docker-compose down -v
docker system prune -a
```

## Hot Reload

The application is configured to use Webpack instead of Turbopack for better hot reload support in Docker environments.

### Configuration

- **Bundler**: Webpack (via `--webpack` flag)
- **File watching**: Polling enabled (`CHOKIDAR_USEPOLLING=true`)
- **Polling interval**: 1000ms
- **Volume mounting**: Uses `:cached` for better performance

### Testing Hot Reload

1. Open http://localhost:3000
2. Modify a file (e.g., `app/page.tsx`)
3. Save the file
4. Wait 1-2 seconds
5. Refresh the page (F5) - changes should appear

### Troubleshooting Hot Reload

#### Check file mounting
```bash
docker exec toolbox_web ls -la /app/app/
```

#### Monitor logs
```bash
docker logs toolbox_web -f
```

#### Verify Webpack is running
The logs should show:
```
> next dev --webpack -H 0.0.0.0
```

#### Force manual reload
If hot reload doesn't work:
1. Modify the file
2. Wait 2-3 seconds
3. Hard refresh (Ctrl+F5)

The server should recompile automatically even if the browser doesn't auto-refresh.

## Project Structure

```
toolbox-app/
├── app/
│   ├── anilist/              # AniList integration
│   │   ├── home/             # Home page (activities)
│   │   │   └── page.tsx
│   │   ├── search/           # Search page (media search)
│   │   │   └── page.tsx
│   │   ├── layout.tsx        # Shared layout with header
│   │   ├── page.tsx          # Redirect to /anilist/home
│   │   └── anilist.module.css
│   ├── api/
│   │   ├── anilist/          # AniList API routes
│   │   │   ├── activities/   # Get user activities
│   │   │   ├── activity-like/ # Like/unlike activities
│   │   │   ├── auth/         # OAuth authentication
│   │   │   ├── callback/     # OAuth callback
│   │   │   ├── following/    # Get followed users
│   │   │   ├── media/        # Get media by ID
│   │   │   ├── media-scores/ # Get followed users' scores
│   │   │   ├── replies/      # Get activity replies
│   │   │   ├── search/       # Search media
│   │   │   └── user/         # Get user info
│   │   ├── cities/           # City search API
│   │   │   └── search/       # Search cities (WeatherAPI/Nominatim)
│   │   └── weather/          # Weather API
│   │       └── route.ts      # Get weather data (WeatherAPI/wttr.in)
│   ├── calculator/           # Calculator tool
│   ├── components/          # Shared components
│   │   ├── CitySearch.tsx   # City search component
│   │   └── CitySearchModal.tsx
│   ├── countdown/            # Countdown timer
│   ├── date-calculator/      # Date calculator
│   ├── encoder/              # Encoder/decoder
│   ├── file-diff/            # File diff tool
│   ├── formatter/            # Code formatter
│   ├── meteo/                # Weather forecast
│   ├── page.tsx              # Homepage
│   └── layout.tsx
├── lib/
│   └── anilist.ts            # AniList API utilities
├── docker-compose.yml
├── Dockerfile
├── env.example
└── README.md
```

## API Endpoints

### AniList API Routes

The application uses Next.js API routes to proxy AniList GraphQL requests:

- `/api/anilist/user` - Get user information by username
- `/api/anilist/activities` - Get user activities with filters
- `/api/anilist/replies` - Get activity replies/comments
- `/api/anilist/activity-like` - Toggle like on activities/comments
- `/api/anilist/search` - Search for anime/manga
- `/api/anilist/media` - Get media details by ID
- `/api/anilist/media-scores` - Get followed users' scores for a media
- `/api/anilist/following` - Get list of followed users
- `/api/anilist/auth` - Initiate OAuth login
- `/api/anilist/auth/callback` - Handle OAuth callback

### Weather API Routes

- `/api/weather` - Get weather data for a city (WeatherAPI.com or wttr.in fallback)
- `/api/cities/search` - Search for cities (WeatherAPI.com Search API or Nominatim fallback)

## Environment Variables

The application uses the following environment variables:

### Development (Docker)
- `NODE_ENV=development`
- `DATABASE_URL=postgresql://dev:dev@infra_postgres:5432/dev` (optional)
- `CHOKIDAR_USEPOLLING=true` - Enable file polling for hot reload
- `CHOKIDAR_INTERVAL=1000` - Polling interval in milliseconds
- `WATCHPACK_POLLING=true` - Enable Webpack polling
- `WATCHPACK_AGGREGATE_TIMEOUT=300` - Webpack aggregation timeout
- `NEXT_TELEMETRY_DISABLED=1` - Disable Next.js telemetry

### AniList OAuth (Optional)
- `ANILIST_CLIENT_ID` - Your AniList OAuth Client ID
- `ANILIST_CLIENT_SECRET` - Your AniList OAuth Client Secret
- `ANILIST_REDIRECT_URI` - OAuth redirect URI (default: `http://localhost:3000/api/anilist/auth/callback`)

### WeatherAPI.com (Optional)
- `WEATHER_API_KEY` - Your WeatherAPI.com API key

## WeatherAPI.com Setup

The application uses **WeatherAPI.com** (https://www.weatherapi.com/) for weather data and city search.

### Why WeatherAPI.com?

- ✅ **City search**: Uses WeatherAPI.com Search/Autocomplete API for precise location matching with ID support
- ✅ **Detailed forecasts**: 5-day forecasts with complete data
- ✅ **French support**: All descriptions in French
- ✅ **Automatic fallback**: If no API key, uses Nominatim (OpenStreetMap) for search and wttr.in for weather data

### Getting a Free API Key

1. Go to https://www.weatherapi.com/
2. Click **"Sign Up"** (free) or log in at https://www.weatherapi.com/my/
3. Create a free account
4. Go to your dashboard to see your API key
5. Copy your API key

### Configuration

1. Create or edit your `.env` file:
   ```bash
   cp env.example .env
   ```

2. Add your API key in `.env`:
   ```env
   WEATHER_API_KEY=your_weatherapi_key_here
   ```

3. Restart Docker containers:
   ```bash
   docker-compose restart
   ```

### Free Plan Limits

- ✅ **1,000,000 calls/month**
- ✅ Sufficient for personal use

### Without API Key

If you don't add an API key, the application will automatically use **wttr.in** for weather data and **Nominatim** for city search. Everything will work, but with fewer search features.

## Troubleshooting

### Port 3000 is already in use

Modify the port in `docker-compose.yml`:
```yaml
ports:
  - "3001:3000"  # Change 3001 to your preferred port
```

### Hot reload not working

Make sure the environment variables `CHOKIDAR_*` and `WATCHPACK_*` are properly defined in `docker-compose.yml`.

### Docker network error

If you get an error about `infra_net`, create the network:
```bash
docker network create infra_net
```

### Permission issues (Linux/Mac)

If you have permission issues with volumes, adjust permissions:
```bash
sudo chown -R $USER:$USER .
```

### Option: Without PostgreSQL database

If you don't need the database, modify `docker-compose.yml`:
1. Remove the reference to the external network `infra_net`
2. Remove the `DATABASE_URL` variable or set it to a default value
3. Remove the `networks` section

## Building for Production

For production deployment with Docker:

1. **Modify the Dockerfile** to build the application:
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

2. **Modify `docker-compose.yml`** to use `npm start` instead of `npm run dev:webpack`:
```yaml
command: npm start
```

3. **Configure production environment variables** in `.env`

## License

[Add your license here]

## Contributing

[Add contribution guidelines here]
