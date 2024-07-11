<script lang="ts">
    import { onMount } from 'svelte';
    import { supabase } from '$lib/supabase';
    import Map from '$lib/components/Map.svelte';
    import ListView from '$lib/components/ListView.svelte';
    import ToggleSwitch from '$lib/components/ToggleSwitch.svelte';
    import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  
    let wingRatings: any[] = [];
    let isMapView = true;
    let isDarkMode = false;
  
    onMount(async () => {
      const { data, error } = await supabase
        .from('wing_ratings')
        .select('*');
      
      if (error) {
        console.error('Error fetching wing ratings:', error);
      } else {
        wingRatings = data;
      }
    });
  
    function toggleView() {
      isMapView = !isMapView;
    }
  
    function toggleTheme() {
      isDarkMode = !isDarkMode;
      document.documentElement.classList.toggle('dark');
    }
  </script>
  
  <div class={`min-h-screen ${isDarkMode ? 'dark' : ''}`}>
    <div class="container mx-auto p-4">
      <h1 class="text-3xl font-bold mb-4">Chicken Wing Ratings</h1>
      <div class="flex justify-between mb-4">
        <ToggleSwitch 
          checked={isMapView} 
          onChange={toggleView} 
          label={isMapView ? 'Map View' : 'List View'} 
        />
        <ThemeToggle 
          checked={isDarkMode} 
          onChange={toggleTheme} 
        />
      </div>
      {#if isMapView}
        <Map {wingRatings} />
      {:else}
        <ListView {wingRatings} />
      {/if}
    </div>
  </div>
  
  <style>
    :global(body) {
      @apply bg-white text-gray-900 dark:bg-gray-900 dark:text-white;
    }
  </style>