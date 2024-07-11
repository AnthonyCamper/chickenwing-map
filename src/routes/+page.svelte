<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import Map from '$lib/components/Map.svelte';
	import ListView from '$lib/components/ListView.svelte';
	import ToggleSwitch from '$lib/components/ToggleSwitch.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import ReviewSlideout from '$lib/components/ReviewSlideout.svelte';

	let wingRatings: any[] = [];
	let isMapView = true;
	let isDarkMode = false;
	let isLoading = true;
	let selectedRating: any | null = null;

	$: isSlideoutOpen = !!selectedRating;

	onMount(() => {
		isDarkMode = localStorage.getItem('darkMode') === 'true';
		applyTheme();

		fetchWingRatings();
	});

	async function fetchWingRatings() {
		isLoading = true;
		const { data, error } = await supabase.from('wing_ratings').select('*');

		if (error) {
			console.error('Error fetching wing ratings:', error);
		} else {
			console.log('Fetched data:', data);
			wingRatings = data || [];
		}
		isLoading = false;
	}

	function toggleView() {
		isMapView = !isMapView;
	}

	function toggleTheme() {
		isDarkMode = !isDarkMode;
		applyTheme();
	}

	function applyTheme() {
		if (isDarkMode) {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
		localStorage.setItem('darkMode', isDarkMode.toString());
	}

	function handleShowReview(rating: any) {
		selectedRating = rating;
	}

	function closeSlideout() {
		selectedRating = null;
	}
</script>

<div class="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white p-4">
    <div class="max-w-7xl mx-auto border-4 border-blue-500 rounded-lg overflow-hidden">
      <div class="p-4 bg-white dark:bg-gray-800">
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
      </div>

		<div class="relative" style="height: calc(100vh - 200px);">
			{#if isLoading}
				<p class="p-4">Loading wing ratings...</p>
			{:else if wingRatings.length === 0}
				<p class="p-4">
					No wing ratings found. <button on:click={fetchWingRatings} class="text-blue-500"
						>Refresh</button
					>
				</p>
			{:else if isMapView}
				<Map {wingRatings} onMarkerClick={handleShowReview} {isSlideoutOpen} />
			{:else}
				<div class="p-4 overflow-y-auto h-full">
					<ListView {wingRatings} onShowReview={handleShowReview} />
				</div>
			{/if}
		</div>
	</div>

	<ReviewSlideout rating={selectedRating} onClose={closeSlideout} />
</div>
