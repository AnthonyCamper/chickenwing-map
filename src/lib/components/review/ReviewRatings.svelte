<script lang="ts">
  import type { RatingDescriptions } from './types';

  export let appearance: number;
  export let aroma: number;
  export let sauceQuantity: number;
  export let sauceConsistency: number;
  export let sauceHeat: number;
  export let skinConsistency: number;
  export let meatQuality: number;
  export let greasiness: number;
  export let blueCheeseQuality: number;
  export let blueCheeseNA: boolean;
  export let satisfactionScore: number;
  export let recommendationScore: number;

  // Add rating scale descriptions
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
      0: "Literal biohazard - calling the health department",
      0.5: "Pretty sure this violated the Geneva Convention",
      1: "Major regrets, contemplating life choices",
      1.5: "Stomach is filing for divorce",
      2: "Absolutely terrible, wouldn't feed to my enemy",
      2.5: "At least it resembles food... technically",
      3: "Bad enough to make you swear off wings",
      3.5: "Disappointingly poor",
      4: "Edible in emergencies only",
      4.5: "Below average, but won't ruin your day",
      5: "Perfectly average wings",
      5.5: "Slightly above average",
      6: "Good, but not memorable",
      6.5: "Better than most",
      7: "Would definitely return",
      7.5: "Excellent wings",
      8: "Outstanding quality",
      8.5: "Among the best I've had",
      9: "Exceptional wings",
      9.5: "Nearly perfect",
      10: "Life-changing wings!"
    }
  };

  let lastChanged = '';
  function handleRatingChange(field: string) {
    lastChanged = field;
    setTimeout(() => {
      if (lastChanged === field) {
        lastChanged = '';
      }
    }, 1000);
  }

  function getRatingDescription(category: keyof RatingDescriptions, value: number): string {
    const descriptions = ratingDescriptions[category];
    const scores = Object.keys(descriptions).map(Number).sort((a, b) => a - b);
    const nearestScore = scores.reduce((prev, curr) => 
      Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
    );
    return descriptions[nearestScore];
  }

  function formatSliderValue(value: number, prefix: string = ''): string {
    return `${prefix}${value}`;
  }
</script>

<style>
  .slider-value {
    position: absolute;
    right: 0;
    top: 0;
    font-size: 0.875rem;
    color: #3b82f6;
    font-weight: 500;
  }

  .slider-container {
    position: relative;
    padding-right: 2.5rem;
  }

  input[type="range"] {
    transition: all 0.2s ease;
  }
  input[type="range"]:hover {
    transform: scale(1.02);
  }
  input[type="range"]:active {
    transform: scale(0.98);
  }

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

  .rating-changed {
    animation: pulse 1s ease-out;
  }

  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
  }

  @media (max-width: 640px) {
    input[type="range"]::-webkit-slider-thumb {
      width: 28px;
      height: 28px;
    }
  }
</style>

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
        <div class="relative">
          <input
            type="number"
            min="0"
            max="10"
            step="0.1"
            bind:value={recommendationScore}
            on:input={(e) => {
              const value = parseFloat(e.target.value);
              if (!isNaN(value)) {
                recommendationScore = Math.round(value * 10) / 10;
              }
              handleRatingChange('recommendationScore');
            }}
            class="w-full p-2 rounded-md border border-gray-300 dark:border-gray-600 
                   bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                   focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter score (e.g. 7.8)"
          />
          {#if recommendationScore !== null && recommendationScore >= 0 && recommendationScore <= 10}
            <div class="mt-2 text-sm">
              <div class="font-medium text-blue-500">
                Score: {recommendationScore.toFixed(1)} / 10
              </div>
              <div class="mt-1 text-gray-600 dark:text-gray-400">
                {getRatingDescription('recommendationScore', Math.round(recommendationScore * 2) / 2)}
              </div>
            </div>
          {/if}
          {#if recommendationScore < 0 || recommendationScore > 10}
            <div class="mt-1 text-sm text-red-500">
              Please enter a score between 0 and 10
            </div>
          {/if}
        </div>
        <div class="flex flex-col space-y-2 mt-3">
          <div class="text-xs text-gray-600 dark:text-gray-400">
            Score Guide:
          </div>
          <div class="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
            <div>0-2: Poor</div>
            <div>2.1-4: Below Average</div>
            <div>4.1-6: Average</div>
            <div>6.1-8: Above Average</div>
            <div>8.1-9: Excellent</div>
            <div>9.1-10: Exceptional</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
