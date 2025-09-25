import { writable, derived, get } from 'svelte/store';
import { geocode } from '$lib/geocoding';
import type { Review } from '$lib/components/review/types';
import type { GeocodeError } from '$lib/geocoding';

// Debounce timer
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// Core search state
export const searchQuery = writable('');
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
		return (
			$searchResults.reviewMatches.length > 0 &&
			!$isSearching &&
			$searchQuery.trim().length > 1 &&
			!$isResultSelected &&
			!$searchError
		);
	}
);

export const shouldShowNoResults = derived(
	[searchResults, isSearching, searchQuery, isResultSelected, searchError],
	([$searchResults, $isSearching, $searchQuery, $isResultSelected, $searchError]) => {
		return (
			$searchResults.reviewMatches.length === 0 &&
			$searchResults.locationMatches.length === 0 &&
			!$isSearching &&
			$searchQuery.trim().length > 1 &&
			!$isResultSelected &&
			!$searchError
		);
	}
);

// Derived store to indicate if there are any results
export const hasResults = derived(
	searchResults,
	($results) => $results.locationMatches.length > 0 || $results.reviewMatches.length > 0
);

/**
 * Perform a debounced search with the current query
 * @param reviews Array of reviews to search through
 * @param immediate Whether to perform search immediately without debouncing
 */
export function performDebouncedSearch(reviews: Review[], immediate = false) {
	if (debounceTimer) {
		clearTimeout(debounceTimer);
	}

	if (immediate) {
		performSearch(reviews);
		return;
	}

	debounceTimer = setTimeout(() => {
		performSearch(reviews);
	}, 300);
}

/**
 * Perform a unified search with the current query
 * @param reviews Array of reviews to search through
 */
export async function performSearch(reviews: Review[]) {
	const query = get(searchQuery);

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
		// Filter reviews using our comprehensive search
		const filteredReviews = filterReviews(reviews, query);

		// Try geocoding as an enhancement, but don't let it fail the search
		let locationMatches: { latitude: number; longitude: number; name: string }[] = [];
		try {
			const geocodeResponse = await geocode(query);
			if (geocodeResponse.result) {
				locationMatches = [
					{
						latitude: geocodeResponse.result.latitude,
						longitude: geocodeResponse.result.longitude,
						name: geocodeResponse.result.displayName || query
					}
				];
			}
		} catch (geocodeError) {
			// Silently ignore geocoding errors - we still have review results
			console.warn('Geocoding failed, continuing with review results only:', geocodeError);
		}

		// Set results
		searchResults.set({
			locationMatches,
			reviewMatches: filteredReviews
		});

		// Add to recent searches if we have any results
		if (filteredReviews.length > 0 || locationMatches.length > 0) {
			addToRecentSearches(query);
		}
	} catch (error) {
		console.error('Search error:', error);
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
		locationMatches: [
			{
				latitude: review.location.latitude,
				longitude: review.location.longitude,
				name: review.location.restaurant_name
			}
		],
		reviewMatches: [review]
	});

	// Set the search query to the restaurant name for clarity
	searchQuery.set(review.location.restaurant_name);

	// Store the selected result
	selectedResult.set(review);

	// Clear any errors
	searchError.set(null);

	console.log('Search result selected:', review.location.restaurant_name);
}

/**
 * Filter and rank reviews based on comprehensive search query with relevance scoring
 */
export function filterReviews(reviews: Review[], query: string): Review[] {
	const searchLower = query.toLowerCase().trim();
	if (!searchLower) return reviews;

	// Create scored results
	const scoredResults: Array<{ review: Review; score: number }> = [];

	for (const review of reviews) {
		const score = calculateRelevanceScore(review, searchLower);
		if (score > 0) {
			scoredResults.push({ review, score });
		}
	}

	// Sort by relevance score (highest first) and return just the reviews
	return scoredResults.sort((a, b) => b.score - a.score).map((result) => result.review);
}

/**
 * Calculate relevance score for a review based on search query
 */
