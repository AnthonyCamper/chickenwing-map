<script lang="ts">
  export let sauceAvailability: boolean;
  export let selectedSauces: string[];

  const sauceOptions = [
    'Classic Buffalo (Medium)', 'Hot Buffalo', 'Mild Buffalo', 'BBQ', 'Garlic Parmesan',
    'Honey BBQ', 'Spicy BBQ', 'Lemon Pepper', 'Teriyaki', 'Sweet Chili',
    'Mango Habanero', 'Nashville Hot', 'Cajun Dry Rub', 'Korean BBQ', 'Ghost Pepper',
    'Honey Mustard', 'Caribbean Jerk', 'Chipotle BBQ', 'Thai Curry', 'Bourbon',
    'Ranch Dry Rub', 'Buffalo Ranch', 'Sriracha', 'Old Bay', 'Garlic Buffalo',
    'Honey Garlic', 'Salt & Vinegar', 'Memphis Dry Rub', 'Sweet & Sour', 'Carolina Gold BBQ'
  ];

  function handleSauceChange(event: Event, sauce: string) {
    if (event.target instanceof HTMLInputElement) {
      if (event.target.checked) {
        selectedSauces = [...selectedSauces, sauce];
      } else {
        selectedSauces = selectedSauces.filter(s => s !== sauce);
      }
    }
  }
</script>

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
