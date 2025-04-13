<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { faSearch, faTimes, faMapMarkerAlt, faFileAlt, faSpinner } from '@fortawesome/free-solid-svg-icons';
  import Icon from 'svelte-fa';
  import { 
    searchQuery, 
    searchMode, 
    isSearching, 
    showNoResults, 
    showAutocomplete,
    autocompleteResults,
    searchResults,
    showResults,
    performSearch,
    updateAutocomplete,
    clearSearch,
    selectSearchResult,
    shouldShowResultsDropdown,
    shouldShowNoResults,
    isResultSelected
  } from '$lib/stores/searchStore';
  import type { Review } from '$lib/components/review/types';
  
  // Props
  export let reviews: Review[] = [];
  export let placeholder = "Search locations or reviews...";
  export let showSearchModeToggle = true;
  export let fullWidth = true;
  export let mobileFriendly = true;
  export let onResultSelect: ((review: Review) => void) | null = null;
  
  // Event dispatcher
  const dispatch = createEventDispatcher<{
    search: { query: string, results: { locationMatches: any[], reviewMatches: Review[] } };
    clear: void;
    modeChange: 'location' | 'content';
    resultSelect: Review;
  }>();
  
  // Handle Enter key
  async function handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      await search();
      
      // If Enter is pressed and we have exactly one result, select it automatically
      // This is a common UX pattern when searching
      if ($searchResults.reviewMatches.length === 1) {
        selectReviewResult($searchResults.reviewMatches[0]);
      }
    } else {
      // Reset the isResultSelected flag when user starts typing a new query
      // This allows autocomplete to work again after selection
      isResultSelected.set(false);
      
      // Update autocomplete on keystroke
      updateAutocomplete(reviews, $searchQuery);
    }
  }
  
  // Perform search and dispatch results event
  async function search() {
    // Don't search if query is empty
    if (!$searchQuery.trim()) {
      return;
    }
    
    // Perform the search using our centralized search store
    await performSearch(reviews, $searchMode);
    
    // Dispatch results for parent components
    dispatch('search', {
      query: $searchQuery,
      results: $searchResults
    });
  }
  
  // Handle autocomplete selection
  function selectAutocomplete(result: string) {
    isResultSelected.set(true);
    searchQuery.set(result);
    showAutocomplete.set(false);
    search();
  }
  
  // Select a specific review result
  function selectReviewResult(review: Review) {
    console.log("Selecting review:", review.location.restaurant_name);
    
    // First, update the store state - DO NOT ALLOW THIS TO PREVENT ZOOM
    isResultSelected.set(true);
    selectSearchResult(review);
    
    // Clear search results to hide dropdown
    showResults.set(false);
    showNoResults.set(false);
    showAutocomplete.set(false);
    
    // IMPORTANT: First dispatch the event, so the parent component can set up the correct state
    dispatch('resultSelect', review);
    
    // THEN call the callback if it exists (but the zoom should already happen from the event)
    if (onResultSelect) {
      setTimeout(() => {
        onResultSelect(review);
      }, 50);
    }
    
    // Ensure no-results message doesn't reappear
    setTimeout(() => showNoResults.set(false), 10);
  }
  
  // Handle search mode toggle
  function toggleSearchMode() {
    const newMode = $searchMode === 'location' ? 'content' : 'location';
    searchMode.set(newMode);
    dispatch('modeChange', newMode);
  }
  
  // Clear search
  function handleClearSearch() {
    clearSearch();
    dispatch('clear');
  }

  function handleResultKeyDown(event: KeyboardEvent, review: Review) {
    if (event.key === 'Enter') {
      selectReviewResult(review);
    }
  }
</script>

