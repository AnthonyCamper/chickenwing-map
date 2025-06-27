import { writable, derived, get } from 'svelte/store';
import { geocode } from '$lib/geocoding';
import type { Review } from '$lib/components/review/types';
import type { GeocodeError } from '$lib/geocoding';

// Debounce timer
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// Core search state
export const searchQuery = writable('');
export const searchMode = writable<'location' | 'content'>('location'); 
export const isSearching = writable(false);
export const isResultSelected = writable(false);
export const searchResults = writable<{
  locationMatches: { latitude: number; longitude: number; name: string }[];
  reviewMatches: Review[];
}>({ locationMatches: [], reviewMatches: [] });

// Simplified search state
export const searchError = writable<GeocodeError | null>(null);
export const selectedResult = writable<Review | null>(null);

// Recent searches state
export const recentSearches = writable<string[]>([]);

// Constants
const RECENT_SEARCHES_KEY = 'chickenwing-recent-searches';
const MAX_RECENT_SEARCHES = 5;

// Derived stores for UI state
export const shouldShowResults = derived(
  [searchResults, isSearching, searchQuery, isResultSelected, searchError],
  ([$searchResults, $isSearching, $searchQuery, $isResultSelected, $searchError]) => {
    return $searchResults.reviewMatches.length > 0 && 
           !$isSearching && 
           $searchQuery.trim().length > 1 && 
           !$isResultSelected && 
           !$searchError;
  }
);

export const shouldShowNoResults = derived(
  [searchResults, isSearching, searchQuery, isResultSelected, searchError],
  ([$searchResults, $isSearching, $searchQuery, $isResultSelected, $searchError]) => {
    return $searchResults.reviewMatches.length === 0 && 
           $searchResults.locationMatches.length === 0 &&
           !$isSearching && 
           $searchQuery.trim().length > 1 && 
           !$isResultSelected && 
           !$searchError;
  }
);

// Derived store to indicate if there are any results
export const hasResults = derived(
  searchResults,
  $results => $results.locationMatches.length > 0 || $results.reviewMatches.length > 0
);

/**
 * Perform a debounced search with the current query
 * @param reviews Array of reviews to search through
 * @param activeMode Optional override for the current search mode
 * @param immediate Whether to perform search immediately without debouncing
 */
export function performDebouncedSearch(reviews: Review[], activeMode?: 'location' | 'content', immediate = false) {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  if (immediate) {
    performSearch(reviews, activeMode);
    return;
  }

  debounceTimer = setTimeout(() => {
    performSearch(reviews, activeMode);
  }, 300);
}

/**
 * Perform a search with the current query
 * @param reviews Array of reviews to search through
 * @param activeMode Optional override for the current search mode
 */
export async function performSearch(reviews: Review[], activeMode?: 'location' | 'content') {
  const query = get(searchQuery);
  const mode = activeMode || get(searchMode);
  
  // Only check if no results should be shown, not whether to exit entirely
  const isSelected = get(isResultSelected);
  
  if (!query.trim()) {
    resetSearch();
    return;
  }
  
  // Reset selected result when performing a new search
  selectedResult.set(null);
  
  // Clear any previous errors while searching
  searchError.set(null);
  isSearching.set(true);
  
  try {
    // First, filter reviews regardless of mode
    const filteredReviews = filterReviews(reviews, query);
    
    // For location search mode, also perform geocoding
    if (mode === 'location') {
      const geocodeResponse = await geocode(query);
      
      if (geocodeResponse.result) {
        searchResults.set({ 
          locationMatches: [{ 
            latitude: geocodeResponse.result.latitude,
            longitude: geocodeResponse.result.longitude,
            name: geocodeResponse.result.displayName || query 
          }],
          reviewMatches: filteredReviews
        });
        // Add successful search to recent searches
        addToRecentSearches(query);
      } else {
        // If geocoding fails, still show review matches if we have them
        searchResults.set({ 
          locationMatches: [],
          reviewMatches: filteredReviews  
        });
        // Add to recent searches if we have review matches
        if (filteredReviews.length > 0) {
          addToRecentSearches(query);
        }
        // Set error if geocoding failed
        if (geocodeResponse.error) {
          searchError.set(geocodeResponse.error);
        }
      }
    } else {
      // For content search, just update review matches
      searchResults.set({
        locationMatches: [],
        reviewMatches: filteredReviews
      });
      // Add to recent searches if we have review matches
      if (filteredReviews.length > 0) {
        addToRecentSearches(query);
      }
    }
  } catch (error) {
    console.error("Search error:", error);
    searchResults.set({ locationMatches: [], reviewMatches: [] });
    searchError.set({ 
      type: 'network', 
      message: 'An unexpected error occurred while searching. Please try again.' 
    });
  } finally {
    isSearching.set(false);
  }
}

