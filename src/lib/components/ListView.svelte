<script lang="ts">
  import { faThumbsUp, faThumbsDown, faSearch, faChevronDown, faChevronUp, faStar, faCalendar, faMapMarkerAlt, faTimes } from '@fortawesome/free-solid-svg-icons';
  import Icon from 'svelte-fa';
  import ReviewCard from './review/ReviewCard.svelte';
  import type { Review } from './review/types';

  export let reviews: Review[];
  export let userLocation: { latitude: number; longitude: number } | null;
  export let onItemClick: (review: Review) => void;
  export let selectedReviewId: string | number | undefined;

  let searchTerm = '';

  // Filter reviews based on search term
  $: filteredReviews = searchTerm.trim() 
    ? reviews.filter(review => 
        review.location.restaurant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (review.location.address && review.location.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
        review.review.toLowerCase().includes(searchTerm.toLowerCase()))
    : reviews;

  // Format distance for display
  function formatDistance(distance: number): string {
    if (distance < 1) {
      return `${Math.round(distance * 1000)} m`;
    } else {
      return `${distance.toFixed(1)} km`;
    }
  }
</script>

<div class="h-full flex flex-col">
  <!-- Search input for filtering reviews -->
  <div class="p-4 border-b border-gray-200 dark:border-gray-700">
    <div class="relative">
      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Icon icon={faSearch} class="h-5 w-5 text-gray-400" />
      </div>
      <input
        type="text"
        class="form-input pl-10 pr-10 py-2 w-full"
        placeholder="Filter reviews..."
        bind:value={searchTerm}
      />
      {#if searchTerm}
        <div class="absolute inset-y-0 right-0 pr-3 flex items-center">
          <button
            class="text-gray-400 hover:text-gray-500 focus:outline-none"
            on:click={() => searchTerm = ''}
            aria-label="Clear search"
          >
            <Icon icon={faTimes} class="h-5 w-5" />
          </button>
        </div>
      {/if}
    </div>
  </div>

  <!-- List header with count -->
  <div class="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
    <div class="flex justify-between items-center">
      <h2 class="text-sm font-medium text-gray-500 dark:text-gray-400">
        {filteredReviews.length} {filteredReviews.length === 1 ? 'review' : 'reviews'} found
      </h2>
      
      {#if searchTerm && filteredReviews.length !== reviews.length}
        <button 
          class="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 text-sm font-medium"
          on:click={() => searchTerm = ''}
        >
          Clear filter
        </button>
      {/if}
    </div>
  </div>

  <!-- Reviews list -->
  <div class="overflow-y-auto flex-1">
    {#if filteredReviews.length === 0}
      <div class="flex flex-col items-center justify-center p-8 text-center h-full">
        <div class="text-gray-400 mb-2">
          <Icon icon={faSearch} class="h-8 w-8" />
        </div>
        <p class="text-gray-600 dark:text-gray-400 mb-1">No reviews found</p>
        <p class="text-sm text-gray-500 dark:text-gray-500">{searchTerm ? 'Try another search term' : 'Be the first to add a review!'}</p>
      </div>
    {:else}
      <div class="divide-y divide-gray-200 dark:divide-gray-700">
        {#each filteredReviews as review (review.id)}
          <div on:click={() => onItemClick(review)} on:keydown={() => {}} role="button" tabindex="0">
            <ReviewCard {review} isSelected={String(review.id) === String(selectedReviewId)} />
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
