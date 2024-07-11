<script lang="ts">
  import { fly } from 'svelte/transition';
  export let rating: any | null;
  export let onClose: () => void;
</script>

{#if rating}
  <div
    transition:fly={{ x: 320, duration: 300 }}
    class="fixed right-0 top-0 h-full w-full sm:w-80 bg-white dark:bg-gray-800 shadow-lg p-4 z-[2000] overflow-y-auto"
  >
    <button on:click={onClose} class="absolute top-2 right-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
      &times;
    </button>
    <h2 class="text-xl font-bold mb-2">{rating.restaurant_name}</h2>
    <p class="mb-2">Rating: {rating.rating}/10</p>
    <p class="mb-2">{rating.address}</p>
    <p class="mb-2">Visited on: {new Date(rating.date_visited).toLocaleDateString()}</p>
    <p class="mb-2">Review: {rating.review}</p>
    {#if rating.distance !== undefined}
      <p class="mb-2">Distance: {rating.distance.toFixed(2)} km</p>
    {/if}
  </div>
{/if}