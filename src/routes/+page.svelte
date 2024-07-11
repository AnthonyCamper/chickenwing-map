<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import Map from '$lib/components/Map.svelte';
	import ListView from '$lib/components/ListView.svelte';
	import ToggleSwitch from '$lib/components/ToggleSwitch.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import ReviewSlideout from '$lib/components/ReviewSlideout.svelte';
	import { writable } from 'svelte/store';
  
	let wingRatings: any[] = [];
	let isMapView = true;
	let isDarkMode = false;
	let isLoading = true;
	let selectedRating: any | null = null;
	let userLocation: { latitude: number; longitude: number } | null = null;
  
	let sortBy = writable('rating');
	let sortOrder = writable('desc');
  
	$: isSlideoutOpen = !!selectedRating;
  
	function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
	  const R = 6371; // Radius of the earth in km
	  const dLat = deg2rad(lat2 - lat1);
	  const dLon = deg2rad(lon2 - lon1);
	  const a = 
		Math.sin(dLat/2) * Math.sin(dLat/2) +
		Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
		Math.sin(dLon/2) * Math.sin(dLon/2)
	  ; 
	  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
	  const d = R * c; // Distance in km
	  return d;
	}
  
	function deg2rad(deg: number) {
	  return deg * (Math.PI/180);
	}
  
	$: sortedRatings = [...wingRatings].sort((a, b) => {
	  const order = $sortOrder === 'asc' ? 1 : -1;
	  switch ($sortBy) {
		case 'rating':
		  return (b.rating - a.rating) * order;
		case 'name':
		  return a.restaurant_name.localeCompare(b.restaurant_name) * order;
		case 'date':
		  return (new Date(b.date_visited).getTime() - new Date(a.date_visited).getTime()) * order;
		case 'distance':
		  if (userLocation) {
			const distanceA = calculateDistance(userLocation.latitude, userLocation.longitude, a.latitude, a.longitude);
			const distanceB = calculateDistance(userLocation.latitude, userLocation.longitude, b.latitude, b.longitude);
			return (distanceA - distanceB) * order;
		  }
		  return 0;
		default:
		  return 0;
	  }
	});
  
	onMount(() => {
	  isDarkMode = localStorage.getItem('darkMode') === 'true';
	  applyTheme();
	  
	  fetchWingRatings();
	  getUserLocation();
	});
  
	async function fetchWingRatings() {
	  isLoading = true;
	  const { data, error } = await supabase
		.from('wing_ratings')
		.select('*');
	  
	  if (error) {
		console.error('Error fetching wing ratings:', error);
	  } else {
		console.log('Fetched data:', data);
		wingRatings = data || [];
		if (userLocation) {
		  wingRatings = wingRatings.map(rating => ({
			...rating,
			distance: calculateDistance(userLocation.latitude, userLocation.longitude, rating.latitude, rating.longitude)
		  }));
		}
	  }
	  isLoading = false;
	}
  
	function getUserLocation() {
	  if (navigator.geolocation) {
		navigator.geolocation.getCurrentPosition(
		  (position) => {
			userLocation = {
			  latitude: position.coords.latitude,
			  longitude: position.coords.longitude
			};
			if (wingRatings.length > 0) {
			  wingRatings = wingRatings.map(rating => ({
				...rating,
				distance: calculateDistance(userLocation.latitude, userLocation.longitude, rating.latitude, rating.longitude)
			  }));
			}
		  },
		  (error) => {
			console.error("Error getting user location:", error);
		  }
		);
	  } else {
		console.error("Geolocation is not supported by this browser.");
	  }
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
  
  <div class="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white p-4 sm:p-6 md:p-8">
	<div class="max-w-7xl mx-auto shadow-lg rounded-lg overflow-hidden bg-white dark:bg-gray-800">
	  <div class="p-4 sm:p-6">
		<h1 class="text-2xl sm:text-3xl font-bold mb-4">Chicken Wing Ratings</h1>
		<div class="flex flex-col sm:flex-row justify-between mb-4 gap-4">
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
	  
	  <div class="relative h-[calc(100vh-200px)] sm:h-[calc(100vh-240px)]">
		{#if isLoading}
		  <p class="p-4">Loading wing ratings...</p>
		{:else if wingRatings.length === 0}
		  <p class="p-4">No wing ratings found. <button on:click={fetchWingRatings} class="text-blue-500">Refresh</button></p>
		{:else}
		  {#if isMapView}
			<Map 
			  wingRatings={sortedRatings} 
			  onMarkerClick={handleShowReview} 
			  {isSlideoutOpen} 
			  {userLocation}
			/>
		  {:else}
			<div class="p-4 overflow-y-auto h-full">
			  <ListView 
				wingRatings={sortedRatings} 
				onShowReview={handleShowReview} 
				bind:sortBy={$sortBy} 
				bind:sortOrder={$sortOrder}
			  />
			</div>
		  {/if}
		{/if}
	  </div>
	</div>
  </div>
  
  <ReviewSlideout rating={selectedRating} onClose={closeSlideout} />
  
  <style>
	:global(body) {
	  @apply bg-gray-100 dark:bg-gray-900;
	}
  </style>