<script lang="ts">
  import { faThumbsUp, faThumbsDown } from '@fortawesome/free-solid-svg-icons';
  import Icon from 'svelte-fa';

  export let wingRatings: any[];
  export let onShowReview: (rating: any) => void;
  export let sortBy: string;
  export let sortOrder: string;

  function toggleSortOrder() {
    sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
  }
</script>

<div class="mb-4">
  <label for="sort-select" class="mr-2">Sort by:</label>
  <select 
    id="sort-select" 
    bind:value={sortBy} 
    class="p-2 rounded dark:bg-gray-700 dark:text-white"
  >
    <option value="rating">Rating</option>
    <option value="name">Restaurant Name</option>
    <option value="date">Date Visited</option>
    <option value="distance">Distance</option>
  </select>
  <button 
    on:click={toggleSortOrder} 
    class="ml-2 p-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
  >
    {sortOrder === 'asc' ? '↑' : '↓'}
  </button>
</div>

<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {#each wingRatings as rating}
    <div class="bg-white dark:bg-gray-700 p-4 rounded shadow">
      <h2 class="text-xl font-bold">{rating.restaurant_name}</h2>
      <div class="flex items-center space-x-4 mt-2">
        <div class="flex items-center">
          <Icon icon={faThumbsUp} class="text-green-500 mr-1" />
          <span>{rating.upvotes_count || 0}</span>
        </div>
        <div class="flex items-center">
          <Icon icon={faThumbsDown} class="text-red-500 mr-1" />
          <span>{rating.downvotes_count || 0}</span>
        </div>
      </div>
      <p class="mt-2">Rating: {rating.rating}/10</p>
      <p>{rating.address}</p>
      <p>Visited on: {new Date(rating.date_visited).toLocaleDateString()}</p>
      {#if rating.distance !== undefined}
        <p>Distance: {rating.distance.toFixed(2)} km</p>
      {/if}
      <button 
        class="mt-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
        on:click={() => onShowReview(rating)}
      >
        Show Review
      </button>
    </div>
  {/each}
</div>
