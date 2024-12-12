<script lang="ts">
  import { faStar, faMapMarkerAlt, faCalendar, faRuler, faUser } from '@fortawesome/free-solid-svg-icons';
  import Icon from 'svelte-fa';
  import type { Review } from './types';

  export let review: Review;

  function getGoogleMapsLink(address: string) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }
</script>

<div class="flex-1 overflow-y-auto">
  <div class="p-4 space-y-4 max-w-3xl mx-auto">
    <div class="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 sm:p-6">
      <!-- Reviewer Info -->
      <div class="flex items-center mb-4">
        <Icon icon={faUser} class="text-gray-400 mr-3 text-xl" />
        <span class="text-gray-700 dark:text-gray-200 text-base sm:text-lg">Anonymous</span>
      </div>

      <div class="flex items-center mb-4">
        <Icon icon={faStar} class="text-yellow-400 mr-3 text-xl" />
        <span class="text-2xl sm:text-3xl font-bold text-gray-700 dark:text-gray-200">{review.rating}/10</span>
      </div>
      
      {#if review.location}
        <a 
          href={getGoogleMapsLink(review.location.address)} 
          target="_blank" 
          rel="noopener noreferrer" 
          class="flex items-center mb-4 text-blue-500 hover:text-blue-600 
                 dark:text-blue-400 dark:hover:text-blue-300 transition-colors
                 min-h-[44px] touch-manipulation break-words"
        >
          <Icon icon={faMapMarkerAlt} class="mr-3 text-xl flex-shrink-0" />
          <span class="underline text-base sm:text-lg">{review.location.address}</span>
        </a>
      {/if}
      
      <div class="flex items-center mb-4 text-gray-600 dark:text-gray-300">
        <Icon icon={faCalendar} class="mr-3 text-xl flex-shrink-0" />
        <span class="text-base sm:text-lg">
          Visited: {new Date(review.date_visited).toLocaleDateString()}
        </span>
      </div>
      
      {#if review.distance !== undefined}
        <div class="flex items-center text-gray-600 dark:text-gray-300">
          <Icon icon={faRuler} class="mr-3 text-xl flex-shrink-0" />
          <span class="text-base sm:text-lg">
            Distance: {review.distance.toFixed(2)} km
          </span>
        </div>
      {/if}
    </div>
    
    <div class="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow">
      <h3 class="text-lg sm:text-xl font-semibold mb-3 text-gray-700 dark:text-gray-200">
        Review
      </h3>
      <p class="text-gray-600 dark:text-gray-300 leading-relaxed text-base sm:text-lg 
                whitespace-pre-wrap break-words">
        {review.review}
      </p>
    </div>
  </div>
</div>
