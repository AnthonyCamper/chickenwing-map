<script lang="ts">
  import { geocode } from '$lib/geocoding';

  export let restaurantName: string;
  export let address: string;
  export let dateVisited: string;
  export let websiteUrl: string;
  export let coordinates: { latitude: number; longitude: number } | null;
  export let error: string;

  let verifyingAddress = false;

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

  $: mapUrl = coordinates 
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${coordinates.longitude-0.01},${coordinates.latitude-0.01},${coordinates.longitude+0.01},${coordinates.latitude+0.01}&marker=${coordinates.latitude},${coordinates.longitude}`
    : '';
</script>

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
        required
        class="w-full p-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
      />
    </div>

    <div>
      <label for="dateVisited" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Date Visited
      </label>
      <input
        type="date"
        id="dateVisited"
        bind:value={dateVisited}
        class="w-full p-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
      />
    </div>
  </div>

  <div class="space-y-2">
    <div class="flex items-end gap-4">
      <div class="flex-grow">
        <label for="address" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Address *
        </label>
        <input
          type="text"
          id="address"
          bind:value={address}
          required
          class="w-full p-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>
      <button
        type="button"
        on:click={verifyAddress}
        disabled={!address || verifyingAddress}
        class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {verifyingAddress ? 'Verifying...' : 'Verify Address'}
      </button>
    </div>

    {#if coordinates}
      <div class="h-48 border rounded-md overflow-hidden">
        <iframe
          title="Location Map"
          width="100%"
          height="100%"
          frameborder="0"
          scrolling="no"
          marginheight="0"
          marginwidth="0"
          src={mapUrl}
        ></iframe>
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
