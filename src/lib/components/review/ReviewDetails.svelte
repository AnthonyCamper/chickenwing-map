<script lang="ts">
  import { faStar, faMapMarkerAlt, faCalendar, faRuler, faUser, faThumbsUp, faThumbsDown, faBeer, faTruck, faUtensils } from '@fortawesome/free-solid-svg-icons';
  import Icon from 'svelte-fa';
  import type { Review } from './types';
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';

  export let review: Review;
  let displayName = '';

  async function fetchUserProfile() {
    if (!review.user_id) return;
    
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('display_name')
        .eq('user_id', review.user_id)
        .single();
      
      if (error) throw error;
      if (data?.display_name) {
        displayName = data.display_name;
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  }

  onMount(() => {
    fetchUserProfile();
  });

  // Debug logs
  console.log('ReviewDetails - Full review data:', review);
  console.log('ReviewDetails - Rating:', review.rating);

  function getGoogleMapsLink(address: string) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }

  function formatRating(value: number | null): string {
    return value === null ? 'N/A' : `${value}/10`;
  }

  const isOldReview = !review.experience_details && !review.sauce_details && !review.ratings;
</script>

<div class="flex-1 overflow-y-auto">
  <div class="p-4 space-y-4 max-w-3xl mx-auto">
    <!-- Basic Info Section -->
    <div class="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 sm:p-6">
      <div class="flex flex-wrap gap-4 mb-4">
        <div class="flex items-center">
          <Icon icon={faUser} class="text-gray-400 mr-3 text-xl" />
          <span class="text-gray-700 dark:text-gray-200 text-base sm:text-lg">{displayName}</span>
        </div>

        <div class="flex items-center">
          <Icon icon={faStar} class="text-yellow-400 mr-3 text-xl" />
          <span class="text-2xl sm:text-3xl font-bold text-gray-700 dark:text-gray-200">{review.rating}/10</span>
        </div>

        <div class="flex items-center space-x-4">
          <div class="flex items-center">
            <Icon icon={faThumbsUp} class="text-green-500 mr-2" />
            <span class="text-base">{review.upvotes_count || 0}</span>
          </div>
          <div class="flex items-center">
            <Icon icon={faThumbsDown} class="text-red-500 mr-2" />
            <span class="text-base">{review.downvotes_count || 0}</span>
          </div>
        </div>
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

    <!-- Experience Details Section -->
    {#if !isOldReview && review.experience_details}
      <div class="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow">
        <h3 class="text-lg sm:text-xl font-semibold mb-4 text-gray-700 dark:text-gray-200">
          Experience Details
        </h3>
        <div class="space-y-4">
          <div class="flex flex-wrap gap-4">
            {#if review.experience_details.beerInfluence !== null}
              <div class="flex items-center">
                <Icon icon={faBeer} class="mr-2 {review.experience_details.beerInfluence ? 'text-amber-500' : 'text-gray-400'}" />
                <span>{review.experience_details.beerInfluence ? 'Beer influenced' : 'Sober rating'}</span>
              </div>
            {/if}
            {#if review.experience_details.isTakeout !== null}
              <div class="flex items-center">
                <Icon icon={review.experience_details.isTakeout ? faTruck : faUtensils} class="mr-2" />
                <span>{review.experience_details.isTakeout ? 'Takeout' : 'Dine-in'}</span>
              </div>
            {/if}
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {#if review.experience_details.moodComparison !== null}
              <div class="text-gray-600 dark:text-gray-300">Ho: {review.experience_details.moodComparison}/10</div>
            {/if}
            {#if review.experience_details.wingsPerOrder !== null}
              <div class="text-gray-600 dark:text-gray-300">Wings Per Order: {review.experience_details.wingsPerOrder}</div>
            {/if}
            {#if review.experience_details.wingSize !== null}
              <div class="text-gray-600 dark:text-gray-300">Wing Size: {review.experience_details.wingSize}/10</div>
            {/if}
            {#if review.experience_details.wingFormat}
              <div class="text-gray-600 dark:text-gray-300">Format: {review.experience_details.wingFormat}</div>
            {/if}
            {#if review.experience_details.isTakeout && review.experience_details.takeoutContainer}
              <div class="text-gray-600 dark:text-gray-300">Container: {review.experience_details.takeoutContainer}</div>
            {/if}
            {#if review.experience_details.isTakeout && review.experience_details.takeoutWaitTime !== null}
              <div class="text-gray-600 dark:text-gray-300">Wait Time: {review.experience_details.takeoutWaitTime}min</div>
            {/if}
          </div>
        </div>
      </div>
    {/if}

    <!-- Sauce Details Section -->
    {#if !isOldReview && review.sauce_details}
      <div class="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow">
        <h3 class="text-lg sm:text-xl font-semibold mb-4 text-gray-700 dark:text-gray-200">
          Sauce Details
        </h3>
        <div class="space-y-3">
          {#if review.sauce_details.sauceAvailability !== null}
            <div class="text-gray-600 dark:text-gray-300">
              Sauce Options Available: {review.sauce_details.sauceAvailability ? 'Yes' : 'No'}
            </div>
          {/if}
          {#if review.sauce_details.selectedSauces.length > 0}
            <div class="text-gray-600 dark:text-gray-300">
              Sauces: {review.sauce_details.selectedSauces.join(', ')}
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Ratings Section -->
    {#if !isOldReview && review.ratings}
      <div class="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow">
        <h3 class="text-lg sm:text-xl font-semibold mb-4 text-gray-700 dark:text-gray-200">
          Detailed Ratings
        </h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {#if review.ratings.appearance !== null}
            <div class="text-gray-600 dark:text-gray-300">Appearance: {formatRating(review.ratings.appearance)}</div>
          {/if}
          {#if review.ratings.aroma !== null}
            <div class="text-gray-600 dark:text-gray-300">Aroma: {formatRating(review.ratings.aroma)}</div>
          {/if}
          {#if review.ratings.sauceQuantity !== null}
            <div class="text-gray-600 dark:text-gray-300">Sauce Quantity: {formatRating(review.ratings.sauceQuantity)}</div>
          {/if}
          {#if review.ratings.sauceConsistency !== null}
            <div class="text-gray-600 dark:text-gray-300">Sauce Consistency: {formatRating(review.ratings.sauceConsistency)}</div>
          {/if}
          {#if review.ratings.sauceHeat !== null}
            <div class="text-gray-600 dark:text-gray-300">Sauce Heat: {formatRating(review.ratings.sauceHeat)}</div>
          {/if}
          {#if review.ratings.skinConsistency !== null}
            <div class="text-gray-600 dark:text-gray-300">Skin Consistency: {formatRating(review.ratings.skinConsistency)}</div>
          {/if}
          {#if review.ratings.meatQuality !== null}
            <div class="text-gray-600 dark:text-gray-300">Meat Quality: {formatRating(review.ratings.meatQuality)}</div>
          {/if}
          {#if review.ratings.greasiness !== null}
            <div class="text-gray-600 dark:text-gray-300">Greasiness: {formatRating(review.ratings.greasiness)}</div>
          {/if}
          {#if !review.ratings.blueCheeseNA && review.ratings.blueCheeseQuality !== null}
            <div class="text-gray-600 dark:text-gray-300">Blue Cheese: {formatRating(review.ratings.blueCheeseQuality)}</div>
          {/if}
          {#if review.ratings.satisfactionScore !== null}
            <div class="text-gray-600 dark:text-gray-300">Satisfaction: {formatRating(review.ratings.satisfactionScore)}</div>
          {/if}
          {#if review.ratings.recommendationScore !== null}
            <div class="text-gray-600 dark:text-gray-300">Recommendation: {formatRating(review.ratings.recommendationScore)}</div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Review Text Section -->
    <div class="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow">
      <h3 class="text-lg sm:text-xl font-semibold mb-3 text-gray-700 dark:text-gray-200">
        Review
      </h3>
      <p class="text-gray-600 dark:text-gray-300 leading-relaxed text-base sm:text-lg 
                whitespace-pre-wrap break-words">
        {review.review}
      </p>
    </div>

    {#if review.website_url}
      <div class="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow">
        <a href={review.website_url} 
           target="_blank" 
           rel="noopener noreferrer" 
           class="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 
                  transition-colors text-base sm:text-lg flex items-center">
          Visit Website
          <span class="ml-2">→</span>
        </a>
      </div>
    {/if}
  </div>
</div>
