<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import Map from '$lib/components/Map.svelte';
	import ListView from '$lib/components/ListView.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import ReviewSlideout from '$lib/components/ReviewSlideout.svelte';
	import { writable } from 'svelte/store';
	import { faSearch, faPlus } from '@fortawesome/free-solid-svg-icons';
	import Icon from 'svelte-fa';
	import { geocode } from '$lib/geocoding';

	let wingRatings: any[] = [];
	let isMapView = true;
	let isDarkMode = false;
	let isLoading = true;
	let selectedRating: any | null = null;
	let userLocation: { latitude: number; longitude: number } | null = null;
	let user: any = null;

	let sortBy = writable('rating');
	let sortOrder = writable('desc');

	let searchQuery = '';
	let searchType = 'name'; // Can be 'name', 'city', or 'zip'
	let noResultsFound = false;
	let mapComponent: Map;
	let autocompleteResults: string[] = [];
	let showAutocomplete = false;

	$: isSlideoutOpen = !!selectedRating;

	function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
		const R = 6371; // Radius of the earth in km
		const dLat = deg2rad(lat2 - lat1);
		const dLon = deg2rad(lon2 - lon1);
		const a =
			Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		const d = R * c; // Distance in km
		return d;
	}

	function handleKeyPress(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			handleSearch();
		}
	}
	function deg2rad(deg: number) {
		return deg * (Math.PI / 180);
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
					const distanceA = calculateDistance(
						userLocation.latitude,
						userLocation.longitude,
						a.latitude,
						a.longitude
					);
					const distanceB = calculateDistance(
						userLocation.latitude,
						userLocation.longitude,
						b.latitude,
						b.longitude
					);
					return (distanceA - distanceB) * order;
				}
				return 0;
			default:
				return 0;
		}
	});

	onMount(async () => {
		isDarkMode = localStorage.getItem('darkMode') === 'true';
		applyTheme();

		// Get initial auth state
		const { data: { user: initialUser } } = await supabase.auth.getUser();
		user = initialUser;

		// Listen for auth changes
		supabase.auth.onAuthStateChange((_event, session) => {
			user = session?.user;
		});

		fetchWingRatings();
		getUserLocation();
	});

	async function fetchWingRatings() {
		isLoading = true;
		console.log('=== FETCHING WING RATINGS ===');

		// Get ratings with vote counts
		const { data, error } = await supabase
			.from('wing_ratings')
			.select(`
				*,
				upvotes_count,
				downvotes_count
			`);

		if (error) {
			console.error('Error fetching wing ratings:', error);
		} else {
			console.log('Fetched data:', JSON.stringify(data, null, 2));
			const currentLocation = userLocation;
			wingRatings = data || [];
			if (currentLocation) {
				wingRatings = wingRatings.map((rating) => ({
					...rating,
					distance: calculateDistance(
						currentLocation.latitude,
						currentLocation.longitude,
						rating.latitude,
						rating.longitude
					)
				}));
			}
			// Update selectedRating if it exists
			if (selectedRating) {
				const updatedRating = wingRatings.find(r => r.id === selectedRating.id);
				if (updatedRating) {
					console.log('Updating selected rating:', JSON.stringify(updatedRating, null, 2));
					selectedRating = { ...updatedRating };
				}
			}
		}
		isLoading = false;
		console.log('=== FETCH COMPLETE ===');
	}

	function getUserLocation() {
		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					const newUserLocation = {
						latitude: position.coords.latitude,
						longitude: position.coords.longitude
					};
					userLocation = newUserLocation;
					if (wingRatings.length > 0) {
						wingRatings = wingRatings.map((rating) => ({
							...rating,
							distance: calculateDistance(
								newUserLocation.latitude,
								newUserLocation.longitude,
								rating.latitude,
								rating.longitude
							)
						}));
					}
				},
				(error) => {
					console.error('Error getting user location:', error);
				}
			);
		} else {
			console.error('Geolocation is not supported by this browser.');
		}
	}

	function setMapView(value: boolean) {
		isMapView = value;
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
		selectedRating = { ...rating };
	}

	function closeSlideout() {
		selectedRating = null;
	}

	async function handleVoteChange() {
		console.log('=== VOTE CHANGED ===');
		console.log('Refreshing data...');
		await fetchWingRatings();
	}

	async function handleSearch() {
		showAutocomplete = false;
		if (searchType === 'name') {
			const matchingRating = wingRatings.find((rating) =>
				rating.restaurant_name.toLowerCase().includes(searchQuery.toLowerCase())
			);
			if (matchingRating && mapComponent) {
				mapComponent.zoomToLocation(
					matchingRating.latitude,
					matchingRating.longitude,
					matchingRating.restaurant_name
				);
				noResultsFound = false;
			} else {
				noResultsFound = true;
			}
		} else if (searchType === 'city' || searchType === 'zip') {
			const location = await geocode(searchQuery);
			if (location && mapComponent) {
				mapComponent.zoomToLocation(location.latitude, location.longitude, searchQuery);
				noResultsFound = false;
			} else {
				noResultsFound = true;
			}
		}
	}

	function submitPlaceToReview() {
		const subject = encodeURIComponent('Submit a Place to Review');
		const body = encodeURIComponent(
			'I would like to submit the following place for a wing review:\n\nRestaurant Name:\nAddress:\nAdditional Information:'
		);
		window.location.href = `mailto:scooterg@redteam.help?subject=${subject}&body=${body}`;
	}

	function updateAutocomplete() {
		if (searchQuery.length > 0 && searchType === 'name') {
			autocompleteResults = wingRatings
				.map((rating) => rating.restaurant_name)
				.filter((name) => name.toLowerCase().includes(searchQuery.toLowerCase()))
				.slice(0, 5); // Limit to 5 results
			showAutocomplete = autocompleteResults.length > 0;
		} else {
			showAutocomplete = false;
		}
	}

	function selectAutocomplete(result: string) {
		searchQuery = result;
		showAutocomplete = false;
		handleSearch();
	}

	// Filter ratings based on search query
	$: filteredRatings = searchQuery && searchType === 'name'
		? sortedRatings.filter(rating => 
				rating.restaurant_name.toLowerCase().includes(searchQuery.toLowerCase()))
		: sortedRatings;

	$: displayedRatings = filteredRatings;

	$: {
		if (!isMapView) {
			noResultsFound = displayedRatings.length === 0 && searchQuery !== '';
		}
		updateAutocomplete();
	}
