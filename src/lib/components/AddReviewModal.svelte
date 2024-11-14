<script lang="ts">
  import { fly } from 'svelte/transition';
  import { faTimes } from '@fortawesome/free-solid-svg-icons';
  import Icon from 'svelte-fa';
  import { supabase } from '$lib/supabase';
  import { geocode } from '$lib/geocoding';

  export let show = false;
  export let onClose: () => void;
  export let onReviewAdded: () => void;

  let restaurantName = '';
  let address = '';
  let rating = 5;
  let reviewNotes = '';
  let error = '';
  let loading = false;

  // List of authorized email addresses
  const authorizedEmails = [
    'anthonycap949@gmail.com'
    // Add other authorized emails here
  ];

  async function handleSubmit() {
    try {
      loading = true;
      error = '';

      // Validate inputs
      if (!restaurantName || !address || !reviewNotes) {
        error = 'Please fill in all fields';
        return;
      }

      if (rating < 1 || rating > 10) {
        error = 'Rating must be between 1 and 10';
        return;
      }

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        error = 'You must be signed in to add a review';
        return;
      }

      // Check if user is authorized
      if (!authorizedEmails.includes(user.email || '')) {
        error = 'You are not authorized to add reviews';
        return;
      }

      // Get coordinates from address
      const location = await geocode(address);
      if (!location) {
        error = 'Could not find coordinates for this address';
        return;
      }

      // Insert review
      const { error: insertError } = await supabase
        .from('wing_ratings')
        .insert([{
          restaurant_name: restaurantName,
          address: address,
          rating: rating,
          review: reviewNotes,
          date_visited: new Date().toISOString(),
          latitude: location.latitude,
          longitude: location.longitude,
          user_id: user.id
        }]);

      if (insertError) throw insertError;

      // Clear form and close modal
      restaurantName = '';
      address = '';
      rating = 5;
      reviewNotes = '';
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
</script>

{#if show}
  <div class="fixed inset-0 bg-black bg-opacity-50 z-[3000] flex items-center justify-center p-4">
    <div 
      transition:fly={{ y: 20, duration: 300 }}
      class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6"
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

      <form on:submit|preventDefault={handleSubmit} class="space-y-4">
        {#if error}
          <p class="text-red-600 dark:text-red-400 text-center">
            {error}
          </p>
        {/if}

        <div>
          <label for="restaurantName" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Restaurant Name
          </label>
          <input
            type="text"
            id="restaurantName"
            bind:value={restaurantName}
            class="w-full p-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="Enter restaurant name"
          />
        </div>

        <div>
          <label for="address" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Address
          </label>
          <input
            type="text"
            id="address"
            bind:value={address}
            class="w-full p-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="Enter full address"
          />
        </div>

        <div>
          <label for="rating" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Rating (1-10)
          </label>
          <input
            type="number"
            id="rating"
            bind:value={rating}
            min="1"
            max="10"
            class="w-full p-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label for="reviewNotes" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Review Notes
          </label>
          <textarea
            id="reviewNotes"
            bind:value={reviewNotes}
            rows="4"
            class="w-full p-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="Enter your review"
          ></textarea>
        </div>

        <button
          type="submit"
          disabled={loading}
          class="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Adding Review...' : 'Add Review'}
        </button>
      </form>
    </div>
  </div>
{/if}
