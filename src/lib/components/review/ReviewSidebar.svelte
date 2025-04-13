<script lang="ts">
  import type { Review } from './types';
  import ReviewCard from './ReviewCard.svelte';
  import { searchQuery, searchResults } from '$lib/stores/searchStore';
  import { faSort, faFilter } from '@fortawesome/free-solid-svg-icons';
  import Icon from 'svelte-fa';

  export let reviews: Review[] = [];
  export let selectedReview: Review | null = null;
  export let onReviewSelect: (review: Review) => void;

  // Get filtered reviews from the store or default to all reviews
  $: displayedReviews = $searchQuery && $searchResults.reviewMatches.length > 0
    ? $searchResults.reviewMatches
    : reviews;
</script>

<div class="w-full sm:w-72 border-r border-gray-200 dark:border-gray-700 flex flex-col 
            h-full sm:h-auto overflow-hidden">
  <!-- Header with count and filter -->
  <div class="p-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">
        {displayedReviews.length} {displayedReviews.length === 1 ? 'review' : 'reviews'}
        {$searchQuery ? `for "${$searchQuery}"` : ''}
      </h3>
    </div>
  </div>
  
  <div class="flex-1 overflow-y-auto">
    {#if displayedReviews.length === 0}
      <div class="p-8 text-center text-gray-500 dark:text-gray-400 flex flex-col items-center justify-center h-full">
        <Icon icon={faFilter} class="h-6 w-6 mb-2 text-gray-400" />
        <p class="mb-1 font-medium">No reviews found</p>
        <p class="text-sm text-gray-400">{$searchQuery ? 'Try a different search term' : 'Add your first review!'}</p>
      </div>
    {:else}
      {#each displayedReviews as review (review.id)}
        <div class="touch-manipulation">
          <ReviewCard
            {review}
            isSelected={selectedReview?.id === review.id}
            on:click={() => onReviewSelect(review)}
          />
        </div>
      {/each}
    {/if}
  </div>
</div>
