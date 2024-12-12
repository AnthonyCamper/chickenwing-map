<script lang="ts">
  import { faSearch } from '@fortawesome/free-solid-svg-icons';
  import Icon from 'svelte-fa';
  import type { Review } from './types';
  import ReviewCard from './ReviewCard.svelte';

  export let reviews: Review[] = [];
  export let selectedReview: Review | null = null;
  export let onReviewSelect: (review: Review) => void;

  let searchTerm = '';

  $: filteredReviews = reviews.filter(r => {
    const searchLower = searchTerm.toLowerCase();
    return (
      r.review.toLowerCase().includes(searchLower) ||
      r.rating.toString().includes(searchLower) ||
      new Date(r.date_visited).toLocaleDateString().toLowerCase().includes(searchLower)
    );
  });
</script>

<div class="w-full sm:w-72 border-r border-gray-200 dark:border-gray-700 flex flex-col 
            h-full sm:h-auto overflow-hidden">
  <div class="p-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900">
    <div class="relative">
      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Icon icon={faSearch} class="text-gray-400" />
      </div>
      <input
        type="text"
        bind:value={searchTerm}
        placeholder="Search reviews..."
        class="w-full pl-10 pr-4 py-3 text-base rounded-lg border dark:border-gray-600 
               dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 
               focus:border-transparent min-h-[44px]"
      />
    </div>
  </div>
  
  <div class="flex-1 overflow-y-auto">
    {#each filteredReviews as review (review.id)}
      <div class="touch-manipulation">
        <ReviewCard
          {review}
          isSelected={selectedReview?.id === review.id}
          on:click={() => onReviewSelect(review)}
        />
      </div>
    {/each}
  </div>
</div>
