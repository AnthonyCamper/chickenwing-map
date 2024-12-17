<script lang="ts">
  import { faStar } from '@fortawesome/free-solid-svg-icons';
  import Icon from 'svelte-fa';
  import type { Review } from './types';

  export let review: Review;
  export let isSelected: boolean = false;

  // Debug logs
  console.log('ReviewCard - Review data:', { 
    rating: review.rating,
    date_visited: review.date_visited,
    review: review.review
  });

  function truncateText(text: string, maxLength: number) {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  }
</script>

<button
  class="w-full text-left p-4 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors 
         border-b border-gray-200 dark:border-gray-700 
         {isSelected ? 'bg-blue-50 dark:bg-gray-800' : ''}
         min-h-[44px] touch-manipulation"
  on:click
>
  <div class="flex justify-between items-start mb-3">
    <div class="flex items-center">
      <Icon icon={faStar} class="text-yellow-400 mr-2 text-lg" />
      <span class="font-semibold dark:text-white text-base">{review.rating}/10</span>
    </div>
    <span class="text-sm text-gray-500 dark:text-gray-400">
      {new Date(review.date_visited).toLocaleDateString()}
    </span>
  </div>
  
  <p class="text-base text-gray-600 dark:text-gray-300 line-clamp-2">
    {truncateText(review.review, 100)}
  </p>
</button>
