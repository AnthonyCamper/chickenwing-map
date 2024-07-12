<script lang="ts">
  import { fly } from 'svelte/transition';
  import { faTimes, faStar, faMapMarkerAlt, faCalendar, faRuler } from '@fortawesome/free-solid-svg-icons';
  import Icon from 'svelte-fa';

  export let rating: any | null;
  export let onClose: () => void;

  function getGoogleMapsLink(address: string) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }
</script>

{#if rating}
  <div
    transition:fly={{ x: '100%', duration: 300 }}
    class="fixed inset-y-0 right-0 w-full sm:w-96 bg-white dark:bg-gray-900 shadow-lg z-[2000] flex flex-col"
  >
    <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-xl font-bold text-gray-800 dark:text-gray-100">{rating.restaurant_name}</h2>
      <button 
        on:click={onClose} 
        class="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600"
      >
        <Icon icon={faTimes} class="text-xl" />
      </button>
    </div>
    
    <div class="flex-1 overflow-y-auto p-4">
      <div class="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-4">
        <div class="flex items-center mb-2">
          <Icon icon={faStar} class="text-yellow-400 mr-2" />
          <span class="text-2xl font-bold text-gray-700 dark:text-gray-200">{rating.rating}/10</span>
        </div>
        
        <a 
          href={getGoogleMapsLink(rating.address)} 
          target="_blank" 
          rel="noopener noreferrer" 
          class="flex items-center mb-2 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
        >
          <Icon icon={faMapMarkerAlt} class="mr-2" />
          <span class="underline">{rating.address}</span>
        </a>
        
        <div class="flex items-center mb-2 text-gray-600 dark:text-gray-300">
          <Icon icon={faCalendar} class="mr-2" />
          <span>Visited: {new Date(rating.date_visited).toLocaleDateString()}</span>
        </div>
        
        {#if rating.distance !== undefined}
          <div class="flex items-center text-gray-600 dark:text-gray-300">
            <Icon icon={faRuler} class="mr-2" />
            <span>Distance: {rating.distance.toFixed(2)} km</span>
          </div>
        {/if}
      </div>
      
      <div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
        <h3 class="text-lg font-semibold mb-2 text-gray-700 dark:text-gray-200">Review</h3>
        <p class="text-gray-600 dark:text-gray-300 leading-relaxed">{rating.review}</p>
      </div>
    </div>
  </div>
{/if}