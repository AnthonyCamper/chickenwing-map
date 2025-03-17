# ChickenWing Map - Application Context

## Overview
ChickenWing Map is a web application that allows users to discover, review, and rate chicken wing establishments. The application features an interactive map interface for geographic browsing, detailed review capabilities, and a community-driven rating system.

## Tech Stack
- **Frontend**: SvelteKit framework with TypeScript
- **UI Components**: Tailwind CSS for styling
- **Map Integration**: Leaflet.js for interactive maps
- **Backend**: Supabase for authentication, database, and storage
- **Deployment**: Likely deployed on a cloud platform (specific details unknown)

## Core Features

### Map Interface
- Interactive map powered by Leaflet.js
- Displays pins for wing establishments
- Custom markers with rating indicators
- User location tracking capability
- Zoom and pan controls

### Review System
- Detailed wing review capabilities with ratings across multiple criteria:
  - Overall rating (out of 10)
  - Wing size
  - Sauce quality
  - Value
  - Heat level accuracy
  - Crispy vs Soggy
  - Blue cheese/ranch quality
  - Service
  - Atmosphere
  - Overall experience
- Support for multiple sauce types and wing formats
- Upvote/downvote mechanism for community curation

### User Authentication
- Sign-in functionality via Supabase auth
- User profiles with review history
- Authentication required for reviewing and voting

## Key Components

### ReviewSlideout Component
- Displays detailed review information
- Slides in from the right side of the screen
- Contains upvote/downvote functionality
- Shows review metrics and user comments
- Uses z-index 1000 to ensure it appears above the map (z-index 40)

### Map Components
- Central map display with restaurant pins
- Location tracking
- Custom marker implementation
- Click handlers for opening reviews

### Review Input
- Structured form for submitting wing reviews
- Multi-step review process
- Rating sliders for different aspects of the wing experience
- Support for adding sauce details and wing formats

### Modals
- SignInModal for user authentication
- AddReviewModal for submitting new reviews
- Uses z-index higher than other components for proper stacking

## Data Structure

### Review Object
- Contains rating metrics (0-10 scale)
- Includes location reference
- Stores user ID of reviewer
- Contains timestamp data
- Maintains vote counts and vote history

### Location Object
- Restaurant name
- Address information
- Geographic coordinates
- Reference to associated reviews

## User Flow
1. Users view the map to locate wing establishments
2. Users can click on markers to view establishment details
3. Users can read reviews in a slideout panel
4. Authenticated users can submit their own reviews
5. Users can upvote/downvote reviews for quality and accuracy
6. Users can filter and sort establishments by rating and other criteria

## UI/UX Considerations
- Mobile-responsive design with different layouts for small and large screens
- Dark mode support across the application
- Accessibility features implemented in interactive elements
- Touch gestures support for mobile users (swipe to close slideouts)
- Keyboard navigation support for modal dialogs and forms

## Known Issues
- Z-index conflicts between map elements and slide-out panels (resolved)
- Accessibility issues in some components (being addressed)
- Some unused export properties in components
- Various linting warnings related to form controls and ARIA labels

## Optimization Notes
- High z-index values (1000+) used for modals and slide-outs
- Map elements use z-index 40-45
- Touch event handling optimized for mobile UX

This context document provides an overview of the application structure and functionality for reference in future development and maintenance tasks. 