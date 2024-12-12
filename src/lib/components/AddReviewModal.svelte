<script lang="ts">
  import { fly, scale } from 'svelte/transition';
  import { elasticOut } from 'svelte/easing';
  import { faTimes } from '@fortawesome/free-solid-svg-icons';
  import Icon from 'svelte-fa';
  import { supabase } from '$lib/supabase';
  import { geocode } from '$lib/geocoding';

  export let show = false;
  export let onClose: () => void;
  export let onReviewAdded: () => void;

  // Basic Information
  let restaurantName = '';
  let address = '';
  let dateVisited = new Date().toISOString().split('T')[0];
  let websiteUrl = '';

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
  const sauceOptions = [
    'Classic Buffalo (Medium)', 'Hot Buffalo', 'Mild Buffalo', 'BBQ', 'Garlic Parmesan',
    'Honey BBQ', 'Spicy BBQ', 'Lemon Pepper', 'Teriyaki', 'Sweet Chili',
    'Mango Habanero', 'Nashville Hot', 'Cajun Dry Rub', 'Korean BBQ', 'Ghost Pepper',
    'Honey Mustard', 'Caribbean Jerk', 'Chipotle BBQ', 'Thai Curry', 'Bourbon',
    'Ranch Dry Rub', 'Buffalo Ranch', 'Sriracha', 'Old Bay', 'Garlic Buffalo',
    'Honey Garlic', 'Salt & Vinegar', 'Memphis Dry Rub', 'Sweet & Sour', 'Carolina Gold BBQ'
  ];

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
  let error = '';
  let loading = false;
  let coordinates: { latitude: number; longitude: number } | null = null;
  let verifyingAddress = false;
  let reviewNotes = '';

  // Add rating scale descriptions with proper typing
  interface RatingDescription {
    [key: number]: string;
  }

  interface RatingDescriptions {
    appearance: RatingDescription;
    sauceHeat: RatingDescription;
    meatQuality: RatingDescription;
    recommendationScore: RatingDescription;
  }

  const ratingDescriptions: RatingDescriptions = {
    appearance: {
      1: "Visually unappealing",
      3: "Below average presentation",
      5: "Average appearance",
      7: "Appetizing presentation",
      10: "Instagram-worthy perfection"
    },
    sauceHeat: {
      1: "No heat at all",
      3: "Mild tingle",
      5: "Pleasantly spicy",
      7: "Getting serious",
      10: "Call the fire department! 🔥"
    },
    meatQuality: {
      1: "Tough and chewy",
      3: "Below average",
      5: "Decent quality",
      7: "Tender and juicy",
      10: "Melt-in-your-mouth perfect"
    },
    recommendationScore: {
      0: "Never again",
      3: "Only if desperate",
      5: "It's okay",
      7: "Would return",
      10: "Life-changing wings!"
    }
  };

  // Function to get rating description with proper typing
  function getRatingDescription(category: keyof RatingDescriptions, value: number): string {
    const descriptions = ratingDescriptions[category];
    const scores = Object.keys(descriptions).map(Number).sort((a, b) => a - b);
    const nearestScore = scores.reduce((prev, curr) => 
      Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
    );
    return descriptions[nearestScore];
  }

  // Add animation feedback for interactions
  let lastChanged = '';
  function handleRatingChange(field: string) {
    lastChanged = field;
    setTimeout(() => {
      if (lastChanged === field) {
        lastChanged = '';
      }
    }, 1000);
  }

  // Keep all existing functions
  async function verifyAddress() {
    try {
      verifyingAddress = true;
      error = '';
      coordinates = null;

      if (!address) {
        error = 'Please enter an address';
        return;
      }

      coordinates = await geocode(address);
      if (!coordinates) {
        error = 'Could not find coordinates for this address';
      }
    } catch (err) {
      error = 'Error verifying address';
      coordinates = null;
    } finally {
      verifyingAddress = false;
    }
  }

  function handleSauceSelection(sauce: string, checked: boolean) {
    if (checked) {
      selectedSauces = [...selectedSauces, sauce];
    } else {
      selectedSauces = selectedSauces.filter(s => s !== sauce);
    }
  }

  function handleSauceChange(event: Event, sauce: string) {
    if (event.target instanceof HTMLInputElement) {
      handleSauceSelection(sauce, event.target.checked);
    }
  }

  async function handleSubmit() {
    try {
      loading = true;
      error = '';

      if (!restaurantName || !address || !coordinates) {
        error = 'Please fill in all required fields and verify the address';
        return;
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        error = 'You must be signed in to add a review';
        return;
      }

      const { data: authorizedUser, error: authError } = await supabase
        .from('authorized_users')
        .select('user_id')
        .eq('user_id', user.id)
        .single();

      if (authError || !authorizedUser) {
        error = 'You are not authorized to add reviews';
        return;
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
            longitude: coordinates.longitude,
            website_url: websiteUrl
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
          review_notes: reviewNotes,
          date_visited: dateVisited,
          mood_comparison: moodComparison,
          beer_influence: beerInfluence ? 1 : 0,
          is_takeout: isTakeout ? 1 : 0,
          wing_format: wingFormat,
          wings_per_order: wingsPerOrder,
          wing_size: wingSize,
          sauce_availability: sauceAvailability ? 1 : 0,
          sauce_selection: selectedSauces,
          appearance: appearance,
          aroma: aroma,
          sauce_quantity: sauceQuantity,
          sauce_consistency: sauceConsistency,
          sauce_heat: sauceHeat,
          skin_consistency: skinConsistency,
          meat_quality: meatQuality,
          greasiness: greasiness,
          blue_cheese_quality: blueCheeseNA ? null : blueCheeseQuality,
          satisfaction_score: satisfactionScore,
          recommendation_score: recommendationScore,
          takeout_container: isTakeout ? takeoutContainer : null,
          takeout_wait_time: isTakeout ? takeoutWaitTime : null
        }]);

      if (insertReviewError) throw insertReviewError;

      // Clear form
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

      onReviewAdded();
      onClose();
    } catch (err) {
      if (err instanceof Error) {
        error = err.message;
      } else {
        error = 'An error occurred while adding the review';
      }
    } finally {
      loading = false;
    }
  }

  $: mapUrl = coordinates 
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${coordinates.longitude-0.01},${coordinates.latitude-0.01},${coordinates.longitude+0.01},${coordinates.latitude+0.01}&marker=${coordinates.latitude},${coordinates.longitude}`
    : '';

    function formatSliderValue(value: number, prefix: string = ''): string {
    return `${prefix}${value}`;
  }

</script>

<style>
  /* Previous styles remain the same */

  /* Add styles for value display */
  .slider-value {
    position: absolute;
    right: 0;
    top: 0;
    font-size: 0.875rem;
    color: #3b82f6;
    font-weight: 500;
  }

  /* Ensure consistent slider styling */
  .slider-container {
    position: relative;
    padding-right: 2.5rem;
  }

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

  /* Custom range slider styling */
  input[type="range"] {
    -webkit-appearance: none;
    height: 8px;
    border-radius: 4px;
    background: #e5e7eb;
  }

  .dark input[type="range"] {
    background: #374151;
  }

  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #3b82f6;
    cursor: pointer;
    border: 2px solid #fff;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
    transition: all 0.2s ease;
  }

  input[type="range"]::-webkit-slider-thumb:hover {
    transform: scale(1.1);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.5);
  }

  /* Animated feedback */
  .rating-changed {
    animation: pulse 1s ease-out;
  }

  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
  }

  /* Mobile optimizations */
  @media (max-width: 640px) {
    input[type="range"]::-webkit-slider-thumb {
      width: 28px;
      height: 28px;
    }
  }


  /* Rest of styles remain the same */
</style>

<!-- Previous content remains the same until the ratings section -->
{#if show}
  <div class="fixed inset-0 bg-black bg-opacity-50 z-[3000] flex items-center justify-center p-4">
    <div 
      transition:fly={{ y: 20, duration: 300 }}
      class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6"
    >
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">Add New Review</h2>
        <button 
          on:click={onClose}
          class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
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

        <!-- Basic Information Section -->
        <div class="space-y-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white border-b pb-2">Basic Information</h3>
          
          <!-- ... (keeping the entire Basic Information section as is) ... -->
        </div>

        <!-- Experience Details Section -->
        <div class="space-y-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white border-b pb-2">Experience Details</h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Mood Comparison
              </label>
              <input
                type="range"
                min="-2"
                max="2"
                step="1"
                bind:value={moodComparison}
                class="w-full"
              />
              <div class="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                <span>Much worse</span>
                <span>Average</span>
                <span>Much better</span>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Additional Factors
              </label>
              <div class="space-y-2">
                <label class="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    bind:checked={beerInfluence}
                    class="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span class="text-sm text-gray-700 dark:text-gray-300">Beer Influence</span>
                </label>
                <label class="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    bind:checked={isTakeout}
                    class="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span class="text-sm text-gray-700 dark:text-gray-300">Takeout Order</span>
                </label>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label for="wingFormat" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Wing Format
              </label>
              <select
                id="wingFormat"
                bind:value={wingFormat}
                class="w-full p-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="Fried">Fried</option>
                <option value="Smoked">Smoked</option>
                <option value="Smoked then Fried">Smoked then Fried</option>
                <option value="Grilled">Grilled</option>
              </select>
            </div>

            <div>
              <label for="wingsPerOrder" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Wings Per Order
              </label>
              <input
                type="number"
                id="wingsPerOrder"
                bind:value={wingsPerOrder}
                min="1"
                step="1"
                class="w-full p-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label for="wingSize" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Wing Size
              </label>
              <select
                id="wingSize"
                bind:value={wingSize}
                class="w-full p-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="1">Small</option>
                <option value="2">Medium</option>
                <option value="3">Large</option>
              </select>
            </div>
          </div>

          {#if isTakeout}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="takeoutContainer" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Takeout Container
                </label>
                <select
                  id="takeoutContainer"
                  bind:value={takeoutContainer}
                  class="w-full p-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="Styrofoam">Styrofoam</option>
                  <option value="Cardboard">Cardboard</option>
                  <option value="Plastic">Plastic</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label for="takeoutWaitTime" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Wait Time (minutes)
                </label>
                <input
                  type="number"
                  id="takeoutWaitTime"
                  bind:value={takeoutWaitTime}
                  min="0"
                  step="1"
                  class="w-full p-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          {/if}
        </div>

        <!-- Sauce Section -->
        <div class="space-y-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white border-b pb-2">Sauce Details</h3>
          
          <div>
            <label class="flex items-center space-x-2 mb-4">
              <input
                type="checkbox"
                bind:checked={sauceAvailability}
                class="rounded border-gray-300 dark:border-gray-600"
              />
              <span class="text-sm text-gray-700 dark:text-gray-300">Sauce Available</span>
            </label>

            {#if sauceAvailability}
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Sauce Selection (Select all that apply)
              </label>
              <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {#each sauceOptions as sauce}
                  <label class="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={selectedSauces.includes(sauce)}
                      on:change={(e) => handleSauceChange(e, sauce)}
                      class="rounded border-gray-300 dark:border-gray-600"
                    />
                    <span class="text-sm text-gray-700 dark:text-gray-300">{sauce}</span>
                  </label>
                {/each}
              </div>
            {/if}
          </div>
        </div>
<!-- Modified Ratings Section -->
<div class="space-y-4">
  <h3 class="text-lg font-semibold text-gray-900 dark:text-white border-b pb-2">Detailed Ratings</h3>
  
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    <!-- Visual and Aroma -->
    <div class="space-y-4">
      <div class={lastChanged === 'appearance' ? 'rating-changed' : ''}>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Appearance (1-10)
        </label>
        <div class="slider-container">
          <span class="slider-value">{formatSliderValue(appearance)}</span>
          <input
            type="range"
            min="1"
            max="10"
            bind:value={appearance}
            on:input={() => handleRatingChange('appearance')}
            class="w-full"
          />
        </div>
        <div class="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-1">
          <span>Poor</span>
          <span class="text-blue-500 font-medium">
            {getRatingDescription('appearance', appearance)}
          </span>
          <span>Excellent</span>
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Aroma (1-10)
        </label>
        <div class="slider-container">
          <span class="slider-value">{formatSliderValue(aroma)}</span>
          <input
            type="range"
            min="1"
            max="10"
            bind:value={aroma}
            class="w-full"
          />
        </div>
        <div class="flex justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>Poor</span>
          <span>Excellent</span>
        </div>
      </div>
    </div>

    <!-- Sauce Ratings -->
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Sauce Quantity (1-10)
        </label>
        <div class="slider-container">
          <span class="slider-value">{formatSliderValue(sauceQuantity)}</span>
          <input
            type="range"
            min="1"
            max="10"
            bind:value={sauceQuantity}
            class="w-full"
          />
        </div>
        <div class="flex justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>Poor</span>
          <span>Excellent</span>
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Sauce Consistency (1-10)
        </label>
        <div class="slider-container">
          <span class="slider-value">{formatSliderValue(sauceConsistency)}</span>
          <input
            type="range"
            min="1"
            max="10"
            bind:value={sauceConsistency}
            class="w-full"
          />
        </div>
        <div class="flex justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>Poor</span>
          <span>Excellent</span>
        </div>
      </div>

      <div class={lastChanged === 'sauceHeat' ? 'rating-changed' : ''}>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Sauce Heat (1-10)
        </label>
        <div class="slider-container">
          <span class="slider-value">{formatSliderValue(sauceHeat)}</span>
          <input
            type="range"
            min="1"
            max="10"
            bind:value={sauceHeat}
            on:input={() => handleRatingChange('sauceHeat')}
            class="w-full"
          />
        </div>
        <div class="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-1">
          <span>No Heat</span>
          <span class="text-blue-500 font-medium">
            {getRatingDescription('sauceHeat', sauceHeat)}
          </span>
          <span>Extreme</span>
        </div>
      </div>
    </div>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    <!-- Texture Ratings -->
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Skin Consistency (1-10)
        </label>
        <div class="slider-container">
          <span class="slider-value">{formatSliderValue(skinConsistency)}</span>
          <input
            type="range"
            min="1"
            max="10"
            bind:value={skinConsistency}
            class="w-full"
          />
        </div>
        <div class="flex justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>Poor</span>
          <span>Excellent</span>
        </div>
      </div>

      <div class={lastChanged === 'meatQuality' ? 'rating-changed' : ''}>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Meat Quality (1-10)
        </label>
        <div class="slider-container">
          <span class="slider-value">{formatSliderValue(meatQuality)}</span>
          <input
            type="range"
            min="1"
            max="10"
            bind:value={meatQuality}
            on:input={() => handleRatingChange('meatQuality')}
            class="w-full"
          />
        </div>
        <div class="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-1">
          <span>Poor</span>
          <span class="text-blue-500 font-medium">
            {getRatingDescription('meatQuality', meatQuality)}
          </span>
          <span>Excellent</span>
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Greasiness (1-5)
        </label>
        <div class="slider-container">
          <span class="slider-value">{formatSliderValue(greasiness)}</span>
          <input
            type="range"
            min="1"
            max="5"
            bind:value={greasiness}
            class="w-full"
          />
        </div>
        <div class="flex justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>Not Greasy</span>
          <span>Very Greasy</span>
        </div>
      </div>
    </div>

    <!-- Overall Ratings -->
    <div class="space-y-4">
      <div>
        <div class="flex items-center justify-between mb-1">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Blue Cheese Quality (1-10)
          </label>
          <label class="flex items-center space-x-2">
            <input
              type="checkbox"
              bind:checked={blueCheeseNA}
              class="rounded border-gray-300 dark:border-gray-600"
            />
            <span class="text-sm text-gray-700 dark:text-gray-300">N/A</span>
          </label>
        </div>
        <div class="slider-container">
          <span class="slider-value">{!blueCheeseNA ? formatSliderValue(blueCheeseQuality) : 'N/A'}</span>
          <input
            type="range"
            min="1"
            max="10"
            bind:value={blueCheeseQuality}
            disabled={blueCheeseNA}
            class="w-full"
          />
        </div>
        <div class="flex justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>Poor</span>
          <span>Excellent</span>
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Satisfaction (1-5)
        </label>
        <div class="slider-container">
          <span class="slider-value">{formatSliderValue(satisfactionScore)}</span>
          <input
            type="range"
            min="1"
            max="5"
            bind:value={satisfactionScore}
            class="w-full"
          />
        </div>
        <div class="flex justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>Very Dissatisfied</span>
          <span>Very Satisfied</span>
        </div>
      </div>

      <div class={lastChanged === 'recommendationScore' ? 'rating-changed' : ''}>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Recommendation Score (0-10)
        </label>
        <div class="slider-container">
          <span class="slider-value">{formatSliderValue(recommendationScore)}</span>
          <input
            type="range"
            min="0"
            max="10"
            bind:value={recommendationScore}
            on:input={() => handleRatingChange('recommendationScore')}
            class="w-full"
          />
        </div>
        <div class="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-1">
          <span>Would Not Recommend</span>
          <span class="text-blue-500 font-medium">
            {getRatingDescription('recommendationScore', recommendationScore)}
          </span>
          <span>Strongly Recommend</span>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Additional Notes -->
<div>
  <label for="reviewNotes" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
    Additional Notes
  </label>
  <textarea
    id="reviewNotes"
    bind:value={reviewNotes}
    rows="4"
    class="w-full p-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
    placeholder="Enter any additional notes about your experience"
  ></textarea>
</div>

<!-- Enhanced Submit Button -->
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

