<script lang="ts">
  import { faStar, faThumbsUp, faThumbsDown, faBeer, faTruck, faUtensils } from '@fortawesome/free-solid-svg-icons';
  import Icon from 'svelte-fa';
  import type { Review } from './types';

  export let review: Review;
  export let isSelected: boolean = false;

  function truncateText(text: string, maxLength: number) {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  }

  function formatRating(value: number | null): string {
    return value === null ? 'N/A' : `${value}/10`;
  }

  const isOldReview = !review.experience_details && !review.sauce_details && !review.ratings;
</script>

<button
  class="w-full text-left p-4 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors 
         border-b border-gray-200 dark:border-gray-700 
         {isSelected ? 'bg-blue-50 dark:bg-gray-800' : ''}
         min-h-[44px] touch-manipulation"
  on:click
>
  <div class="flex justify-between items-start mb-3">
    <div class="flex items-center">
      <Icon icon={faStar} class="text-yellow-400 mr-2 text-lg" />
      <span class="font-semibold dark:text-white text-base">{review.rating}/10</span>
    </div>
    <span class="text-sm text-gray-500 dark:text-gray-400">
      {new Date(review.date_visited).toLocaleDateString()}
    </span>
  </div>
  
  <div class="flex justify-between items-center mb-3">
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

  {#if isOldReview}
    <div class="text-sm text-gray-500 dark:text-gray-400 mb-3 italic">
      This is a classic review from before we tracked detailed stats
    </div>
  {:else}
    {#if review.experience_details}
      <div class="mb-4 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
        <div class="flex flex-wrap gap-3 mb-2">
          {#if review.experience_details.beerInfluence !== null}
            <div class="flex items-center text-sm">
              <Icon icon={faBeer} class="mr-1 {review.experience_details.beerInfluence ? 'text-amber-500' : 'text-gray-400'}" />
              <span>{review.experience_details.beerInfluence ? 'Beer influenced' : 'Sober rating'}</span>
            </div>
          {/if}
          {#if review.experience_details.isTakeout !== null}
            <div class="flex items-center text-sm">
              <Icon icon={review.experience_details.isTakeout ? faTruck : faUtensils} class="mr-1" />
              <span>{review.experience_details.isTakeout ? 'Takeout' : 'Dine-in'}</span>
            </div>
          {/if}
        </div>
        <div class="grid grid-cols-2 gap-2 text-sm">
          {#if review.experience_details.moodComparison !== null}
            <div>Mood: {review.experience_details.moodComparison}/10</div>
          {/if}
          {#if review.experience_details.wingsPerOrder !== null}
            <div>Wings Per Order: {review.experience_details.wingsPerOrder}</div>
          {/if}
          {#if review.experience_details.wingSize !== null}
            <div>Wing Size: {review.experience_details.wingSize}/10</div>
          {/if}
          {#if review.experience_details.wingFormat}
            <div>Format: {review.experience_details.wingFormat}</div>
          {/if}
          {#if review.experience_details.isTakeout && review.experience_details.takeoutContainer}
            <div>Container: {review.experience_details.takeoutContainer}</div>
          {/if}
          {#if review.experience_details.isTakeout && review.experience_details.takeoutWaitTime !== null}
            <div>Wait Time: {review.experience_details.takeoutWaitTime}min</div>
          {/if}
        </div>
      </div>
    {/if}

    {#if review.sauce_details}
      <div class="mb-4 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
        <h4 class="text-sm font-semibold mb-2 dark:text-gray-300">Sauce Details</h4>
        <div class="text-sm">
          {#if review.sauce_details.sauceAvailability !== null}
            <div>Sauce Options Available: {review.sauce_details.sauceAvailability ? 'Yes' : 'No'}</div>
          {/if}
          {#if review.sauce_details.selectedSauces.length > 0}
            <div>Sauces: {review.sauce_details.selectedSauces.join(', ')}</div>
          {/if}
        </div>
      </div>
    {/if}

    {#if review.ratings}
      <div class="mb-4 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
        <h4 class="text-sm font-semibold mb-2 dark:text-gray-300">Detailed Ratings</h4>
        <div class="grid grid-cols-2 gap-2 text-sm">
          {#if review.ratings.appearance !== null}
            <div>Appearance: {formatRating(review.ratings.appearance)}</div>
          {/if}
          {#if review.ratings.aroma !== null}
            <div>Aroma: {formatRating(review.ratings.aroma)}</div>
          {/if}
          {#if review.ratings.sauceQuantity !== null}
            <div>Sauce Quantity: {formatRating(review.ratings.sauceQuantity)}</div>
          {/if}
          {#if review.ratings.sauceConsistency !== null}
            <div>Sauce Consistency: {formatRating(review.ratings.sauceConsistency)}</div>
          {/if}
          {#if review.ratings.sauceHeat !== null}
            <div>Sauce Heat: {formatRating(review.ratings.sauceHeat)}</div>
          {/if}
          {#if review.ratings.skinConsistency !== null}
            <div>Skin Consistency: {formatRating(review.ratings.skinConsistency)}</div>
          {/if}
          {#if review.ratings.meatQuality !== null}
            <div>Meat Quality: {formatRating(review.ratings.meatQuality)}</div>
          {/if}
          {#if review.ratings.greasiness !== null}
            <div>Greasiness: {formatRating(review.ratings.greasiness)}</div>
          {/if}
          {#if !review.ratings.blueCheeseNA && review.ratings.blueCheeseQuality !== null}
            <div>Blue Cheese: {formatRating(review.ratings.blueCheeseQuality)}</div>
          {/if}
          {#if review.ratings.satisfactionScore !== null}
            <div>Satisfaction: {formatRating(review.ratings.satisfactionScore)}</div>
          {/if}
          {#if review.ratings.recommendationScore !== null}
            <div>Recommendation: {review.ratings.recommendationScore.toFixed(1)}/10</div>
          {/if}
        </div>
      </div>
    {/if}
  {/if}
  
  <p class="text-base text-gray-600 dark:text-gray-300 line-clamp-2">
    {truncateText(review.review, 100)}
  </p>

  {#if review.website_url}
    <div class="mt-2">
      <a href={review.website_url} 
         target="_blank" 
         rel="noopener noreferrer" 
         class="text-blue-500 hover:text-blue-600 text-sm">
        Visit Website →
      </a>
    </div>
  {/if}
</button>