function calculateRelevanceScore(review: Review, searchQuery: string): number {
	let score = 0;
	const query = searchQuery.toLowerCase();

	// Restaurant name matches (highest priority)
	const restaurantName = review.location.restaurant_name.toLowerCase();
	if (restaurantName === query)
		score += 100; // Exact match
	else if (restaurantName.startsWith(query))
		score += 80; // Starts with
	else if (restaurantName.includes(query)) score += 60; // Contains

	// Address matches (high priority)
	if (review.location.address) {
		const address = review.location.address.toLowerCase();
		if (address.includes(query)) score += 40;
	}

	// Review text matches (medium priority)
	const reviewText = review.review.toLowerCase();
	if (reviewText.includes(query)) {
		// Count occurrences for better scoring
		const matches = (reviewText.match(new RegExp(query, 'g')) || []).length;
		score += matches * 20;
	}

	// Rating matches (medium priority)
	if (review.rating && review.rating.toString().includes(query)) {
		score += 30;
	}

	// Search in sauce details if available
	if (review.sauce_details?.selectedSauces) {
		for (const sauce of review.sauce_details.selectedSauces) {
			if (sauce.toLowerCase().includes(query)) {
				score += 25;
			}
		}
	}

	// Search in experience details if available
	if (review.experience_details) {
		const exp = review.experience_details;

		// Wing format search
		if (exp.wingFormat && exp.wingFormat.toLowerCase().includes(query)) {
			score += 20;
		}

		// Takeout container search
		if (exp.takeoutContainer && exp.takeoutContainer.toLowerCase().includes(query)) {
			score += 15;
		}

		// Search numeric fields
		if (exp.wingsPerOrder && exp.wingsPerOrder.toString().includes(query)) {
			score += 15;
		}
		if (exp.wingSize && exp.wingSize.toString().includes(query)) {
			score += 15;
		}
		if (exp.takeoutWaitTime && exp.takeoutWaitTime.toString().includes(query)) {
			score += 10;
		}

		// Search boolean fields
		if (exp.isTakeout !== null) {
			const takeoutText = exp.isTakeout ? 'takeout' : 'dine-in';
			if (takeoutText.includes(query)) score += 15;
		}
		if (exp.beerInfluence !== null) {
			const beerText = exp.beerInfluence ? 'with beer' : 'without beer';
			if (beerText.includes(query)) score += 10;
		}
	}

	// Search in detailed ratings if available
	if (review.ratings) {
		const ratings = review.ratings;
		const ratingFields = [
			{ value: ratings.appearance, name: 'appearance' },
			{ value: ratings.aroma, name: 'aroma' },
			{ value: ratings.sauceQuantity, name: 'sauce quantity' },
			{ value: ratings.sauceConsistency, name: 'sauce consistency' },
			{ value: ratings.sauceHeat, name: 'sauce heat' },
			{ value: ratings.skinConsistency, name: 'skin consistency' },
			{ value: ratings.meatQuality, name: 'meat quality' },
			{ value: ratings.greasiness, name: 'greasiness' },
			{ value: ratings.blueCheeseQuality, name: 'blue cheese quality' },
			{ value: ratings.satisfactionScore, name: 'satisfaction' },
			{ value: ratings.recommendationScore, name: 'recommendation' }
		];

		for (const field of ratingFields) {
			if (field.value && field.value.toString().includes(query)) {
				score += 10;
			}
			if (field.name.includes(query)) {
				score += 15;
			}
		}

		// Search for common rating-related terms
		const ratingTerms = ['excellent', 'good', 'average', 'poor', 'terrible'];
		for (const term of ratingTerms) {
			if (term.includes(query) && ratings.satisfactionScore) {
				score += 10;
			}
		}
	}

	// Partial word matching for better results
	const words = query.split(' ').filter((word) => word.length > 2);
	for (const word of words) {
		if (word !== query) {
			// Don't double-count if it's a single word search
			const partialScore = calculateRelevanceScore(review, word);
			score += partialScore * 0.3; // Reduce score for partial matches
		}
	}

	return score;
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
	const filtered = current.filter((search) => search.toLowerCase() !== trimmedQuery.toLowerCase());
	const updated = [trimmedQuery, ...filtered].slice(0, MAX_RECENT_SEARCHES);

	recentSearches.set(updated);
	saveRecentSearches(updated);
}

/**
 * Remove a search term from recent searches
 */
export function removeFromRecentSearches(query: string) {
	const current = get(recentSearches);
	const updated = current.filter((search) => search.toLowerCase() !== query.toLowerCase());

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
