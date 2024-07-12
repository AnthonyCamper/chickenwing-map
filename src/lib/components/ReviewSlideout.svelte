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
    transition:fly={{ x: 320, duration: 300 }}
    class="fixed right-0 top-0 h-full w-full sm:w-96 bg-white dark:bg-gray-900 shadow-lg p-6 z-[2000] overflow-y-auto"
  >
    <button 
      on:click={onClose} 
      class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
    >
      <Icon icon={faTimes} />
    </button>
    
    <h2 class="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">{rating.restaurant_name}</h2>
    
    <div class="flex items-center mb-4">
      <Icon icon={faStar} class="text-yellow-400 mr-2" />
      <span class="text-lg font-semibold text-gray-700 dark:text-gray-200">{rating.rating}/10</span>
    </div>
    
    <a 
      href={getGoogleMapsLink(rating.address)} 
      target="_blank" 
      rel="noopener noreferrer" 
      class="flex items-center mb-4 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
    >
      <Icon icon={faMapMarkerAlt} class="mr-2" />
      <span class="underline">{rating.address}</span>
    </a>
    
    <div class="flex items-center mb-4 text-gray-600 dark:text-gray-300">
      <Icon icon={faCalendar} class="mr-2" />
      <span>Visited on: {new Date(rating.date_visited).toLocaleDateString()}</span>
    </div>
    
    {#if rating.distance !== undefined}
      <div class="flex items-center mb-4 text-gray-600 dark:text-gray-300">
        <Icon icon={faRuler} class="mr-2" />
        <span>Distance: {rating.distance.toFixed(2)} km</span>
      </div>
    {/if}
    
    <div class="mt-6">
      <h3 class="text-lg font-semibold mb-2 text-gray-700 dark:text-gray-200">Review</h3>
      <p class="text-gray-600 dark:text-gray-300 leading-relaxed">{rating.review}</p>
    </div>
  </div>
{/if}