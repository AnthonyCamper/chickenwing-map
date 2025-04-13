<script lang="ts">
  import { faFilter, faChevronDown, faChevronUp, faStar, faCalendar, faMapMarkerAlt, faSort } from '@fortawesome/free-solid-svg-icons';
  import Icon from 'svelte-fa';
  import ReviewCard from './review/ReviewCard.svelte';
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
  function handleSortClick(event: MouseEvent): void {
    event.stopPropagation();
    showFilterMenu = !showFilterMenu;
  }
  
  // Handle click inside dropdown to prevent propagation
  function handleDropdownClick(event: MouseEvent): void {
    event.stopPropagation();
  }

  // Get displayed reviews from search store or all reviews
  $: displayedReviews = $searchQuery && $searchResults.reviewMatches.length > 0
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

<div class="h-full flex flex-col">
  <!-- List header with count and filters -->
  <div class="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
    <div class="flex justify-between items-center">
      <h2 class="text-sm font-medium text-gray-500 dark:text-gray-400">
        {sortedReviews.length} {sortedReviews.length === 1 ? 'review' : 'reviews'} 
        {$searchQuery ? `found for "${$searchQuery}"` : 'total'}
      </h2>
      
      <!-- Sort and filter dropdown -->
      <div class="relative">
        <button 
          class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 flex items-center space-x-1 text-sm"
          on:click={handleSortClick}
        >
          <Icon icon={faSort} class="h-4 w-4" />
          <span>Sort</span>
        </button>
        
        {#if showFilterMenu}
          <div 
            class="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 
                  ring-1 ring-black ring-opacity-5 z-[1001]"
            on:click={handleDropdownClick}
          >
            <div class="py-1" role="menu" aria-orientation="vertical">
              <!-- Sort options -->
              <div class="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Sort by
              </div>
              <button
                class="w-full text-left px-4 py-2 text-sm {$sortBy === 'rating' ? 'text-primary-600 dark:text-primary-400 bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-300'} hover:bg-gray-100 dark:hover:bg-gray-700"
                on:click={() => setSortBy('rating')}
              >
                Rating
              </button>
              <button
                class="w-full text-left px-4 py-2 text-sm {$sortBy === 'name' ? 'text-primary-600 dark:text-primary-400 bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-300'} hover:bg-gray-100 dark:hover:bg-gray-700"
                on:click={() => setSortBy('name')}
              >
                Restaurant Name
              </button>
              <button
                class="w-full text-left px-4 py-2 text-sm {$sortBy === 'date' ? 'text-primary-600 dark:text-primary-400 bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-300'} hover:bg-gray-100 dark:hover:bg-gray-700"
                on:click={() => setSortBy('date')}
              >
                Date Visited
              </button>
              {#if userLocation}
                <button
                  class="w-full text-left px-4 py-2 text-sm {$sortBy === 'distance' ? 'text-primary-600 dark:text-primary-400 bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-300'} hover:bg-gray-100 dark:hover:bg-gray-700"
                  on:click={() => setSortBy('distance')}
                >
                  Distance
                </button>
              {/if}

              <!-- Divider -->
              <div class="border-t border-gray-200 dark:border-gray-700 my-1"></div>

              <!-- Order direction -->
              <button
                class="w-full text-left px-4 py-2 text-sm flex items-center justify-between text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                on:click={toggleSortOrder}
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
  <div class="overflow-y-auto flex-1">
    {#if sortedReviews.length === 0}
      <div class="flex flex-col items-center justify-center p-8 text-center h-full">
        <div class="text-gray-400 mb-2">
          <Icon icon={faStar} class="h-8 w-8" />
        </div>
        <p class="text-gray-600 dark:text-gray-400 mb-1">No reviews found</p>
        <p class="text-sm text-gray-500 dark:text-gray-500">{$searchQuery ? 'Try another search term' : 'Be the first to add a review!'}</p>
      </div>
    {:else}
      <div class="divide-y divide-gray-200 dark:divide-gray-700">
        {#each sortedReviews as review (review.id)}
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <div 
            on:click={() => onItemClick(review)} 
            role="button" 
            tabindex="0"
            class="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
            on:keydown={(event) => handleKeyDown(event, review)}
          >
            <ReviewCard {review} isSelected={String(review.id) === String(selectedReviewId)} />
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
