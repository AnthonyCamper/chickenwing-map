<script lang="ts">
  import { faThumbsUp, faThumbsDown } from '@fortawesome/free-solid-svg-icons';
  import Icon from 'svelte-fa';

  interface Location {
    id: number;
    restaurant_name: string;
    address: string;
    latitude: number;
    longitude: number;
  }

  interface Review {
    id: number;
    location_id: number;
    user_id: string;
    review: string;
    rating: string;
    date_visited: string;
    location: Location;
    distance?: number;
    upvotes_count: number;
    downvotes_count: number;
  }

  export let reviews: Review[];
  export let onShowReview: (review: Review) => void;
  export let sortBy: string;
  export let sortOrder: string;

  function toggleSortOrder() {
    sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
  }

  // Helper function to get the value to sort by
  function getSortValue(review: Review): any {
    switch (sortBy) {
      case 'rating':
        return parseFloat(review.rating);
      case 'name':
        return review.location.restaurant_name.toLowerCase();
      case 'date':
        return new Date(review.date_visited).getTime();
      case 'distance':
        return review.distance ?? Infinity;
      default:
        return review.location.restaurant_name.toLowerCase();
    }
  }

  // Computed sorted reviews
  $: sortedReviews = [...reviews].sort((a, b) => {
    const aValue = getSortValue(a);
    const bValue = getSortValue(b);
    
    if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });
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
  {#each sortedReviews as review}
    <div class="bg-white dark:bg-gray-700 p-4 rounded shadow">
      <h2 class="text-xl font-bold">{review.location.restaurant_name}</h2>
      <div class="flex items-center space-x-4 mt-2">
        <div class="flex items-center">
          <Icon icon={faThumbsUp} class="text-green-500 mr-1" />
          <span>{review.upvotes_count || 0}</span>
        </div>
        <div class="flex items-center">
          <Icon icon={faThumbsDown} class="text-red-500 mr-1" />
          <span>{review.downvotes_count || 0}</span>
        </div>
      </div>
      <p class="mt-2">Rating: {review.rating}/10</p>
      <p>{review.location.address}</p>
      <p>Visited on: {new Date(review.date_visited).toLocaleDateString()}</p>
      {#if review.distance !== undefined}
        <p>Distance: {review.distance.toFixed(2)} km</p>
      {/if}
      <button 
        class="mt-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
        on:click={() => onShowReview(review)}
      >
        Show Review
      </button>
    </div>
  {/each}
</div>
