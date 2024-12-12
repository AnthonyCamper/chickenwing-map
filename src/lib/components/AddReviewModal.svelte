<script lang="ts">
  import { fly } from 'svelte/transition';
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

      // Validate inputs
      if (!restaurantName || !address || !coordinates) {
        error = 'Please fill in all required fields and verify the address';
        return;
      }

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        error = 'You must be signed in to add a review';
        return;
      }

      // Check if user is authorized
      const { data: authorizedUser, error: authError } = await supabase
        .from('authorized_users')
        .select('user_id')
        .eq('user_id', user.id)
        .single();

      if (authError || !authorizedUser) {
        error = 'You are not authorized to add reviews';
        return;
      }

      // First, check if location exists
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
        // Insert new location
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

      // Insert review with all new fields
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

      // Clear form and close modal
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

  function formatScaleLabel(value: number, min: number, max: number, labels: string[]): string {
    const range = max - min;
    const step = range / (labels.length - 1);
    const index = Math.round((value - min) / step);
    return labels[index];
  }
</script>

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
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="restaurantName" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Restaurant Name *
              </label>
              <input
                type="text"
                id="restaurantName"
                bind:value={restaurantName}
                class="w-full p-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Enter restaurant name"
                required
              />
            </div>

            <div>
              <label for="dateVisited" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date Visited *
              </label>
              <input
                type="date"
                id="dateVisited"
                bind:value={dateVisited}
                class="w-full p-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>
          </div>

          <div>
            <label for="address" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Address *
            </label>
            <div class="flex gap-2">
              <input
                type="text"
                id="address"
                bind:value={address}
                class="flex-1 p-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Enter full address"
                required
              />
              <button
                type="button"
                on:click={verifyAddress}
                disabled={verifyingAddress || !address}
                class="px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md border border-gray-300 dark:border-gray-600 disabled:opacity-50"
              >
                {verifyingAddress ? 'Verifying...' : 'Verify'}
              </button>
            </div>
            {#if coordinates}
              <div class="mt-2">
                <div class="text-sm text-green-600 dark:text-green-400 mb-2">
                  ✓ Coordinates verified: {coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}
                </div>
                <div class="relative w-full h-48 border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden">
                  <iframe
                    title="Location Map"
                    width="100%"
                    height="100%"
                    frameborder="0"
                    scrolling="no"
                    marginheight="0"
                    marginwidth="0"
                    src={mapUrl}
                    style="border: none"
                  ></iframe>
                </div>
              </div>
            {/if}
          </div>

          <div>
            <label for="websiteUrl" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Website URL
            </label>
            <input
              type="url"
              id="websiteUrl"
              bind:value={websiteUrl}
              class="w-full p-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="https://example.com"
            />
          </div>
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

        <!-- Ratings Section -->
        <div class="space-y-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white border-b pb-2">Detailed Ratings</h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Visual and Aroma -->
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Appearance (1-10)
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  bind:value={appearance}
                  class="w-full"
                />
                <div class="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                  <span>Poor</span>
                  <span>Excellent</span>
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Aroma (1-10)
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  bind:value={aroma}
                  class="w-full"
                />
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
                <input
                  type="range"
                  min="1"
                  max="10"
                  bind:value={sauceQuantity}
                  class="w-full"
                />
                <div class="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                  <span>Poor</span>
                  <span>Excellent</span>
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Sauce Consistency (1-10)
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  bind:value={sauceConsistency}
                  class="w-full"
                />
                <div class="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                  <span>Poor</span>
                  <span>Excellent</span>
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Sauce Heat (1-10)
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  bind:value={sauceHeat}
                  class="w-full"
                />
                <div class="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                  <span>No Heat</span>
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
                <input
                  type="range"
                  min="1"
                  max="10"
                  bind:value={skinConsistency}
                  class="w-full"
                />
                <div class="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                  <span>Poor</span>
                  <span>Excellent</span>
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Meat Quality (1-10)
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  bind:value={meatQuality}
                  class="w-full"
                />
                <div class="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                  <span>Poor</span>
                  <span>Excellent</span>
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Greasiness (1-5)
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  bind:value={greasiness}
                  class="w-full"
                />
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
                <input
                  type="range"
                  min="1"
                  max="10"
                  bind:value={blueCheeseQuality}
                  disabled={blueCheeseNA}
                  class="w-full"
                />
                <div class="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                  <span>Poor</span>
                  <span>Excellent</span>
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Satisfaction (1-5)
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  bind:value={satisfactionScore}
                  class="w-full"
                />
                <div class="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                  <span>Very Dissatisfied</span>
                  <span>Very Satisfied</span>
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Recommendation Score (0-10)
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  bind:value={recommendationScore}
                  class="w-full"
                />
                <div class="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                  <span>Would Not Recommend</span>
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

        <button
          type="submit"
          disabled={loading || !coordinates}
          class="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Adding Review...' : 'Add Review'}
        </button>
      </form>
    </div>
  </div>
{/if}
