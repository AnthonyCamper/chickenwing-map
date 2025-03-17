<script lang="ts">
  import { fly } from 'svelte/transition';
  import { faTimes } from '@fortawesome/free-solid-svg-icons';
  import Icon from 'svelte-fa';
  import { supabase } from '$lib/supabase';
  import ReviewBasicInfo from './review/ReviewBasicInfo.svelte';
  import ReviewExperienceDetails from './review/ReviewExperienceDetails.svelte';
  import ReviewSauceDetails from './review/ReviewSauceDetails.svelte';
  import ReviewRatings from './review/ReviewRatings.svelte';
  import ReviewNotes from './review/ReviewNotes.svelte';
  import { onMount } from 'svelte';

  export let show = false;
  export let onClose: () => void;
  export let onReviewAdded: () => void;
  export let user: any = null;

  // Basic Information
  let restaurantName = '';
  let address = '';
  let dateVisited = new Date().toISOString().split('T')[0];
  let websiteUrl = '';
  let coordinates: { latitude: number; longitude: number } | null = null;
  let error = '';

  // Experience Details
  let moodComparison = 0;
  let beerInfluence = false;
  let isTakeout = false;
  let wingsPerOrder = 10;
  let wingSize = 2;
  let wingFormat = 'Fried';
  let takeoutContainer = 'Styrofoam';
  let takeoutWaitTime = 15;

  // Sauce Information
  let sauceAvailability = true;
  let selectedSauces: string[] = [];

  // Ratings
  let appearance = 5;
  let aroma = 5;
  let sauceQuantity = 5;
  let sauceConsistency = 5;
  let sauceHeat = 5;
  let skinConsistency = 5;
  let meatQuality = 5;
  let greasiness = 3;
  let blueCheeseQuality = 5;
  let blueCheeseNA = false;
  let satisfactionScore = 3;
  let recommendationScore = 7;

  // Form State
  let loading = false;
  let reviewNotes = '';

  // Add a timeout promise helper at the top of the script
  function timeout(ms: number) {
    return new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timed out')), ms)
    );
  }

  // Add at the top of the script section
  let hasUnsavedChanges = false;

  // Add a watch for any form field changes
  $: {
    if (restaurantName || address || reviewNotes || websiteUrl || coordinates) {
      hasUnsavedChanges = true;
    }
  }

  onMount(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  });

  // Update the handleSubmit function
  async function handleSubmit() {
    try {
      loading = true;
      error = '';

      if (!restaurantName || !address || !coordinates) {
        error = 'Please fill in all required fields and verify the address';
        loading = false; // Important: Reset loading state here
        return;
      }

      // Add timeout handling
      const result = await Promise.race([
        (async () => {
          const { data: { user }, error: userError } = await supabase.auth.getUser();
          
          if (userError || !user) {
            throw new Error('You must be signed in to add a review');
          }

          const { data: authorizedUser, error: authError } = await supabase
            .from('authorized_users')
            .select('user_id')
            .eq('user_id', user.id)
            .single();

          if (authError || !authorizedUser) {
            throw new Error('You are not authorized to add reviews');
          }

          const { data: existingLocation, error: locationError } = await supabase
            .from('locations')
            .select('id')
            .eq('restaurant_name', restaurantName)
            .eq('address', address)
            .single();

          if (locationError && locationError.code !== 'PGRST116') {
            throw locationError;
          }

          let locationId: number;

          if (!existingLocation) {
            const { data: newLocation, error: insertLocationError } = await supabase
              .from('locations')
              .insert([{
                restaurant_name: restaurantName,
                address: address,
                latitude: coordinates.latitude,
                longitude: coordinates.longitude
              }])
              .select('id')
              .single();

            if (insertLocationError) throw insertLocationError;
            if (!newLocation) throw new Error('Failed to create location');
            
            locationId = newLocation.id;
          } else {
            locationId = existingLocation.id;
          }

          const { error: insertReviewError } = await supabase
            .from('reviews')
            .insert([{
              location_id: locationId,
              user_id: user.id,
              review: reviewNotes,
              date_visited: dateVisited,
              website_url: websiteUrl,
              mood_comparison: moodComparison,
              beer_influence: beerInfluence ? 1 : 0,
              is_takeout: isTakeout ? 1 : 0,
              wing_format: wingFormat,
              wings_per_order: wingsPerOrder,
              wing_size: wingSize,
              sauce_availability: sauceAvailability ? 1 : 0,
              selected_sauces: selectedSauces,
              appearance_rating: appearance,
              aroma_rating: aroma,
              sauce_quantity_rating: sauceQuantity,
              sauce_consistency_rating: sauceConsistency,
              sauce_heat_rating: sauceHeat,
              skin_consistency_rating: skinConsistency,
              meat_quality_rating: meatQuality,
              greasiness_rating: greasiness,
              blue_cheese_quality_rating: blueCheeseNA ? null : blueCheeseQuality,
              satisfaction_score: satisfactionScore,
              recommendation_score: recommendationScore,
              takeout_container: isTakeout ? takeoutContainer : null,
              takeout_wait_time: isTakeout ? takeoutWaitTime : null
            }]);

          if (insertReviewError) throw insertReviewError;

          return true;
        })(),
        timeout(30000) // 30 second timeout
      ]);

      if (result) {
        // Clear form and close modal only if submission was successful
        clearForm();
        onReviewAdded();
        onClose();
      }

    } catch (err) {
      if (err instanceof Error) {
        error = err.message;
      } else {
        error = 'An error occurred while adding the review';
      }
      console.error('Review submission error:', err);
    } finally {
      loading = false;
    }
  }

  // Update clearForm to reset hasUnsavedChanges
  function clearForm() {
    hasUnsavedChanges = false;
    restaurantName = '';
    address = '';
    reviewNotes = '';
    dateVisited = new Date().toISOString().split('T')[0];
    coordinates = null;
    websiteUrl = '';
    moodComparison = 0;
    beerInfluence = false;
    isTakeout = false;
    wingsPerOrder = 10;
    wingSize = 2;
    wingFormat = 'Fried';
    sauceAvailability = true;
    selectedSauces = [];
    appearance = 5;
    aroma = 5;
    sauceQuantity = 5;
    sauceConsistency = 5;
    sauceHeat = 5;
    skinConsistency = 5;
    meatQuality = 5;
    greasiness = 3;
    blueCheeseQuality = 5;
    blueCheeseNA = false;
    satisfactionScore = 3;
    recommendationScore = 7;
    takeoutContainer = 'Styrofoam';
    takeoutWaitTime = 15;
  }
