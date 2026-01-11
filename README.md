# Toolbox App

A Next.js application providing various tools and utilities, with a comprehensive AniList integration.

## Features

### AniList Tools

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

## Tech Stack

- **Framework**: Next.js 16.1.1 (App Router)
- **Language**: TypeScript
- **Styling**: CSS Modules with CSS Variables for theming
- **API**: AniList GraphQL API
- **Authentication**: OAuth2
- **Storage**: localStorage for preferences and cache
- **Containerization**: Docker & Docker Compose

## Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- An external Docker network named `infra_net` (for database connection)
- AniList OAuth credentials (for login feature):
  - Go to [AniList Developer Settings](https://anilist.co/settings/developer)
  - Create a new application
  - Set the redirect URI to: `http://localhost:3000/api/anilist/auth/callback` (or your production URL)
  - Copy your `Client ID` and `Client Secret`

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd toolbox-app
```

2. Install dependencies:
```bash
npm install
```

3. Configure AniList OAuth (optional, required for login feature):
   - Create a `.env` file in the project root:
     ```bash
     cp env.example .env
     # Edit .env and add your credentials:
     # ANILIST_CLIENT_ID=your_client_id_here
     # ANILIST_CLIENT_SECRET=your_client_secret_here
     # ANILIST_REDIRECT_URI=http://localhost:3000/api/anilist/auth/callback
     ```

### Development

#### Using Docker (Recommended)

1. **Start the development container:**
```bash
docker-compose up -d
```

2. **View logs:**
```bash
docker logs toolbox_web -f
```

3. **Access the application:**
- Homepage: http://localhost:3000
- AniList Home: http://localhost:3000/anilist/home
- AniList Search: http://localhost:3000/anilist/search

4. **Stop the container:**
```bash
docker-compose down
```

#### Local Development (without Docker)

1. **Start the development server:**
```bash
npm run dev
# or with Webpack (for better hot reload)
npm run dev:webpack
```

2. **Access the application:**
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

## Hot Reload

The application is configured to use Webpack instead of Turbopack for better hot reload support in Docker environments.

### Configuration

- **Bundler**: Webpack (via `--webpack` flag)
- **File watching**: Polling enabled (`CHOKIDAR_USEPOLLING=true`)
- **Polling interval**: 1000ms
- **Volume mounting**: Uses `:cached` for better performance

### Testing Hot Reload

1. Open http://localhost:3000/anilist/home
2. Modify a file (e.g., `app/anilist/home/page.tsx`)
3. Save the file
4. Wait 1-2 seconds
5. Refresh the page (F5) - changes should appear

### Troubleshooting Hot Reload

#### Check file mounting
```bash
docker exec toolbox_web ls -la /app/app/anilist/
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
│   │   ├── search/             # Search page (media search)
│   │   │   └── page.tsx
│   │   ├── layout.tsx        # Shared layout with header
│   │   ├── page.tsx          # Redirect to /anilist/home
│   │   └── anilist.module.css
│   ├── api/
│   │   └── anilist/          # AniList API routes
│   │       ├── activities/   # Get user activities
│   │       ├── activity-like/ # Like/unlike activities
│   │       ├── auth/         # OAuth authentication
│   │       ├── callback/     # OAuth callback
│   │       ├── following/    # Get followed users
│   │       ├── media/        # Get media by ID
│   │       ├── media-scores/ # Get followed users' scores
│   │       ├── replies/      # Get activity replies
│   │       ├── search/       # Search media
│   │       └── user/         # Get user info
│   ├── page.tsx              # Homepage
│   └── layout.tsx
├── lib/
│   └── anilist.ts            # AniList API utilities
├── docker-compose.yml
├── Dockerfile
├── env.example
└── README.md
```

## AniList Integration

### API Endpoints

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

### Filtering Logic

#### Activity Type Filter
- **Server-side**: Filters by `TEXT`, `MESSAGE`, `ANIME_LIST`, or `MANGA_LIST` in GraphQL query
- **Combined filters**: `list-anime` and `list-manga` combine type and media type for single API call
- **Client-side**: Additional filtering for status (not supported by API)

#### Status Filter
- **Client-side only**: AniList API doesn't support status filtering directly
- **Normalization**: API returns text values (`"watched episode"`, `"read chapter"`, etc.) which are normalized to enum values (`"CURRENT"`, `"PLANNING"`, etc.)
- **No API reload**: Status changes don't trigger API requests (filtered on already-loaded activities)

#### Status Normalization

The application normalizes AniList API status values:

| API Value | Normalized | Display Label |
|-----------|------------|---------------|
| `"watched episode"` | `CURRENT` | "Watching" (anime) / "Reading" (manga) |
| `"read chapter"` | `CURRENT` | "In Progress" (when filter is 'list' or 'all') |
| `"plans to watch"` | `PLANNING` | "Planning" |
| `"plans to read"` | `PLANNING` | "Planning" |
| `"completed"` | `COMPLETED` | "Completed" |
| `"dropped"` | `DROPPED` | "Dropped" |
| `"paused"` | `PAUSED` | "Paused" |
| `"repeating"` | `REPEATING` | "Repeating" |

### Performance Optimizations

- **Request deduplication**: Prevents identical concurrent API calls
- **Debouncing**: Filter changes are debounced (500ms) to reduce API calls
- **Caching**: Followed users' scores are cached in localStorage with TTL (10 minutes)
- **Lazy loading**: Comments are loaded on-demand when expanded
- **Pagination**: Activities and comments support pagination

### Rate Limiting

The AniList API has rate limits (30 requests per minute). The application:
- Handles rate limit errors gracefully (HTTP 429)
- Displays user-friendly error messages
- Implements request deduplication to minimize API calls
- Uses caching to reduce redundant requests

## Features Details

### Activity Types

- **List Activities**: Anime/Manga list updates (with color-coded badges)
  - `ANIME_LIST`: Red badge
  - `MANGA_LIST`: Blue badge
- **Text Activities**: Text posts with HTML formatting support
- **Message Activities**: Direct messages

### Filters

1. **Type Filter**: 
   - All
   - List (All) - All list activities
   - List (Anime) - Anime list activities only
   - List (Manga) - Manga list activities only
   - Text
   - Message

2. **Status Filter** (only available for list activities):
   - All
   - In Progress / Watching / Reading (context-dependent)
   - Planning
   - Completed
   - Dropped
   - Paused
   - Repeating

3. **Sort Options**:
   - Date (newest first)
   - Likes (most liked first)
   - Replies (most commented first)

### User Features

- **User Statistics**: Display anime/manga counts, mean scores, episodes/chapters read
- **Saved Users**: Recently searched users are saved for quick access
- **Per-User Filters**: Filter preferences are saved per user
- **Theme Preferences**: Color theme and background image preferences are saved

### Social Features (Requires Login)

- **View Followed Users' Scores**: See how followed users rated a specific anime/manga
- **View User Activities**: Click on a user's score to see their list activities for that media
- **Like/Unlike**: Like activities and comments
- **Persistent Likes**: Liked status persists across page refreshes

### Customization

- **Color Themes**: Multiple predefined color palettes
- **Custom Background**: Set custom background image URL
- **Dark Mode**: Toggle between light and dark themes
- **Translucency**: Background images with translucent overlays

## Environment Variables

The application uses the following environment variables (configured in `docker-compose.yml`):

### Development
- `NODE_ENV=development`
- `DATABASE_URL=postgresql://dev:dev@infra_postgres:5432/dev`
- `CHOKIDAR_USEPOLLING=true` - Enable file polling for hot reload
- `CHOKIDAR_INTERVAL=1000` - Polling interval in milliseconds
- `WATCHPACK_POLLING=true` - Enable Webpack polling
- `WATCHPACK_AGGREGATE_TIMEOUT=300` - Webpack aggregation timeout
- `NEXT_TELEMETRY_DISABLED=1` - Disable Next.js telemetry

### AniList OAuth (Optional)
- `ANILIST_CLIENT_ID` - Your AniList OAuth Client ID
- `ANILIST_CLIENT_SECRET` - Your AniList OAuth Client Secret
- `ANILIST_REDIRECT_URI` - OAuth redirect URI (default: `http://localhost:3000/api/anilist/auth/callback`)

## Building for Production

```bash
npm run build
npm start
```

## License

[Add your license here]

## Contributing

[Add contribution guidelines here]
