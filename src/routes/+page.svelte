<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import Map from '$lib/components/Map.svelte';
	import ListView from '$lib/components/ListView.svelte';
	import ReviewSlideout from '$lib/components/ReviewSlideout.svelte';
	import AddReviewModal from '$lib/components/AddReviewModal.svelte';
	import SignInModal from '$lib/components/SignInModal.svelte';
	import UserDisplay from '$lib/components/UserDisplay.svelte';
	import { writable } from 'svelte/store';
	import { faSearch, faPlus, faList, faMap, faFilter, faSortAmountDown, faSortAmountUp, faTimes } from '@fortawesome/free-solid-svg-icons';
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
	let showFilterMenu = false;

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

	// Watch for changes to the selectedReview object and update the reviews array
	$: if (selectedReview) {
		// Update the review in the reviews array when selectedReview changes
		reviews = reviews.map(r => {
			if (r.id === selectedReview?.id) {
				return {
					...r,
					upvotes_count: selectedReview.upvotes_count,
					downvotes_count: selectedReview.downvotes_count,
					votes: selectedReview.votes
				};
			}
			return r;
		});
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

	function handleSearch() {
		console.log("Search query:", searchQuery);
		if (!searchQuery.trim()) {
			noResultsFound = false;
			return;
		}

		geocode(searchQuery).then((location) => {
			if (location) {
				if (mapComponent) {
					mapComponent.zoomToLocation(location.latitude, location.longitude, searchQuery);
				}
				noResultsFound = false;
			} else {
				console.log("No results found");
				noResultsFound = true;
			}
		}).catch(error => {
			console.error("Geocoding error:", error);
			noResultsFound = true;
		}).finally(() => {
			showAutocomplete = false;
		});
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

	function toggleMapView() {
		isMapView = !isMapView;
	}

	function toggleSortOrder() {
		$sortOrder = $sortOrder === 'asc' ? 'desc' : 'asc';
	}

	function handleAddReviewComplete(event: CustomEvent<{ review: Review }>) {
		const newReview = event.detail.review;
		reviews = [...reviews, newReview];
		showAddReviewModal = false;
	}
</script>

<svelte:head>
	<title>ChickenWing Map | Find the Best Wings</title>
	<meta name="description" content="Discover and rate the best chicken wings near you." />
</svelte:head>

<div class="bg-gray-50 dark:bg-gray-900 min-h-full">
	<div class="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
		<!-- Top Bar: Search, View Toggle, Add Review -->
		<div class="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center mb-4">
			<!-- Search Bar -->
			<div class="relative flex-grow">
				<div class="relative rounded-md shadow-sm">
					<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
						<Icon icon={faSearch} class="h-5 w-5 text-gray-400" />
					</div>
					<input
						type="text"
						class="form-input pl-10 py-2"
						placeholder="Search locations..."
						bind:value={searchQuery}
						on:keypress={handleKeyPress}
					/>
					{#if searchQuery.length > 0}
						<div class="absolute inset-y-0 right-0 pr-3 flex items-center">
							<button
								class="text-gray-400 hover:text-gray-500 focus:outline-none"
								on:click={() => {
									searchQuery = '';
									noResultsFound = false;
								}}
							>
								<Icon icon={faTimes} class="h-5 w-5" />
							</button>
						</div>
					{/if}
				</div>
				{#if noResultsFound}
					<div class="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 shadow-lg rounded-md py-1 px-2 text-sm text-error-500">
						No results found for "{searchQuery}"
					</div>
				{/if}
				{#if showAutocomplete && autocompleteResults.length > 0}
					<div class="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 shadow-lg rounded-md py-1">
						{#each autocompleteResults as result}
							<button
								class="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
								on:click={() => {
									searchQuery = result;
									showAutocomplete = false;
									handleSearch();
								}}
							>
								{result}
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Controls: View Toggle, Sort, and Add -->
			<div class="flex space-x-2">
				<!-- View Toggle Button -->
				<button 
					class="btn-secondary flex items-center" 
					on:click={toggleMapView}
					aria-label={isMapView ? "Switch to list view" : "Switch to map view"}
				>
					<Icon icon={isMapView ? faList : faMap} class="h-5 w-5 mr-2" />
					<span>{isMapView ? "List" : "Map"}</span>
				</button>

				<!-- Filter & Sort Dropdown -->
				<div class="relative">
					<button 
						class="btn-secondary flex items-center" 
						on:click={() => showFilterMenu = !showFilterMenu}
						aria-label="Filter and sort options"
					>
						<Icon icon={faFilter} class="h-5 w-5 mr-2" />
						<span>Sort</span>
					</button>

					{#if showFilterMenu}
						<div class="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-30">
							<div class="py-1" role="menu" aria-orientation="vertical">
								<!-- Sort options -->
								<div class="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
									Sort by
								</div>
								<button
									class="w-full text-left px-4 py-2 text-sm {$sortBy === 'rating' ? 'text-primary-600 dark:text-primary-400 bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-300'} hover:bg-gray-100 dark:hover:bg-gray-700"
									on:click={() => { $sortBy = 'rating'; }}
								>
									Rating
								</button>
								<button
									class="w-full text-left px-4 py-2 text-sm {$sortBy === 'name' ? 'text-primary-600 dark:text-primary-400 bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-300'} hover:bg-gray-100 dark:hover:bg-gray-700"
									on:click={() => { $sortBy = 'name'; }}
								>
									Restaurant Name
								</button>
								<button
									class="w-full text-left px-4 py-2 text-sm {$sortBy === 'date' ? 'text-primary-600 dark:text-primary-400 bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-300'} hover:bg-gray-100 dark:hover:bg-gray-700"
									on:click={() => { $sortBy = 'date'; }}
								>
									Date Visited
								</button>
								{#if userLocation}
									<button
										class="w-full text-left px-4 py-2 text-sm {$sortBy === 'distance' ? 'text-primary-600 dark:text-primary-400 bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-300'} hover:bg-gray-100 dark:hover:bg-gray-700"
										on:click={() => { $sortBy = 'distance'; }}
									>
										Distance
									</button>
								{/if}

								<!-- Divider -->
								<div class="border-t border-gray-200 dark:border-gray-700 my-1"></div>

								<!-- Order direction -->
								<button
									class="w-full text-left px-4 py-2 text-sm flex items-center justify-between text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
									on:click={toggleSortOrder}
								>
									<span>{$sortOrder === 'desc' ? 'Descending' : 'Ascending'}</span>
									<Icon icon={$sortOrder === 'desc' ? faSortAmountDown : faSortAmountUp} class="h-4 w-4" />
								</button>
							</div>
						</div>
					{/if}
				</div>

				<!-- Add Review Button -->
				<button class="btn-primary flex items-center" on:click={handleAddReview} aria-label="Add a new review">
					<Icon icon={faPlus} class="h-5 w-5 mr-2" />
					<span>Add</span>
				</button>
			</div>
		</div>

		<!-- Loading State -->
		{#if isLoading}
			<div class="flex justify-center items-center h-96">
				<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
			</div>
		{:else}
			<!-- Main Content: Map or List View -->
			<div class="relative rounded-lg overflow-hidden shadow-md bg-white dark:bg-gray-800 h-[calc(100vh-12rem)] md:h-[calc(100vh-10rem)]">
				{#if isMapView}
					<Map
						bind:this={mapComponent}
						{reviews}
						onMarkerClick={handleShowReview}
						{isSlideoutOpen}
						{userLocation}
					/>
				{:else}
					<ListView
						reviews={sortedReviews}
						{userLocation}
						onItemClick={handleShowReview}
						selectedReviewId={selectedReview?.id}
					/>
				{/if}
				
				{#if selectedReview}
					<ReviewSlideout
						review={selectedReview}
						{closeSlideout}
						{user}
						fromListView={reviewFromListView}
					/>
				{/if}
			</div>
		{/if}
	</div>
</div>

{#if showAddReviewModal}
	<AddReviewModal
		{user}
		on:close={() => (showAddReviewModal = false)}
		on:reviewAdded={handleAddReviewComplete}
	/>
{/if}

{#if showSignInModal}
	<SignInModal on:close={() => (showSignInModal = false)} />
{/if}

<svelte:window on:click={() => (showFilterMenu = false)} />

<style>
	:global(body) {
		@apply bg-gray-100 dark:bg-gray-900;
	}
</style>
