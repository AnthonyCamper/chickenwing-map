<script lang="ts">
  import { faStar, faMapMarkerAlt, faCalendarAlt } from '@fortawesome/free-solid-svg-icons';
  import Icon from 'svelte-fa';
  import type { Review } from './types';

  export let review: Review;
  export let isSelected: boolean = false;
</script>

<button
  class="w-full text-left transition-all duration-200 card border-0 border-b dark:border-gray-700 rounded-none hover:bg-gray-50 dark:hover:bg-gray-800 
         {isSelected ? 'bg-primary-50 dark:bg-gray-800 border-l-4 border-l-primary-500' : ''}"
  on:click
>
  <div class="p-4">
    <div class="flex justify-between items-start mb-2">
      <h3 class="font-medium text-gray-900 dark:text-white text-base">
        {review.location.restaurant_name}
      </h3>
      <div class="flex items-center bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2 py-1 rounded-full text-sm">
        <Icon icon={faStar} class="text-yellow-400 mr-1 text-sm" />
        <span class="font-medium">{review.rating}/10</span>
      </div>
    </div>
    
    <div class="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-2 space-x-4">
      <div class="flex items-center">
        <Icon icon={faMapMarkerAlt} class="mr-1 text-gray-400" />
        <span>{review.location.address || 'Location'}</span>
      </div>
      <div class="flex items-center">
        <Icon icon={faCalendarAlt} class="mr-1 text-gray-400" />
        <span>{new Date(review.date_visited).toLocaleDateString()}</span>
      </div>
    </div>
    
    <p class="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
      {review.review}
    </p>
  </div>
</button>
