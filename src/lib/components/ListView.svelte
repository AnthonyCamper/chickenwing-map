<script lang="ts">
    export let wingRatings: any[];
    export let onShowReview: (rating: any) => void;
  </script>
  
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {#each wingRatings as rating}
      <div class="bg-white dark:bg-gray-700 p-4 rounded shadow">
        <h2 class="text-xl font-bold">{rating.restaurant_name}</h2>
        <p>Rating: {rating.rating}/10</p>
        <p>{rating.address}</p>
        <p>Visited on: {new Date(rating.date_visited).toLocaleDateString()}</p>
        <button 
          class="mt-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
          on:click={() => onShowReview(rating)}
        >
          Show Review
        </button>
      </div>
    {/each}
  </div>