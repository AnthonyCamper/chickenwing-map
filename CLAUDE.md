# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ChickenWing Map is a SvelteKit application for discovering, reviewing, and rating chicken wing establishments. It features an interactive Leaflet map, detailed review system, and community voting functionality, backed by Supabase.

## Development Commands

```bash
# Development server
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Deploy to GitHub Pages
npm run deploy

# Type checking and validation
npm run check
npm run check:watch  # Watch mode

# Code quality
npm run lint         # Check formatting and lint rules
npm run format       # Auto-format code with Prettier
```

## Environment Setup

Required environment variables (create `.env` file):

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Architecture

### Tech Stack

- **SvelteKit** with TypeScript and Vite
- **Tailwind CSS** for styling with custom design system
- **Leaflet.js** for interactive maps
- **Supabase** (PostgreSQL + Auth + Real-time)
- **GitHub Pages** deployment

### Key Directory Structure

```
src/
├── lib/
│   ├── components/          # UI components
│   │   └── review/         # Review-specific components
│   ├── stores/             # Svelte stores (searchStore, theme)
│   ├── supabase.ts         # Database client
│   └── geocoding.ts        # Location services
├── routes/                 # SvelteKit pages
└── app.html               # HTML template
```

### Database Schema

- **reviews** - Core review data with ratings and experience details
- **locations** - Restaurant information with coordinates
- **votes** - Community upvote/downvote system

### Core Components

- **Map.svelte** - Interactive map with custom markers
- **SearchBar.svelte** - Dual-mode search (location/content)
- **ReviewSlideout.svelte** - Detailed review display
- **AddReviewModal.svelte** - Complex review submission form

## State Management

Uses Svelte stores for reactive state:

- **searchStore** - Search functionality and geocoding
- **theme** - Dark/light mode with persistence
- Component props and events for local state

## Development Notes

### Component Patterns

- TypeScript interfaces defined in `src/lib/components/review/types.ts`
- Consistent prop/event patterns across components
- Accessibility features with ARIA labels

### Search System

- OpenStreetMap geocoding via `src/lib/geocoding.ts`
- Dual search modes: location-based and content-based
- Client-side filtering with reactive updates

### Authentication

- Supabase Auth with persistent sessions
- Row Level Security (RLS) on database tables
- User profile management in UserDisplay component

### Styling Approach

- Tailwind utility classes with custom color palette
- Dark mode support with CSS custom properties
- Responsive design with mobile-first approach

### Build and Deployment

- Static site generation with @sveltejs/adapter-static
- GitHub Actions workflow for automated deployment
- Environment variables managed via GitHub Secrets