</script>

<style>
  /* Add smooth transitions */
  input[type="range"] {
    transition: all 0.2s ease;
  }
  input[type="range"]:hover {
    transform: scale(1.02);
  }
  input[type="range"]:active {
    transform: scale(0.98);
  }

  /* Mobile optimizations */
  @media (max-width: 640px) {
    input[type="range"]::-webkit-slider-thumb {
      width: 28px;
      height: 28px;
    }
  }

  .modal-container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999; /* High z-index to ensure modal is on top */
  }

  .modal-overlay {
    position: absolute;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.4);
  }

  .modal-content {
    position: relative;
    background-color: white;
    border-radius: 0.5rem;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    width: 95%;
    max-width: 600px;
    max-height: 90vh;
    overflow-y: auto;
    padding: 1.5rem;
  }

  :global(.dark) .modal-content {
    background-color: #1f2937;
    color: #f3f4f6;
  }
</style>

{#if show}
  <div
    class="modal-container"
    transition:fly={{ y: 20, duration: 300 }}
  >
    <div 
      class="modal-overlay" 
      on:click={() => onClose()}
      on:keydown={(e) => e.key === 'Enter' && onClose()}
      role="button"
      tabindex="0"
      aria-label="Close review form"
    ></div>
    <div class="modal-content">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Add Review</h2>
        <button
          class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-full"
          on:click={() => onClose()}
          aria-label="Close modal"
        >
          <Icon icon={faTimes} />
        </button>
      </div>

      <form on:submit|preventDefault={handleSubmit} class="space-y-8">
        {#if error}
          <p class="text-red-600 dark:text-red-400 text-center">
            {error}
          </p>
        {/if}

        <ReviewBasicInfo
          bind:restaurantName
          bind:address
          bind:dateVisited
          bind:websiteUrl
          bind:coordinates
          bind:error
        />

        <ReviewExperienceDetails
          bind:moodComparison
          bind:beerInfluence
          bind:isTakeout
          bind:wingsPerOrder
          bind:wingSize
          bind:wingFormat
          bind:takeoutContainer
          bind:takeoutWaitTime
        />

        <ReviewSauceDetails
          bind:sauceAvailability
          bind:selectedSauces
        />

        <ReviewRatings
          bind:appearance
          bind:aroma
          bind:sauceQuantity
          bind:sauceConsistency
          bind:sauceHeat
          bind:skinConsistency
          bind:meatQuality
          bind:greasiness
          bind:blueCheeseQuality
          bind:blueCheeseNA
          bind:satisfactionScore
          bind:recommendationScore
        />

        <ReviewNotes
          bind:reviewNotes
        />

        <button
          type="submit"
          disabled={loading || !coordinates}
          class="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium 
                disabled:opacity-50 disabled:cursor-not-allowed transform transition-transform 
                active:scale-95 hover:scale-[1.02] focus:outline-none focus:ring-2 
                focus:ring-blue-500 focus:ring-offset-2"
        >
          {#if loading}
            <span class="inline-block animate-spin mr-2">↻</span>
            Adding Review...
          {:else}
            Add Review
          {/if}
        </button>
      </form>
    </div>
  </div>
{/if}
