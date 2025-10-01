# Resomix Admin Dashboard

Admin dashboard for managing Resomix platform data and monitoring.

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Navbar.tsx      # Top navigation bar with mobile menu toggle
│   └── Sidebar.tsx     # Side navigation with responsive behavior
├── layouts/            # Layout components
│   └── DashboardLayout.tsx  # Main dashboard layout wrapper
├── pages/              # Page components (route destinations)
│   ├── FeedbackPage.tsx     # User feedback management
│   ├── ContactPage.tsx      # Contact messages
│   ├── WaitlistPage.tsx     # Waitlist email management
│   ├── PipelinePage.tsx     # Pipeline status monitoring
│   ├── AnalyticsPage.tsx    # Analytics dashboard
│   └── PlaylistsPage.tsx    # Generated playlists view
├── App.tsx             # Main app with routing setup
├── main.tsx            # App entry point
└── index.css           # Global styles with Tailwind
```

## Features

- ✅ **Responsive Design**: Sidebar collapses to hamburger menu on mobile/tablet
- ✅ **React Router v6**: Client-side routing with nested routes
- ✅ **Tailwind CSS 4**: Modern utility-first styling
- ✅ **TypeScript**: Full type safety
- ✅ **Clean Architecture**: Organized by feature and component type

## Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | Redirect | Redirects to `/feedback` |
| `/feedback` | FeedbackPage | Display user feedback |
| `/contact` | ContactPage | Display contact messages |
| `/waitlist` | WaitlistPage | Display waitlist emails |
| `/pipeline` | PipelinePage | Display pipeline status |
| `/analytics` | AnalyticsPage | Display analytics |
| `/playlists` | PlaylistsPage | Display generated playlists |

## Development

```bash
# From monorepo root
pnpm dev:admin

# Or from this directory
pnpm dev
```

The app will run on `http://localhost:5175` (or next available port).

## Next Steps

1. **Backend Integration**: Connect to API endpoints for data fetching
2. **Authentication**: Add login/auth flow
3. **Data Tables**: Implement data tables with sorting, filtering, pagination
4. **Charts & Analytics**: Add visualization libraries for analytics
5. **Real-time Updates**: Add WebSocket or polling for live data
6. **Export Features**: Add CSV/PDF export functionality

## Tech Stack

- **React 19** - UI library
- **TypeScript** - Type safety
- **Vite 7** - Build tool
- **React Router v6** - Routing
- **Tailwind CSS 4** - Styling
- **Shared packages**: `@resomix/ui`, `@resomix/hooks`, `@resomix/api-client`

## Init Date

- October 01, 2025