<div class={`relative ${fullWidth ? 'w-full' : ''}`}>
  <div class="relative rounded-md shadow-sm">
    <!-- Search icon -->
    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
      <Icon icon={faSearch} class="h-5 w-5 text-gray-400" />
    </div>
    
    <!-- Search input -->
    <input
      type="text"
      class="form-input pl-10 {$searchMode === 'location' ? 'pr-20' : 'pr-10'} py-2 w-full rounded-md 
             border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 
             text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
      {placeholder}
      bind:value={$searchQuery}
      on:keyup={handleKeyPress}
      aria-label="Search"
      autocomplete="off"
    />
    
    <!-- Mode toggle and clear button -->
    <div class="absolute inset-y-0 right-0 flex items-center">
      {#if showSearchModeToggle}
        <button
          type="button"
          class="mr-1 px-2 py-1 text-xs rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          on:click={toggleSearchMode}
          aria-label={$searchMode === 'location' ? "Switch to content search" : "Switch to location search"}
          title={$searchMode === 'location' ? "Searching locations" : "Searching content"}
        >
          <div class="flex items-center space-x-1">
            <Icon icon={$searchMode === 'location' ? faMapMarkerAlt : faFileAlt} />
            {#if !mobileFriendly}
              <span class="hidden sm:inline">{$searchMode === 'location' ? 'Location' : 'Content'}</span>
            {/if}
          </div>
        </button>
      {/if}
      
      {#if $searchQuery}
        <button
          type="button"
          class="pr-3 text-gray-400 hover:text-gray-500 focus:outline-none"
          on:click={handleClearSearch}
          aria-label="Clear search"
        >
          <Icon icon={faTimes} class="h-5 w-5" />
        </button>
      {/if}
    </div>
  </div>
  
  <!-- No results message -->
  {#if $shouldShowNoResults}
    <div class="absolute z-[1002] mt-1 w-full bg-white dark:bg-gray-800 shadow-lg rounded-md py-2 px-3 text-sm text-error-500 dark:text-error-400 border border-error-200 dark:border-error-700">
      No results found for "{$searchQuery}"
    </div>
  {/if}
  
  <!-- Loading indicator -->
  {#if $isSearching}
    <div class="absolute z-[1002] mt-1 w-full bg-white dark:bg-gray-800 shadow-lg rounded-md py-2 px-3 text-sm">
      <div class="flex items-center space-x-2">
        <Icon icon={faSpinner} class="h-4 w-4 text-primary-500 animate-spin" />
        <span>Searching...</span>
      </div>
    </div>
  {/if}
  
  <!-- Autocomplete suggestions -->
  {#if $showAutocomplete && $autocompleteResults.length > 0}
    <div class="absolute z-[1002] mt-1 w-full bg-white dark:bg-gray-800 shadow-lg rounded-md py-1 overflow-hidden">
      {#each $autocompleteResults as result}
        <button
          class="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-900 dark:text-white"
          on:click={() => selectAutocomplete(result)}
        >
          <div class="flex items-center space-x-2">
            <Icon icon={result.includes(',') ? faMapMarkerAlt : faFileAlt} class="text-gray-400" />
            <span>{result}</span>
          </div>
        </button>
      {/each}
    </div>
  {/if}
  
  <!-- Results dropdown -->
  {#if $shouldShowResultsDropdown}
    <div class="absolute z-[1002] mt-1 w-full bg-white dark:bg-gray-800 shadow-lg rounded-md py-1 max-h-[400px] overflow-y-auto">
      <div class="px-3 py-2 border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
        Showing {$searchResults.reviewMatches.length} results for "{$searchQuery}"
      </div>
      
      {#if $searchResults.reviewMatches.length > 0}
        <!-- Limit to 6 results for better UI -->
        {#each $searchResults.reviewMatches.slice(0, 6) as review (review.id)}
          <button
            class="block w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700 transition-colors"
            on:click={() => selectReviewResult(review)}
            on:keydown={event => handleResultKeyDown(event, review)}
          >
            <div class="flex items-start">
              <Icon icon={faMapMarkerAlt} class="h-4 w-4 text-primary-500 mt-0.5 mr-2 flex-shrink-0" />
              <div>
                <div class="font-medium">{review.location.restaurant_name}</div>
                {#if review.location.address}
                  <div class="text-sm text-gray-600 dark:text-gray-400">{review.location.address}</div>
                {/if}
                <div class="mt-1 flex items-center">
                  <div class="flex items-center mr-2">
                    {#each Array(5) as _, i}
                      <span class="text-yellow-500 text-xs">
                        {i < Number(review.rating) ? '★' : '☆'}
                      </span>
                    {/each}
                  </div>
                  <span class="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[200px]">
                    {review.review.length > 60 ? review.review.substring(0, 60) + '...' : review.review}
                  </span>
                </div>
              </div>
            </div>
          </button>
        {/each}
        {#if $searchResults.reviewMatches.length > 6}
          <div class="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 text-center border-t border-gray-200 dark:border-gray-700">
            {$searchResults.reviewMatches.length - 6} more results not shown
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div> 