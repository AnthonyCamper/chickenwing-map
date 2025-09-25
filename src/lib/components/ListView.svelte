<script lang="ts">
	import {
		faFilter,
		faChevronDown,
		faChevronUp,
		faStar,
		faCalendar,
		faMapMarkerAlt,
		faSort
	} from '@fortawesome/free-solid-svg-icons';
	import Icon from 'svelte-fa';
	import ReviewCard from './review/ReviewCard.svelte';
	import Button from '$lib/components/Button.svelte';
	import type { Review } from './review/types';
	import { searchQuery, searchResults, performSearch } from '$lib/stores/searchStore';
	import { writable } from 'svelte/store';

	export let reviews: Review[];
	export let userLocation: { latitude: number; longitude: number } | null;
	export let onItemClick: (review: Review) => void;
	export let selectedReviewId: string | number | undefined;

	// Local filters
	let sortBy = writable('rating');
	let sortOrder = writable('desc');
	let showFilterMenu = false;

	// Format distance for display
	function formatDistance(distance: number): string {
		if (distance < 1) {
			return `${Math.round(distance * 1000)} m`;
		} else {
			return `${distance.toFixed(1)} km`;
		}
	}

	// Handle keyboard events for accessibility
	function handleKeyDown(event: KeyboardEvent, review: Review): void {
		if (event.key === 'Enter') {
			onItemClick(review);
		}
	}

	// Handle click on sort button
	function handleSortClick(event: CustomEvent<MouseEvent>): void {
		event.detail.stopPropagation();
		showFilterMenu = !showFilterMenu;
	}

	// Handle click inside dropdown to prevent propagation
	function handleDropdownClick(event: MouseEvent): void {
		event.stopPropagation();
	}

	// Get displayed reviews from search store or all reviews
	$: displayedReviews =
		$searchQuery && $searchResults.reviewMatches.length > 0
			? $searchResults.reviewMatches
			: reviews;

	// Sort displayed reviews
	$: sortedReviews = [...displayedReviews].sort((a, b) => {
		const order = $sortOrder === 'asc' ? 1 : -1;
		switch ($sortBy) {
			case 'rating':
				return (parseFloat(b.rating) - parseFloat(a.rating)) * order;
			case 'name':
				return a.location.restaurant_name.localeCompare(b.location.restaurant_name) * order;
			case 'date':
				return (new Date(b.date_visited).getTime() - new Date(a.date_visited).getTime()) * order;
			case 'distance':
				if (userLocation) {
					const distanceA = a.distance || 0;
					const distanceB = b.distance || 0;
					return (distanceA - distanceB) * order;
				}
				return 0;
			default:
				return 0;
		}
	});

	// Toggle sort order
	function toggleSortOrder(): void {
		$sortOrder = $sortOrder === 'asc' ? 'desc' : 'asc';
	}

	// Set sort criteria
	function setSortBy(criteria: string): void {
		$sortBy = criteria;
	}

	// Close filter menu when clicking outside
	function handleClickOutside(): void {
		showFilterMenu = false;
	}
</script>

<svelte:window on:click={handleClickOutside} />

<div class="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
	<!-- Modern list header -->
	<div class="px-6 py-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
		<div class="flex justify-between items-center">
			<div>
				<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Reviews</h2>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
					{sortedReviews.length}
					{sortedReviews.length === 1 ? 'review' : 'reviews'}
					{$searchQuery ? `found for "${$searchQuery}"` : 'total'}
				</p>
			</div>

			<!-- Modern sort dropdown -->
			<div class="relative">
				<Button variant="ghost" size="sm" on:click={handleSortClick}>
					<Icon icon={faSort} class="h-4 w-4 mr-2" />
					Sort
				</Button>

				{#if showFilterMenu}
					<div
						class="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-[1001] overflow-hidden"
						on:click={handleDropdownClick}
					>
						<div class="py-2" role="menu" aria-orientation="vertical">
							<!-- Sort options header -->
							<div
								class="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800/50"
							>
								Sort by
							</div>

							<!-- Sort options -->
							<button
								class="w-full text-left px-4 py-2.5 text-sm transition-colors {$sortBy === 'rating'
									? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
									: 'text-gray-700 dark:text-gray-300'} hover:bg-gray-50 dark:hover:bg-gray-800"
								on:click={() => {
									setSortBy('rating');
									showFilterMenu = false;
								}}
							>
								Rating
							</button>
							<button
								class="w-full text-left px-4 py-2.5 text-sm transition-colors {$sortBy === 'name'
									? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
									: 'text-gray-700 dark:text-gray-300'} hover:bg-gray-50 dark:hover:bg-gray-800"
								on:click={() => {
									setSortBy('name');
									showFilterMenu = false;
								}}
							>
								Restaurant Name
							</button>
							<button
								class="w-full text-left px-4 py-2.5 text-sm transition-colors {$sortBy === 'date'
									? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
									: 'text-gray-700 dark:text-gray-300'} hover:bg-gray-50 dark:hover:bg-gray-800"
								on:click={() => {
									setSortBy('date');
									showFilterMenu = false;
								}}
							>
								Date Visited
							</button>
							{#if userLocation}
								<button
									class="w-full text-left px-4 py-2.5 text-sm transition-colors {$sortBy ===
									'distance'
										? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
										: 'text-gray-700 dark:text-gray-300'} hover:bg-gray-50 dark:hover:bg-gray-800"
									on:click={() => {
										setSortBy('distance');
										showFilterMenu = false;
									}}
								>
									Distance
								</button>
							{/if}

							<!-- Divider -->
							<div class="border-t border-gray-200 dark:border-gray-700 my-2"></div>

							<!-- Order direction -->
							<button
								class="w-full text-left px-4 py-2.5 text-sm flex items-center justify-between text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
								on:click={() => {
									toggleSortOrder();
									showFilterMenu = false;
								}}
							>
								<span>{$sortOrder === 'desc' ? 'Descending' : 'Ascending'}</span>
								<Icon icon={$sortOrder === 'desc' ? faChevronDown : faChevronUp} class="h-4 w-4" />
							</button>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Reviews list -->
	<div class="overflow-y-auto flex-1 p-4">
		{#if sortedReviews.length === 0}
			<div class="flex flex-col items-center justify-center h-full text-center py-16">
				<div
					class="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4"
				>
					<Icon icon={faStar} class="h-8 w-8 text-gray-400 dark:text-gray-500" />
				</div>
				<h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No reviews found</h3>
				<p class="text-gray-500 dark:text-gray-400 max-w-sm">
					{$searchQuery
						? 'Try adjusting your search terms or browse all reviews.'
						: 'Be the first to share your wing experience!'}
				</p>
			</div>
		{:else}
			<!-- Modern grid layout -->
			<div class="grid gap-4 auto-rows-fr">
				{#each sortedReviews as review (review.id)}
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<div
						on:click={() => onItemClick(review)}
						on:keydown={(event) => handleKeyDown(event, review)}
					>
						<ReviewCard {review} isSelected={String(review.id) === String(selectedReviewId)} />
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
