<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import Map from '$lib/components/Map.svelte';
	import ListView from '$lib/components/ListView.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import ReviewSlideout from '$lib/components/ReviewSlideout.svelte';
	import AddReviewModal from '$lib/components/AddReviewModal.svelte';
	import SignInModal from '$lib/components/SignInModal.svelte';
	import { writable } from 'svelte/store';
	import { faSearch, faPlus } from '@fortawesome/free-solid-svg-icons';
	import Icon from 'svelte-fa';
	import { geocode } from '$lib/geocoding';
	import type { Review, Vote, Location } from '$lib/components/review/types';

	let reviews: Review[] = [];
	let isMapView = true;
	let isDarkMode = false;
	let isLoading = true;
	let selectedReview: Review | null = null;
	let userLocation: { latitude: number; longitude: number } | null = null;
	let user: any = null;
	let showAddReviewModal = false;
	let showSignInModal = false;
	let reviewFromListView = false;

	let sortBy = writable('rating');
	let sortOrder = writable('desc');

	let searchQuery = '';
	let noResultsFound = false;
	let mapComponent: MapComponent;
	let autocompleteResults: string[] = [];
	let showAutocomplete = false;

	// Import the Map component type directly
	type MapComponent = InstanceType<typeof Map> & {
		zoomToLocation: (latitude: number, longitude: number, locationName: string) => void;
	};

	$: isSlideoutOpen = !!selectedReview;

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

	$: sortedReviews = [...reviews].sort((a, b) => {
		const order = $sortOrder === 'asc' ? 1 : -1;
		switch ($sortBy) {
			case 'rating':
				return (parseFloat(b.rating) - parseFloat(a.rating)) * order;
			case 'name':
				return a.location.restaurant_name.localeCompare(b.location.restaurant_name) * order;
			case 'date':
				return (new Date(b.date_visited).getTime() - new Date(a.date_visited).getTime()) * order;
			case 'distance':
				if (userLocation) {
					const distanceA = calculateDistance(
						userLocation.latitude,
						userLocation.longitude,
						a.location.latitude,
						a.location.longitude
					);
					const distanceB = calculateDistance(
						userLocation.latitude,
						userLocation.longitude,
						b.location.latitude,
						b.location.longitude
					);
					return (distanceA - distanceB) * order;
				}
				return 0;
			default:
				return 0;
		}
	});

	function applyTheme() {
		if (isDarkMode) {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
		localStorage.setItem('darkMode', isDarkMode.toString());
	}

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

		fetchReviews();
		getUserLocation();
	});

	async function fetchReviews() {
		isLoading = true;
		console.log('=== FETCHING REVIEWS ===');

		// Get reviews with locations and votes
		const { data, error } = await supabase
			.from('reviews')
			.select(`
				*,
				location:locations(*),
				votes (
					vote_type,
					user_id
				)
			`);

		if (error) {
			console.error('Error fetching reviews:', error);
		} else {
			console.log('Fetched data:', JSON.stringify(data, null, 2));
			const currentLocation = userLocation;
			
			// Process reviews to include vote counts and map to Review type
			reviews = (data || []).map((review: any) => ({
				id: review.id,
				location_id: review.location_id,
				user_id: review.user_id,
				review: review.review,
				rating: review.rating,
				date_visited: review.date_visited,
				location: review.location,
				upvotes_count: review.votes?.filter((v: Vote) => v.vote_type === 'up').length || 0,
				downvotes_count: review.votes?.filter((v: Vote) => v.vote_type === 'down').length || 0,
				votes: review.votes,
				distance: currentLocation ? calculateDistance(
					currentLocation.latitude,
					currentLocation.longitude,
					review.location.latitude,
					review.location.longitude
				) : undefined,
				website_url: review.website_url,
				experience_details: {
					moodComparison: review.mood_comparison,
					beerInfluence: review.beer_influence,
					isTakeout: review.is_takeout,
					wingsPerOrder: review.wings_per_order,
					wingSize: review.wing_size,
					wingFormat: review.wing_format,
					takeoutContainer: review.takeout_container,
					takeoutWaitTime: review.takeout_wait_time
				},
				sauce_details: {
					sauceAvailability: review.sauce_availability,
					selectedSauces: review.selected_sauces || []
				},
				ratings: {
					appearance: review.appearance_rating,
					aroma: review.aroma_rating,
					sauceQuantity: review.sauce_quantity_rating,
					sauceConsistency: review.sauce_consistency_rating,
					sauceHeat: review.sauce_heat_rating,
					skinConsistency: review.skin_consistency_rating,
					meatQuality: review.meat_quality_rating,
					greasiness: review.greasiness_rating,
					blueCheeseQuality: review.blue_cheese_quality_rating,
					blueCheeseNA: review.blue_cheese_na,
					satisfactionScore: review.satisfaction_score,
					recommendationScore: review.recommendation_score
				}
			}));
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
					if (reviews.length > 0) {
						reviews = reviews.map((review) => ({
							...review,
							distance: calculateDistance(
								newUserLocation.latitude,
								newUserLocation.longitude,
								review.location.latitude,
								review.location.longitude
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

	function handleShowReview(review: Review) {
		selectedReview = review ? { ...review } : null;
		reviewFromListView = !isMapView;
	}

	function closeSlideout() {
		selectedReview = null;
		reviewFromListView = false;
	}

	function handleVoteChange(updatedReview: Review) {
		// Update the review in the reviews array without fetching
		reviews = reviews.map(r => {
			if (r.id === updatedReview.id) {
				return {
					...r,
					upvotes_count: updatedReview.upvotes_count,
					downvotes_count: updatedReview.downvotes_count,
					votes: updatedReview.votes
				};
			}
			return r;
		});

		// Update selectedReview if it's the one that changed
		if (selectedReview && selectedReview.id === updatedReview.id) {
			selectedReview = {
				...selectedReview,
				upvotes_count: updatedReview.upvotes_count,
				downvotes_count: updatedReview.downvotes_count,
				votes: updatedReview.votes
			};
		}
	}

	async function handleSearch() {
		showAutocomplete = false;
		if (!searchQuery.trim()) return;

		// First try to find matching restaurant names
		const matchingReview = reviews.find((review) =>
			review.location.restaurant_name.toLowerCase().includes(searchQuery.toLowerCase())
		);

		if (matchingReview && mapComponent) {
			mapComponent.zoomToLocation(
				matchingReview.location.latitude,
				matchingReview.location.longitude,
				matchingReview.location.restaurant_name
			);
			noResultsFound = false;
			return;
		}

		// If no matching restaurant, try geocoding the search query
		const location = await geocode(searchQuery);
		if (location && mapComponent) {
			mapComponent.zoomToLocation(location.latitude, location.longitude, searchQuery);
			noResultsFound = false;
		} else {
			noResultsFound = true;
		}
	}

	function handleAddReview() {
		if (user) {
			showAddReviewModal = true;
		} else {
			showSignInModal = true;
		}
	}

	function updateAutocomplete() {
		if (searchQuery.length > 0) {
			// Get unique restaurant names that match the search query
			const matchingNames = [...new Set(reviews
				.map((review) => review.location.restaurant_name))]
				.filter((name) => name.toLowerCase().includes(searchQuery.toLowerCase()));

			// Get unique addresses that match the search query
			const matchingAddresses = [...new Set(reviews
				.map((review) => review.location.address))]
				.filter((address) => address.toLowerCase().includes(searchQuery.toLowerCase()));

			// Combine and limit results
			autocompleteResults = [...matchingNames, ...matchingAddresses].slice(0, 5);
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

	// Filter reviews based on search query
	$: filteredReviews = searchQuery
		? sortedReviews.filter(review => 
				review.location.restaurant_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				review.location.address.toLowerCase().includes(searchQuery.toLowerCase()))
		: sortedReviews;

	$: displayedReviews = filteredReviews;

	$: {
		if (!isMapView) {
			noResultsFound = displayedReviews.length === 0 && searchQuery !== '';
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
				<div class="relative">
					<input
						type="text"
						on:keypress={handleKeyPress}
						bind:value={searchQuery}
						on:input={updateAutocomplete}
						placeholder="Search places by restaurant name or city"
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
				on:click={handleAddReview}
				class="p-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center whitespace-nowrap"
			>
				<Icon icon={faPlus} class="mr-2" />
				<span>Add Review</span>
			</button>
		</div>

		{#if noResultsFound}
			<p class="text-red-500 mt-2">No places found matching your search.</p>
		{/if}
	</div>

	<div class="relative h-[calc(100vh-300px)] sm:h-[calc(100vh-340px)]">
		{#if isLoading}
			<p class="p-4">Loading reviews...</p>
		{:else if reviews.length === 0}
			<p class="p-4">
				No reviews found. <button on:click={fetchReviews} class="text-blue-500"
					>Refresh</button
				>
			</p>
		{:else if isMapView}
			<Map
				bind:this={mapComponent}
				reviews={displayedReviews}
				onMarkerClick={handleShowReview}
				{isSlideoutOpen}
				{userLocation}
			/>
		{:else}
			<div class="p-4 overflow-y-auto h-full">
				<ListView
					reviews={displayedReviews}
					onShowReview={handleShowReview}
					bind:sortBy={$sortBy}
					bind:sortOrder={$sortOrder}
				/>
			</div>
		{/if}
	</div>
</div>

<ReviewSlideout 
	review={selectedReview} 
	onClose={closeSlideout} 
	{handleVoteChange}
	fromListView={reviewFromListView}
/>
<AddReviewModal 
	show={showAddReviewModal} 
	onClose={() => showAddReviewModal = false} 
	onReviewAdded={fetchReviews} 
/>
<SignInModal
	show={showSignInModal}
	onClose={() => showSignInModal = false}
/>

<style>
	:global(body) {
		@apply bg-gray-100 dark:bg-gray-900;
	}
</style>
