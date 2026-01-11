# Toolbox App

A Next.js application providing various tools and utilities, including an AniList activity viewer.

## Features

### AniList Activity Viewer
- View user activities from AniList with comments
- Filter activities by type (List, Text, Message)
- Filter by media type (Anime/Manga)
- Filter by status (In Progress, Planning, Completed, Dropped, Paused, Repeating)
- Color-coded badges for Anime (red) and Manga (blue) activities
- Dark mode support
- Persistent user preferences (username, theme)
- Lazy loading of comments

## Tech Stack

- **Framework**: Next.js 16.1.1
- **Language**: TypeScript
- **Styling**: CSS Modules
- **API**: AniList GraphQL API
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
   - Go to [AniList Developer Settings](https://anilist.co/settings/developer)
   - Create a new application
   - Set the redirect URI to: `http://localhost:3000/api/anilist/auth/callback`
   - Copy your `Client ID` and `Client Secret`
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
- AniList page: http://localhost:3000/anilist

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

1. Open http://localhost:3000/anilist
2. Modify a file (e.g., `app/anilist/page.tsx`)
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
│   ├── anilist/          # AniList activity viewer
│   │   ├── page.tsx      # Main AniList page component
│   │   └── anilist.module.css
│   ├── api/
│   │   └── anilist/      # AniList API routes
│   │       ├── activities/
│   │       ├── replies/
│   │       └── user/
│   ├── page.tsx          # Homepage
│   └── layout.tsx
├── lib/
│   └── anilist.ts        # AniList API utilities
├── docker-compose.yml
├── Dockerfile
└── README.md
```

## AniList Integration

### API Endpoints

The application uses Next.js API routes to proxy AniList GraphQL requests:

- `/api/anilist/user` - Get user information by username
- `/api/anilist/activities` - Get user activities
- `/api/anilist/replies` - Get activity replies/comments

### Filtering Logic

#### Media Type Filter
- **Server-side**: Filters by `ANIME_LIST` or `MANGA_LIST` in GraphQL query
- **Client-side**: Additional filtering by `activity.media.type`

#### Status Filter
- **Client-side only**: AniList API doesn't support status filtering directly
- **Normalization**: API returns text values (`"watched episode"`, `"read chapter"`, etc.) which are normalized to enum values (`"CURRENT"`, `"PLANNING"`, etc.)

#### Status Normalization

The application normalizes AniList API status values:

| API Value | Normalized | Display Label |
|-----------|------------|---------------|
| `"watched episode"` | `CURRENT` | "Watching" (anime) / "Reading" (manga) |
| `"read chapter"` | `CURRENT` | "In Progress" (when mediaType is 'all') |
| `"plans to watch"` | `PLANNING` | "Planning" |
| `"plans to read"` | `PLANNING` | "Planning" |
| `"completed"` | `COMPLETED` | "Completed" |
| `"dropped"` | `DROPPED` | "Dropped" |
| `"paused"` | `PAUSED` | "Paused" |
| `"repeating"` | `REPEATING` | "Repeating" |

### Rate Limiting

The AniList API has rate limits. The application handles rate limit errors gracefully and displays user-friendly messages.

## Features Details

### Activity Types

- **List Activities**: Anime/Manga list updates (with color-coded badges)
- **Text Activities**: Text posts
- **Message Activities**: Direct messages

### Filters

1. **Type Filter**: Filter by activity type (All, List, Text, Message)
2. **Media Filter**: Filter by media type (All, Anime, Manga) - only available when Type is "List"
3. **Status Filter**: Filter by progression status - only available when Type is "List"
   - When Media is "All": Shows unified labels (e.g., "In Progress")
   - When Media is "Anime" or "Manga": Shows specific labels (e.g., "Watching" or "Reading")

### Dark Mode

- Toggle button in the header
- Preference saved in localStorage
- Smooth theme transitions

## Environment Variables

The application uses the following environment variables (configured in `docker-compose.yml`):

- `NODE_ENV=development`
- `DATABASE_URL=postgresql://dev:dev@infra_postgres:5432/dev`
- `CHOKIDAR_USEPOLLING=true` - Enable file polling for hot reload
- `CHOKIDAR_INTERVAL=1000` - Polling interval in milliseconds
- `WATCHPACK_POLLING=true` - Enable Webpack polling
- `WATCHPACK_AGGREGATE_TIMEOUT=300` - Webpack aggregation timeout
- `NEXT_TELEMETRY_DISABLED=1` - Disable Next.js telemetry

## Building for Production

```bash
npm run build
npm start
```

## License

[Add your license here]

## Contributing

[Add contribution guidelines here]
