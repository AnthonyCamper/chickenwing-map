<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { faSearch, faTimes, faMapMarkerAlt, faFileAlt, faSpinner } from '@fortawesome/free-solid-svg-icons';
  import Icon from 'svelte-fa';
  import { 
    searchQuery, 
    searchMode, 
    isSearching, 
    searchResults,
    searchError,
    recentSearches,
    performSearch,
    performDebouncedSearch,
    clearSearch,
    selectSearchResult,
    shouldShowNoResults,
    shouldShowResults,
    isResultSelected,
    selectedResult,
    loadRecentSearches,
    removeFromRecentSearches
  } from '$lib/stores/searchStore';
  import type { Review } from '$lib/components/review/types';
  
  // Props
  export let reviews: Review[] = [];
  export let placeholder = "Search locations or reviews...";
  export let showSearchModeToggle = true;
  export let fullWidth = true;
  export let mobileFriendly = true;
  export let onResultSelect: ((review: Review) => void) | null = null;
  
  // Local state
  let isFocused = false;
  
  // Event dispatcher
  const dispatch = createEventDispatcher<{
    search: { query: string, results: { locationMatches: any[], reviewMatches: Review[] } };
    clear: void;
    modeChange: 'location' | 'content';
    resultSelect: Review;
  }>();
  
  // Handle Enter key and typing
  function handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      // Immediate search on Enter
      search();
    } else {
      // Reset the isResultSelected flag when user starts typing a new query
      isResultSelected.set(false);
      
      // Clear previous search results when typing after selection
      if ($selectedResult !== null) {
        searchResults.set({ locationMatches: [], reviewMatches: [] });
        selectedResult.set(null);
      }
      
      // Perform debounced search while typing if query has at least 2 characters
      if ($searchQuery.trim().length >= 2) {
        performDebouncedSearch(reviews, $searchMode);
      } else if ($searchQuery.trim().length === 0) {
        // Clear results when search is empty
        searchResults.set({ locationMatches: [], reviewMatches: [] });
      }
    }
  }
  
  // Perform search and dispatch results event
  function search() {
    // Don't search if query is empty
    if (!$searchQuery.trim()) {
      return;
    }
    
    // Perform immediate search using our centralized search store
    performDebouncedSearch(reviews, $searchMode, true);
    
    // Dispatch results for parent components after a short delay to allow search to complete
    setTimeout(() => {
      dispatch('search', {
        query: $searchQuery,
        results: $searchResults
      });
    }, 50);
  }
  
  // Select a specific review result
  function selectReviewResult(review: Review) {
    console.log("Selecting review:", review.location.restaurant_name);
    
    // Update the store state
    selectSearchResult(review);
    
    // Dispatch the event for parent component
    dispatch('resultSelect', review);
    
    // Call the callback if it exists
    if (onResultSelect) {
      setTimeout(() => {
        onResultSelect(review);
      }, 50);
    }
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
  
  // Handle input focus/blur for recent searches
  function handleFocus() {
    isFocused = true;
    loadRecentSearches();
  }
  
  function handleBlur() {
    // Delay blur to allow clicking on recent search items
    setTimeout(() => {
      isFocused = false;
    }, 200);
  }
  
  // Handle recent search selection
  function selectRecentSearch(query: string) {
    searchQuery.set(query);
    search();
    isFocused = false;
  }
  
  // Handle recent search removal
  function removeRecentSearch(event: Event, query: string) {
    event.stopPropagation();
    removeFromRecentSearches(query);
  }
  
  // Check if we should show recent searches
  $: shouldShowRecent = isFocused && 
                       $searchQuery.trim().length === 0 && 
                       !$isSearching && 
                       !$searchError && 
                       $recentSearches.length > 0;
</script>

<div class={`relative ${fullWidth ? 'w-full' : ''}`}>
  <!-- Modern pill-shaped search container -->
  <div class="relative group">
    <div class="relative flex items-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-full shadow-sm hover:shadow-md transition-all duration-200 focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:border-primary-500">
      
      <!-- Search icon -->
      <div class="absolute left-4 flex items-center pointer-events-none">
        <Icon icon={faSearch} class="h-4 w-4 text-gray-400 dark:text-gray-500" />
      </div>
      
      <!-- Search input -->
      <input
        type="text"
        class="flex-1 pl-11 pr-4 py-3 bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 border-0 rounded-full focus:outline-none focus:ring-0 text-sm"
        {placeholder}
        bind:value={$searchQuery}
        on:keyup={handleKeyPress}
        on:focus={handleFocus}
        on:blur={handleBlur}
        aria-label="Search"
        autocomplete="off"
      />
      
      <!-- Right side controls container -->
      <div class="flex items-center gap-1 pr-2">
        
        <!-- Search mode toggle (pill badge) -->
        {#if showSearchModeToggle}
          <button
            type="button"
            class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-full transition-all duration-200 
                   {$searchMode === 'location' 
                     ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50' 
                     : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50'}"
            on:click={toggleSearchMode}
            aria-label={$searchMode === 'location' ? "Switch to content search" : "Switch to location search"}
            title={$searchMode === 'location' ? "Searching locations" : "Searching content"}
          >
            <Icon icon={$searchMode === 'location' ? faMapMarkerAlt : faFileAlt} class="h-3 w-3" />
            {#if !mobileFriendly}
              <span class="hidden sm:inline">{$searchMode === 'location' ? 'Places' : 'Reviews'}</span>
            {/if}
          </button>
        {/if}
        
        <!-- Search button -->
        {#if $searchQuery.trim().length >= 2}
          <button
            type="button"
            class="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-full transition-all duration-200 shadow-sm hover:shadow-md"
            on:click={search}
            aria-label="Search"
            title="Search"
          >
            Search
          </button>
        {/if}
        
        <!-- Clear button -->
        {#if $searchQuery}
          <button
            type="button"
            class="inline-flex items-center justify-center w-6 h-6 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all duration-200"
            on:click={handleClearSearch}
            aria-label="Clear search"
          >
            <Icon icon={faTimes} class="h-3.5 w-3.5" />
          </button>
        {/if}
      </div>
    </div>
  </div>
  
  <!-- Error message -->
  {#if $searchError}
    <div class="absolute z-[1002] mt-3 w-full bg-white dark:bg-gray-900 border border-red-200 dark:border-red-800 rounded-lg shadow-lg p-4">
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0 w-8 h-8 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center">
          <Icon icon={faSearch} class="h-4 w-4 text-red-600 dark:text-red-400" />
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="text-sm font-medium text-red-900 dark:text-red-100">Search Error</h4>
          <p class="mt-1 text-sm text-red-700 dark:text-red-300">{$searchError.message}</p>
        </div>
      </div>
    </div>
  {/if}

  <!-- No results message -->
  {#if $shouldShowNoResults && !$searchError}
    <div class="absolute z-[1002] mt-3 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4">
      <div class="flex items-center gap-3">
        <div class="flex-shrink-0 w-8 h-8 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center">
          <Icon icon={faSearch} class="h-4 w-4 text-gray-400 dark:text-gray-500" />
        </div>
        <div class="flex-1">
          <p class="text-sm text-gray-600 dark:text-gray-400">No results found for "{$searchQuery}"</p>
        </div>
      </div>
    </div>
  {/if}
  
  <!-- Loading indicator -->
  {#if $isSearching}
    <div class="absolute z-[1002] mt-3 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4">
      <div class="flex items-center gap-3">
        <div class="flex-shrink-0">
          <Icon icon={faSpinner} class="h-4 w-4 text-primary-600 dark:text-primary-400 animate-spin" />
        </div>
        <span class="text-sm text-gray-600 dark:text-gray-400">Searching...</span>
      </div>
    </div>
  {/if}
  
  <!-- Results dropdown -->
  {#if $shouldShowResults}
    <div class="absolute z-[1002] mt-3 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden max-h-[420px]">
      
      <!-- Results header -->
      <div class="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
        <p class="text-xs font-medium text-gray-700 dark:text-gray-300">
          Found {$searchResults.reviewMatches.length} result{$searchResults.reviewMatches.length !== 1 ? 's' : ''} for "{$searchQuery}"
        </p>
      </div>
      
      <!-- Results list -->
      {#if $searchResults.reviewMatches.length > 0}
        <div class="overflow-y-auto max-h-[320px]">
          {#each $searchResults.reviewMatches.slice(0, 6) as review (review.id)}
            <div class="group px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-b border-gray-100 dark:border-gray-800 last:border-b-0">
              <div class="flex items-start justify-between gap-3">
                
                <!-- Restaurant info -->
                <div class="flex items-start gap-3 flex-1 min-w-0">
                  <div class="flex-shrink-0 w-8 h-8 bg-primary-50 dark:bg-primary-900/20 rounded-full flex items-center justify-center">
                    <Icon icon={faMapMarkerAlt} class="h-4 w-4 text-primary-600 dark:text-primary-400" />
                  </div>
                  
                  <div class="flex-1 min-w-0">
                    <h4 class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {review.location.restaurant_name}
                    </h4>
                    
                    {#if review.location.address}
                      <p class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                        {review.location.address}
                      </p>
                    {/if}
                    
                    <!-- Rating and preview -->
                    <div class="flex items-center gap-2 mt-2">
                      <div class="flex items-center">
                        {#each Array(5) as _, i}
                          <span class="text-yellow-400 text-xs">
                            {i < Number(review.rating) ? '★' : '☆'}
                          </span>
                        {/each}
                        <span class="text-xs text-gray-500 dark:text-gray-400 ml-1">
                          {review.rating}/5
                        </span>
                      </div>
                    </div>
                    
                    {#if review.review}
                      <p class="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                        {review.review.length > 80 ? review.review.substring(0, 80) + '...' : review.review}
                      </p>
                    {/if}
                  </div>
                </div>
                
                <!-- View button -->
                <button
                  class="flex-shrink-0 inline-flex items-center px-3 py-1.5 text-xs font-medium text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded-full transition-all duration-200 group-hover:shadow-sm"
                  on:click={() => selectReviewResult(review)}
                  on:keydown={event => handleResultKeyDown(event, review)}
                  aria-label="View {review.location.restaurant_name} on map"
                >
                  View
                </button>
              </div>
            </div>
          {/each}
        </div>
        
        {#if $searchResults.reviewMatches.length > 6}
          <div class="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
            <p class="text-xs text-center text-gray-500 dark:text-gray-400">
              {$searchResults.reviewMatches.length - 6} more result{$searchResults.reviewMatches.length - 6 !== 1 ? 's' : ''} not shown
            </p>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
  
  <!-- Recent searches dropdown -->
  {#if shouldShowRecent}
    <div class="absolute z-[1002] mt-3 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
      
      <!-- Recent searches header -->
      <div class="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
        <h4 class="text-xs font-medium text-gray-700 dark:text-gray-300">Recent Searches</h4>
      </div>
      
      <!-- Recent searches list -->
      <div class="py-1">
        {#each $recentSearches as query (query)}
          <button
            type="button"
            class="group w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            on:click={() => selectRecentSearch(query)}
          >
            <div class="flex items-center gap-3">
              <div class="flex-shrink-0 w-6 h-6 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                <Icon icon={faSearch} class="h-3 w-3 text-gray-500 dark:text-gray-400" />
              </div>
              <span class="text-sm text-gray-700 dark:text-gray-300 truncate">{query}</span>
            </div>
            
            <button
              type="button"
              class="opacity-0 group-hover:opacity-100 flex-shrink-0 w-6 h-6 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 flex items-center justify-center"
              on:click={(e) => removeRecentSearch(e, query)}
              aria-label="Remove search"
            >
              <Icon icon={faTimes} class="h-3 w-3" />
            </button>
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div> 