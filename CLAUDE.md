# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WingMap is a React application for discovering, reviewing, and rating chicken wing spots. It features an interactive Leaflet map with clustering, a photo gallery with social features, and a simplified review system — all backed by Supabase.

Architecture mirrors the talias-coffee codebase pattern (React + Vite + Tailwind + Supabase).

## Development Commands

```bash
# Development server
npm run dev

# Build for production (TypeScript check + Vite build)
npm run build

# Preview production build locally
npm run preview

# Deploy to GitHub Pages
npm run deploy
```

## Environment Setup

Required environment variables (create `.env` file):

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key
```

## Architecture

### Tech Stack

- **React 18** with TypeScript and Vite
- **React Router** for client-side routing
- **Tailwind CSS** with custom amber/warmgray/charcoal palette
- **Leaflet.js** + Supercluster for maps with clustering
- **Supabase** (PostgreSQL + Auth + Storage + Realtime)
- **react-hot-toast** for notifications

### Key Directory Structure

```
src/
├── components/
│   ├── Layout.tsx              # Header, view toggle, profile menu, FAB
│   ├── ListView.tsx            # Sortable/filterable spot list
│   ├── MapView.tsx             # Leaflet map with clustering
│   ├── ReviewCard.tsx          # Individual review display
│   ├── ReviewFormModal.tsx     # Two-step review creation
│   ├── ReviewEditModal.tsx     # Review editing
│   ├── ProfileModal.tsx        # User profile editing
│   ├── Notification*.tsx       # Notification bell, center, settings
│   ├── gallery/                # Photo gallery, modal, comments, reactions
│   └── ui/                     # StarRating, Modal, PhotoUpload, BusinessAutocomplete
├── hooks/
│   ├── useAuth.ts              # Auth state + approval workflow
│   ├── useReviews.ts           # Review CRUD + photo management
│   ├── useGallery.ts           # Paginated gallery feed (groups photos by review)
│   ├── useReviewComments.ts    # Review-level comments, likes, reactions
│   ├── useReviewReactions.ts   # Emoji reactions on the review itself
│   ├── usePhotoDetail.ts       # Open a single photo in PhotoModal from list/map
│   ├── useNotifications.ts     # Push + in-app notifications
│   └── useAdminUsers.ts        # Admin user management
├── pages/
│   ├── Home.tsx                # Main app (List/Map/Gallery views)
│   ├── Login.tsx               # Google OAuth + email sign-in
│   ├── Register.tsx            # Access request form
│   ├── AdminDashboard.tsx      # User approval + site settings
│   └── PendingApproval.tsx     # Pending user screen
├── lib/
│   ├── supabase.ts             # Supabase client
│   ├── types.ts                # TypeScript interfaces
│   ├── pushManager.ts          # Web Push management
│   └── reactionDetails.ts      # Reaction/like detail fetchers
├── App.tsx                     # Route definitions
├── main.tsx                    # Entry point
└── index.css                   # Tailwind + custom styles
```

### Database Schema (Supabase)

- **wing_spots** - Wing spot locations (name, address, lat, lng)
- **reviews** - Simplified wing reviews (overall_rating 1-10, wing_size, wing_flavor, is_takeout, takeout_container, review_text, legacy_data)
- **profiles** - User profiles with approval status (pending/approved/rejected/disabled)
- **review_photos** - Photos attached to reviews (Supabase Storage)
- **review_likes** - Like records on a review (review-level, not per-photo)
- **review_comments** - Threaded comments with GIF support, attached to a review
- **review_comment_likes** - Likes on review comments
- **review_comment_reactions** - Emoji reactions on review comments (👍 ❤️ 😂 🔥)
- **review_reactions** - Emoji reactions directly on a review
- **notifications** - In-app + push notification records
- **notification_preferences** - Per-user notification settings
- **site_settings** - Public/private site toggle

Engagement (likes, comments, reactions) lives at the review level. Each card in the gallery shows a single review with its photos as a carousel, not one card per photo.

### Key Views

- **reviews_with_profiles** - Reviews joined with reviewer info + spot info
- **gallery_feed** - One row per photo joined with review/spot/reviewer + review-level like and comment counts
- **review_comments_detailed** - Review comments with like/reply counts

### Review Model (Simplified)

- `overall_rating` (1-10 integer)
- `wing_size` ('small' | 'medium' | 'large' | 'jumbo')
- `wing_flavor` (free text with autocomplete, 40+ built-in options)
- `is_takeout` (boolean)
- `takeout_container` (conditional: 'styrofoam' | 'cardboard' | 'plastic' | 'aluminum' | 'bag_only' | 'other')
- `review_text` (longer-form text)
- `legacy_data` (JSONB preserving old 12-dimension rating data from migration)

### Auth Flow

1. Google OAuth or email/password sign-in
2. Profile auto-created on signup (status: 'pending')
3. Admin approves/rejects via AdminDashboard
4. Approved users can browse and leave reviews

### Color Palette

- **amber-*** - Primary accent (warm orange)
- **warmgray-*** - Neutral backgrounds
- **charcoal-*** - Text and dark tones
