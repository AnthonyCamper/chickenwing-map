<script lang="ts">
  export let moodComparison: number;
  export let beerInfluence: boolean;
  export let isTakeout: boolean;
  export let wingsPerOrder: number;
  export let wingSize: number;
  export let wingFormat: string;
  export let takeoutContainer: string;
  export let takeoutWaitTime: number;
</script>

<div class="space-y-4">
  <h3 class="text-lg font-semibold text-gray-900 dark:text-white border-b pb-2">Experience Details</h3>
  
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        How is your mood?
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