</script>

<div
	class="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white p-4 sm:p-6 md:p-8"
>
	<div class="p-4 sm:p-6">
		<h1 class="text-3xl font-bold mb-6 text-gray-800 dark:text-white">Chicken Wing Ratings</h1>
		<div class="flex flex-col sm:flex-row justify-between mb-6 gap-4">
			<div class="flex rounded-md shadow-sm" role="group">
				<button
					type="button"
					on:click={() => setMapView(true)}
					class={`px-4 py-2 text-sm font-medium rounded-l-lg ${
						isMapView
							? 'bg-blue-600 text-white'
							: 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600'
					}`}
				>
					Map View
				</button>
				<button
					type="button"
					on:click={() => setMapView(false)}
					class={`px-4 py-2 text-sm font-medium rounded-r-lg ${
						!isMapView
							? 'bg-blue-600 text-white'
							: 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600'
					}`}
				>
					List View
				</button>
			</div>
			<ThemeToggle checked={isDarkMode} onChange={toggleTheme} />
		</div>
		<div class="mb-6 flex flex-col sm:flex-row items-start sm:items-end gap-4 relative">
			<div class="flex-grow w-full sm:w-auto">
				<div class="flex rounded-md shadow-sm mb-2" role="group">
					<label class="inline-flex items-center px-3 py-2 text-sm font-medium rounded-l-md bg-white dark:bg-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 border-r border-gray-200 dark:border-gray-600">
						<input type="radio" bind:group={searchType} value="name" class="sr-only" />
						<span class={searchType === 'name' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}>Name</span>
					</label>
					<label class="inline-flex items-center px-3 py-2 text-sm font-medium bg-white dark:bg-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 border-r border-gray-200 dark:border-gray-600">
						<input type="radio" bind:group={searchType} value="city" class="sr-only" />
						<span class={searchType === 'city' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}>City</span>
					</label>
					<label class="inline-flex items-center px-3 py-2 text-sm font-medium rounded-r-md bg-white dark:bg-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600">
						<input type="radio" bind:group={searchType} value="zip" class="sr-only" />
						<span class={searchType === 'zip' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}>ZIP</span>
					</label>
				</div>
				<div class="relative">
					<input
						type="text"
						on:keypress={handleKeyPress}
						bind:value={searchQuery}
						on:input={updateAutocomplete}
						placeholder={`Search by ${searchType}...`}
						class="w-full p-3 pr-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
					<button
						on:click={handleSearch}
						class="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
					>
						<Icon icon={faSearch} />
					</button>
				</div>
				{#if showAutocomplete}
					<div
						class="absolute z-[9999] w-full bg-white dark:bg-gray-700 mt-1 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600"
					>
						{#each autocompleteResults as result}
							<div
								class="p-3 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-gray-800 dark:text-white"
								on:click={() => selectAutocomplete(result)}
							>
								{result}
							</div>
						{/each}
					</div>
				{/if}
			</div>
			<button
				on:click={submitPlaceToReview}
				class="p-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center whitespace-nowrap"
			>
				<Icon icon={faPlus} class="mr-2" />
				<span>Submit a Place</span>
			</button>
		</div>

		{#if noResultsFound}
			<p class="text-red-500 mt-2">No places found matching your search.</p>
		{/if}
	</div>

	<div class="relative h-[calc(100vh-300px)] sm:h-[calc(100vh-340px)]">
		{#if isLoading}
			<p class="p-4">Loading wing ratings...</p>
		{:else if wingRatings.length === 0}
			<p class="p-4">
				No wing ratings found. <button on:click={fetchWingRatings} class="text-blue-500"
					>Refresh</button
				>
			</p>
		{:else if isMapView}
			<Map
				bind:this={mapComponent}
				wingRatings={displayedRatings}
				onMarkerClick={handleShowReview}
				{isSlideoutOpen}
				{userLocation}
			/>
		{:else}
			<div class="p-4 overflow-y-auto h-full">
				<ListView
					wingRatings={displayedRatings}
					onShowReview={handleShowReview}
					bind:sortBy={$sortBy}
					bind:sortOrder={$sortOrder}
				/>
			</div>
		{/if}
	</div>
</div>

<ReviewSlideout rating={selectedRating} onClose={closeSlideout} onVoteChange={handleVoteChange} />

<style>
	:global(body) {
		@apply bg-gray-100 dark:bg-gray-900;
	}
</style>
