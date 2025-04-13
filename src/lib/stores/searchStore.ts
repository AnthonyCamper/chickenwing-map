import { writable, derived, get } from 'svelte/store';
import { geocode } from '$lib/geocoding';
import type { Review } from '$lib/components/review/types';

// Core search state
export const searchQuery = writable('');
export const searchMode = writable<'location' | 'content'>('location'); 
export const isSearching = writable(false);
export const isResultSelected = writable(false);
export const searchResults = writable<{
  locationMatches: { latitude: number; longitude: number; name: string }[];
  reviewMatches: Review[];
}>({ locationMatches: [], reviewMatches: [] });

// UI-related search state
export const showNoResults = writable(false);
export const showAutocomplete = writable(false);
export const autocompleteResults = writable<string[]>([]);
export const showResults = writable(false);

// Store for the last selected result
export const selectedResult = writable<Review | null>(null);

// Flag to control if search results dropdown should be shown
export const shouldShowResultsDropdown = derived(
  [searchResults, showNoResults, showAutocomplete, isSearching, searchQuery, selectedResult, isResultSelected],
  ([$results, $showNoResults, $showAutocomplete, $isSearching, $query, $selectedResult, $isResultSelected]) => {
    // Only show results dropdown if:
    // 1. We have results
    // 2. Not showing autocomplete
    // 3. Not showing no results message
    // 4. Not currently searching
    // 5. There is an actual query with at least 2 characters
    // 6. No result is currently selected
    return $results.reviewMatches.length > 0 && 
           !$showAutocomplete && 
           !$showNoResults && 
           !$isSearching && 
           $query.trim().length > 1 &&
           !$isResultSelected;
  }
);

// Derived store to control "No results" message visibility
export const shouldShowNoResults = derived(
  [showNoResults, selectedResult, isResultSelected],
  ([$showNoResults, $selectedResult, $isResultSelected]) => {
    // Don't show "No results" message if a result is selected
    return $showNoResults && !$selectedResult && !$isResultSelected;
  }
);

// Derived store to indicate if there are any results
export const hasResults = derived(
  searchResults,
  $results => $results.locationMatches.length > 0 || $results.reviewMatches.length > 0
);

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
  
  // Hide any previous "no results" message while searching
  showNoResults.set(false);
  isSearching.set(true);
  showResults.set(true);
  
  try {
    // First, filter reviews regardless of mode
    const filteredReviews = filterReviews(reviews, query);
    
    // For location search mode, also perform geocoding
    if (mode === 'location') {
      const location = await geocode(query);
      
      if (location) {
        searchResults.set({ 
          locationMatches: [{ ...location, name: query }],
          reviewMatches: filteredReviews
        });
        showNoResults.set(false); // We have a location match
      } else if (filteredReviews.length > 0) {
        // If geocoding fails but we have review matches, still show those
        searchResults.set({ 
          locationMatches: [],
          reviewMatches: filteredReviews  
        });
        showNoResults.set(false); // We have review matches
      } else {
        // No matches at all
        searchResults.set({ locationMatches: [], reviewMatches: [] });
        // Only show no results if not a selected result
        showNoResults.set(!isSelected); 
      }
    } else {
      // For content search, just update review matches
      searchResults.set({
        locationMatches: [],
        reviewMatches: filteredReviews
      });
      // Only show no results if not a selected result
      showNoResults.set(filteredReviews.length === 0 && !isSelected);
    }
  } catch (error) {
    console.error("Search error:", error);
    searchResults.set({ locationMatches: [], reviewMatches: [] });
    // Only show no results on error if not a selected result
    showNoResults.set(!isSelected);
  } finally {
    isSearching.set(false);
    showAutocomplete.set(false);
  }
}

/**
 * Handle selection of a search result
 */
export function selectSearchResult(review: Review) {
  // Mark that a result is selected to prevent "No results" message
  isResultSelected.set(true);
  
  // When a result is selected, hide all dropdowns and messages
  showResults.set(false);
  showNoResults.set(false);
  showAutocomplete.set(false);
  
  // This prevents "No results found" from showing
  searchResults.set({
    locationMatches: [{ 
      latitude: review.location.latitude, 
      longitude: review.location.longitude, 
      name: review.location.restaurant_name 
    }],
    reviewMatches: [review]  // Keep the selected review
  });
  
  // Log the coordinates for debugging
  console.log("selectSearchResult - Location coordinates:", review.location.latitude, review.location.longitude);
  console.log("selectSearchResult - Location name:", review.location.restaurant_name);
  
  // Set the search query to the restaurant name for clarity
  searchQuery.set(review.location.restaurant_name);
  
  // Store the last selected result for reference
  selectedResult.set(review);
  
  // Explicitly ensure no-results message won't appear
  setTimeout(() => showNoResults.set(false), 0);
  
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
 * Generate autocomplete suggestions based on reviews and query
 */
export function updateAutocomplete(reviews: Review[], query: string) {
  // Reset isResultSelected when user is typing to get autocomplete
  isResultSelected.set(false);
  
  if (query.length < 2) {
    // Clear previous search results when typing short queries
    searchResults.set({ locationMatches: [], reviewMatches: [] });
    showResults.set(false);
    autocompleteResults.set([]);
    showAutocomplete.set(false);
    return;
  }
  
  const searchLower = query.toLowerCase();
  
  // Get unique restaurant names that match the query
  const restaurantNames = [...new Set(reviews
    .map(review => review.location.restaurant_name)
    .filter(name => name.toLowerCase().includes(searchLower))
  )];
  
  // Get unique addresses that match the query
  const addresses = [...new Set(reviews
    .map(review => review.location.address)
    .filter(address => address && address.toLowerCase().includes(searchLower))
  )];
  
  // Combine and limit results
  const results = [...restaurantNames, ...addresses].slice(0, 5);
  autocompleteResults.set(results);
  showAutocomplete.set(results.length > 0);
}

/**
 * Clear current search state
 */
export function resetSearch() {
  searchResults.set({ locationMatches: [], reviewMatches: [] });
  showNoResults.set(false);
  showAutocomplete.set(false);
  showResults.set(false);
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