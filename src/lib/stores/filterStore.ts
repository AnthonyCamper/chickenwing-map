import { writable, derived, get } from 'svelte/store';
import type { Review } from '$lib/components/review/types';

// Filter state interface
export interface FilterState {
	minRating: number;
	maxRating: number;
	maxDistance: number | null;
	priceRange: [number, number];
	hasRecentVisits: boolean;
	minVotes: number;
	selectedSauces: string[];
	dateRange: {
		start: Date | null;
		end: Date | null;
	};
}

// Default filter state
const defaultFilters: FilterState = {
	minRating: 0,
	maxRating: 10,
	maxDistance: null,
	priceRange: [0, 50],
	hasRecentVisits: false,
	minVotes: 0,
	selectedSauces: [],
	dateRange: {
		start: null,
		end: null
	}
};

// Filter stores
export const filterState = writable<FilterState>(defaultFilters);
export const isFilterPanelOpen = writable(false);
export const activeFilterCount = derived(filterState, ($filterState) => {
	let count = 0;

	if ($filterState.minRating > 0) count++;
	if ($filterState.maxRating < 10) count++;
	if ($filterState.maxDistance !== null) count++;
	if ($filterState.priceRange[0] > 0 || $filterState.priceRange[1] < 50) count++;
	if ($filterState.hasRecentVisits) count++;
	if ($filterState.minVotes > 0) count++;
	if ($filterState.selectedSauces.length > 0) count++;
	if ($filterState.dateRange.start || $filterState.dateRange.end) count++;

	return count;
});

// Common sauce types for filtering
export const commonSauces = [
	'Buffalo',
	'BBQ',
	'Honey BBQ',
	'Teriyaki',
	'Sweet & Sour',
	'Hot',
	'Mild',
	'Medium',
	'Garlic Parmesan',
	'Lemon Pepper',
	'Nashville Hot',
	'Cajun',
	'Asian Zing',
	'Mango Habanero'
];

// Filter functions
export function updateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
	filterState.update((state) => ({
		...state,
		[key]: value
	}));
}

export function resetFilters() {
	filterState.set(defaultFilters);
}

export function toggleFilterPanel() {
	isFilterPanelOpen.update((open) => !open);
}

export function closeFilterPanel() {
	isFilterPanelOpen.set(false);
}

// Apply filters to reviews
export function applyFilters(
	reviews: Review[],
	userLocation?: { latitude: number; longitude: number } | null
): Review[] {
	const filters = get(filterState);

	return reviews.filter((review) => {
		// Rating filter
		const rating = Number(review.rating);
		if (rating < filters.minRating || rating > filters.maxRating) {
			return false;
		}

		// Distance filter
		if (filters.maxDistance !== null && userLocation && review.distance) {
			if (review.distance > filters.maxDistance) {
				return false;
			}
		}

		// Votes filter
		const totalVotes = (review.upvotes_count || 0) + (review.downvotes_count || 0);
		if (totalVotes < filters.minVotes) {
			return false;
		}

		// Recent visits filter
		if (filters.hasRecentVisits) {
			const visitDate = new Date(review.date_visited);
			const thirtyDaysAgo = new Date();
			thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
			if (visitDate < thirtyDaysAgo) {
				return false;
			}
		}

		// Date range filter
		if (filters.dateRange.start || filters.dateRange.end) {
			const visitDate = new Date(review.date_visited);
			if (filters.dateRange.start && visitDate < filters.dateRange.start) {
				return false;
			}
			if (filters.dateRange.end && visitDate > filters.dateRange.end) {
				return false;
			}
		}

		// Sauce filter
		if (filters.selectedSauces.length > 0) {
			const reviewSauces = review.sauce_details?.selectedSauces || [];
			const hasMatchingSauce = filters.selectedSauces.some((sauce) =>
				reviewSauces.some((reviewSauce) => reviewSauce.toLowerCase().includes(sauce.toLowerCase()))
			);
			if (!hasMatchingSauce) {
				return false;
			}
		}

		return true;
	});
}

// Quick filter presets
export function applyQuickFilter(
	type: 'nearby' | 'top-rated' | 'recent',
	userLocation?: { latitude: number; longitude: number } | null
) {
	switch (type) {
		case 'nearby':
			if (userLocation) {
				updateFilter('maxDistance', 5); // 5km radius
			}
			break;

		case 'top-rated':
			updateFilter('minRating', 8);
			updateFilter('minVotes', 3);
			break;

		case 'recent':
			updateFilter('hasRecentVisits', true);
			break;
	}
}

// Save/load filter presets
const FILTER_PRESETS_KEY = 'chickenwing-filter-presets';

export function saveFilterPreset(name: string) {
	if (typeof window === 'undefined') return;

	try {
		const presets = getFilterPresets();
		presets[name] = get(filterState);
		localStorage.setItem(FILTER_PRESETS_KEY, JSON.stringify(presets));
	} catch (error) {
		console.error('Error saving filter preset:', error);
	}
}

export function loadFilterPreset(name: string) {
	if (typeof window === 'undefined') return;

	try {
		const presets = getFilterPresets();
		if (presets[name]) {
			filterState.set(presets[name]);
		}
	} catch (error) {
		console.error('Error loading filter preset:', error);
	}
}

export function getFilterPresets(): Record<string, FilterState> {
	if (typeof window === 'undefined') return {};

	try {
		const stored = localStorage.getItem(FILTER_PRESETS_KEY);
		return stored ? JSON.parse(stored) : {};
	} catch (error) {
		console.error('Error getting filter presets:', error);
		return {};
	}
}

export function deleteFilterPreset(name: string) {
	if (typeof window === 'undefined') return;

	try {
		const presets = getFilterPresets();
		delete presets[name];
		localStorage.setItem(FILTER_PRESETS_KEY, JSON.stringify(presets));
	} catch (error) {
		console.error('Error deleting filter preset:', error);
	}
}
