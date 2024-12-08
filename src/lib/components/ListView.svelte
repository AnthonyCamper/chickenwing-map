<script lang="ts">
  import { faThumbsUp, faThumbsDown, faSearch, faChevronDown, faChevronUp, faStar, faCalendar } from '@fortawesome/free-solid-svg-icons';
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

  let searchTerm = '';
  let expandedLocations: Set<number> = new Set();
  let reviewSearchTerm = '';

  function toggleSortOrder() {
    sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
  }

  function toggleLocation(locationId: number) {
    if (expandedLocations.has(locationId)) {
      expandedLocations.delete(locationId);
    } else {
      expandedLocations.add(locationId);
    }
    expandedLocations = expandedLocations; // trigger reactivity
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

  // Group reviews by location
  function groupReviewsByLocation(reviews: Review[]): Map<number, Review[]> {
    const grouped = new Map();
    reviews.forEach(review => {
      if (!grouped.has(review.location_id)) {
        grouped.set(review.location_id, []);
      }
      grouped.get(review.location_id).push(review);
    });
    return grouped;
  }

  // Filter reviews based on search terms
  $: filteredReviews = reviews.filter(review => {
    const locationSearchLower = searchTerm.toLowerCase();
    const reviewSearchLower = reviewSearchTerm.toLowerCase();
    
    const matchesLocation = 
      review.location.restaurant_name.toLowerCase().includes(locationSearchLower) ||
      review.location.address.toLowerCase().includes(locationSearchLower);
    
    const matchesReview = 
      review.review.toLowerCase().includes(reviewSearchLower) ||
      review.rating.toString().includes(reviewSearchLower) ||
      new Date(review.date_visited).toLocaleDateString().toLowerCase().includes(reviewSearchLower);
    
    return matchesLocation && matchesReview;
  });

  // Sort and group reviews
  $: sortedReviews = [...filteredReviews].sort((a, b) => {
    const aValue = getSortValue(a);
    const bValue = getSortValue(b);
    
    if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  $: groupedReviews = groupReviewsByLocation(sortedReviews);

  // Calculate average rating for a location
  function getLocationStats(reviews: Review[]) {
    const avgRating = reviews.reduce((sum, r) => sum + parseFloat(r.rating), 0) / reviews.length;
    const totalUpvotes = reviews.reduce((sum, r) => sum + (r.upvotes_count || 0), 0);
    const totalDownvotes = reviews.reduce((sum, r) => sum + (r.downvotes_count || 0), 0);
    return { avgRating, totalUpvotes, totalDownvotes };
  }
</script>

<div class="space-y-4">
  <!-- Search Controls -->
  <div class="flex flex-col sm:flex-row gap-4">
    <!-- Location Search -->
    <div class="relative flex-1">
      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Icon icon={faSearch} class="text-gray-400" />
      </div>
      <input
        type="text"
        bind:value={searchTerm}
        placeholder="Search locations..."
        class="w-full pl-10 pr-4 py-2 rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>

    <!-- Review Search -->
    <div class="relative flex-1">
      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Icon icon={faSearch} class="text-gray-400" />
      </div>
      <input
        type="text"
        bind:value={reviewSearchTerm}
        placeholder="Search reviews..."
        class="w-full pl-10 pr-4 py-2 rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
    
    <!-- Sort Controls -->
    <div class="flex items-center space-x-2">
      <select 
        bind:value={sortBy} 
        class="p-2 rounded dark:bg-gray-700 dark:text-white border dark:border-gray-600"
      >
        <option value="rating">Rating</option>
        <option value="name">Restaurant Name</option>
        <option value="date">Date Visited</option>
        <option value="distance">Distance</option>
      </select>
      <button 
        on:click={toggleSortOrder} 
        class="p-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
      >
        {sortOrder === 'asc' ? '↑' : '↓'}
      </button>
    </div>
  </div>

  <!-- Locations List -->
  <div class="space-y-4">
    {#each [...groupedReviews] as [locationId, locationReviews]}
      {@const location = locationReviews[0].location}
      {@const stats = getLocationStats(locationReviews)}
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <!-- Location Header -->
        <div 
          class="p-4 bg-gray-50 dark:bg-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          on:click={() => toggleLocation(locationId)}
        >
          <div class="flex justify-between items-start">
            <div class="space-y-1">
              <h2 class="text-xl font-bold dark:text-white">{location.restaurant_name}</h2>
              <p class="text-gray-600 dark:text-gray-300">{location.address}</p>
              <div class="flex items-center space-x-4">
                <div class="flex items-center">
                  <Icon icon={faStar} class="text-yellow-400 mr-1" />
                  <span class="dark:text-white">{stats.avgRating.toFixed(1)}</span>
                </div>
                <div class="flex items-center space-x-4">
                  <div class="flex items-center">
                    <Icon icon={faThumbsUp} class="text-green-500 mr-1" />
                    <span class="dark:text-white">{stats.totalUpvotes}</span>
                  </div>
                  <div class="flex items-center">
                    <Icon icon={faThumbsDown} class="text-red-500 mr-1" />
                    <span class="dark:text-white">{stats.totalDownvotes}</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="flex items-center">
              <span class="mr-2 text-sm text-gray-500 dark:text-gray-400">
                {locationReviews.length} {locationReviews.length === 1 ? 'review' : 'reviews'}
              </span>
              <Icon 
                icon={expandedLocations.has(locationId) ? faChevronUp : faChevronDown} 
                class="text-gray-400"
              />
            </div>
          </div>
        </div>

        <!-- Reviews for this location -->
        {#if expandedLocations.has(locationId)}
          <div class="divide-y divide-gray-200 dark:divide-gray-600">
            {#each locationReviews as review}
              <div class="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <div class="flex justify-between items-start">
                  <div class="space-y-2 flex-1">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center space-x-4">
                        <div class="flex items-center">
                          <Icon icon={faStar} class="text-yellow-400 mr-1" />
                          <span class="text-lg font-semibold dark:text-white">{review.rating}/10</span>
                        </div>
                        <div class="flex items-center text-gray-500 dark:text-gray-400">
                          <Icon icon={faCalendar} class="mr-1" />
                          <span>{new Date(review.date_visited).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div class="flex items-center space-x-4">
                        <div class="flex items-center">
                          <Icon icon={faThumbsUp} class="text-green-500 mr-1" />
                          <span class="dark:text-white">{review.upvotes_count || 0}</span>
                        </div>
                        <div class="flex items-center">
                          <Icon icon={faThumbsDown} class="text-red-500 mr-1" />
                          <span class="dark:text-white">{review.downvotes_count || 0}</span>
                        </div>
                      </div>
                    </div>
                    <p class="text-gray-700 dark:text-gray-300">{review.review}</p>
                    <button 
                      class="mt-2 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                      on:click={() => onShowReview(review)}
                    >
                      View Full Review
                    </button>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>