/**
 * Handle selection of a search result
 */
export function selectSearchResult(review: Review) {
  // Mark that a result is selected
  isResultSelected.set(true);
  
  // Update search results to show the selected result
  searchResults.set({
    locationMatches: [{ 
      latitude: review.location.latitude, 
      longitude: review.location.longitude, 
      name: review.location.restaurant_name 
    }],
    reviewMatches: [review]
  });
  
  // Set the search query to the restaurant name for clarity
  searchQuery.set(review.location.restaurant_name);
  
  // Store the selected result
  selectedResult.set(review);
  
  // Clear any errors
  searchError.set(null);
  
  console.log("Search result selected:", review.location.restaurant_name);
}

/**
 * Filter reviews based on search query
 */
export function filterReviews(reviews: Review[], query: string): Review[] {
  const searchLower = query.toLowerCase().trim();
  if (!searchLower) return reviews;
  
  return reviews.filter(review => 
    review.location.restaurant_name.toLowerCase().includes(searchLower) ||
    (review.location.address && review.location.address.toLowerCase().includes(searchLower)) ||
    review.review.toLowerCase().includes(searchLower) ||
    (review.rating != null && review.rating.toString().includes(searchLower))
  );
}

/**
 * Clear current search state
 */
export function resetSearch() {
  searchResults.set({ locationMatches: [], reviewMatches: [] });
  searchError.set(null);
  isResultSelected.set(false);
}

/**
 * Clear the search input and results
 */
export function clearSearch() {
  searchQuery.set('');
  isResultSelected.set(false);
  resetSearch();
}

/**
 * Load recent searches from localStorage
 */
export function loadRecentSearches() {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        const searches = JSON.parse(stored);
        recentSearches.set(Array.isArray(searches) ? searches.slice(0, MAX_RECENT_SEARCHES) : []);
      }
    } catch (error) {
      console.error('Error loading recent searches:', error);
      recentSearches.set([]);
    }
  }
}

/**
 * Save recent searches to localStorage
 */
function saveRecentSearches(searches: string[]) {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
    } catch (error) {
      console.error('Error saving recent searches:', error);
    }
  }
}

/**
 * Add a search term to recent searches
 */
export function addToRecentSearches(query: string) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery || trimmedQuery.length < 2) return;
  
  const current = get(recentSearches);
  const filtered = current.filter(search => search.toLowerCase() !== trimmedQuery.toLowerCase());
  const updated = [trimmedQuery, ...filtered].slice(0, MAX_RECENT_SEARCHES);
  
  recentSearches.set(updated);
  saveRecentSearches(updated);
}

/**
 * Remove a search term from recent searches
 */
export function removeFromRecentSearches(query: string) {
  const current = get(recentSearches);
  const updated = current.filter(search => search.toLowerCase() !== query.toLowerCase());
  
  recentSearches.set(updated);
  saveRecentSearches(updated);
}

/**
 * Clear all recent searches
 */
export function clearRecentSearches() {
  recentSearches.set([]);
  if (typeof window !== 'undefined') {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  }
} 