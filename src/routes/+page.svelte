<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import Map from '$lib/components/Map.svelte';
	import ListView from '$lib/components/ListView.svelte';
	import ReviewSlideout from '$lib/components/ReviewSlideout.svelte';
	import AddReviewModal from '$lib/components/AddReviewModal.svelte';
	import SignInModal from '$lib/components/SignInModal.svelte';
	import UserDisplay from '$lib/components/UserDisplay.svelte';
	import SearchBar from '$lib/components/SearchBar.svelte';
	import Button from '$lib/components/Button.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl.svelte';
	import { writable } from 'svelte/store';
	import { faPlus, faList, faMap, faFilter, faSortAmountDown, faSortAmountUp } from '@fortawesome/free-solid-svg-icons';
	import Icon from 'svelte-fa';
	import type { Review, Vote, Location } from '$lib/components/review/types';
	import { 
		searchQuery,
		searchMode,
		searchResults,
		performSearch,
		clearSearch
	} from '$lib/stores/searchStore';

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
	
	// View toggle options
	const viewOptions = [
		{ value: 'map', label: 'Map', icon: faMap },
		{ value: 'list', label: 'List', icon: faList }
	];
	
	$: currentView = isMapView ? 'map' : 'list';

	let mapComponent: MapComponent;

	// Import the Map component type directly
	type MapComponent = InstanceType<typeof Map> & {
		zoomToLocation: (latitude: number, longitude: number, locationName: string) => void;
	};

	$: isSlideoutOpen = !!selectedReview;

	// Sorted reviews for list view
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

	function deg2rad(deg: number) {
		return deg * (Math.PI / 180);
	}

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
			console.log('Fetched data:', data?.length || 0, 'reviews');
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

	// Handle search completion from the SearchBar component
	function handleSearchComplete(event: CustomEvent<{ query: string, results: { locationMatches: any[], reviewMatches: Review[] } }>) {
		const { results } = event.detail;
		
		// Just log the search results - no automatic zooming
		console.log('Search completed:', {
			query: event.detail.query,
			locationMatches: results.locationMatches?.length || 0,
			reviewMatches: results.reviewMatches?.length || 0
		});
		
		// Do not automatically zoom or select results
		// Results will be shown in the dropdown for user to choose from
	}
	
	// Handle a specific review selection from the search results
	function handleResultSelect(event: CustomEvent<Review>) {
		// The event detail contains the selected review
		const review = event.detail;
		console.log('handleResultSelect triggered for review:', review.location.restaurant_name);
		console.log('Review coordinates:', review.location.latitude, review.location.longitude);
		
		// Make sure the coordinates are actually valid numbers
		if (typeof review.location.latitude !== 'number' || 
			typeof review.location.longitude !== 'number' ||
			isNaN(review.location.latitude) || 
			isNaN(review.location.longitude)) {
			console.error('Invalid coordinates for review:', review.location);
			return;
		}
		
		// Set the selected review (will be shown in the slideout)
		selectedReview = review;
		
		// Ensure the slideout is open to show the review
		isSlideoutOpen = true;
		
		// If we're not already in map view, switch to it and wait for the view to update
		const wasMapView = isMapView;
		if (!isMapView) {
			console.log('Switching to map view');
			isMapView = true;
		}
		
		// Guarantee we're using a proper delay based on whether view changed
		const zoomDelay = wasMapView ? 50 : 500; // Longer delay if view changed
		
		// Delay the zoom operation slightly to ensure the map is ready
		setTimeout(() => {
			console.log('Attempting to zoom after delay');
			
			// Check if map component is available
			console.log('Map component available?', !!mapComponent);
			
			if (mapComponent) {
				try {
					// Ensure coordinates are valid numbers
					const lat = Number(review.location.latitude);
					const lng = Number(review.location.longitude);
					console.log(`Zooming to: ${lat}, ${lng}, ${review.location.restaurant_name}`);
					
					// Call the zoom function
					mapComponent.zoomToLocation(
						lat, 
						lng, 
						review.location.restaurant_name
					);
					console.log('Zoom call completed');
				} catch (error) {
					console.error('Error zooming to location:', error);
				}
			} else {
				console.error('mapComponent is unavailable for zooming');
			}
		}, zoomDelay);
	}

	function handleAddReview() {
		if (user) {
			showAddReviewModal = true;
		} else {
			showSignInModal = true;
		}
	}

	// Handle review added from modal
	function handleAddReviewComplete(event: CustomEvent<{ review: Review }>) {
		console.log('Review added:', event.detail.review);
		showAddReviewModal = false;
		
		// Refresh reviews by refetching from the server
		// For now, just close the modal
		// TODO: Implement review refresh logic
	}

	// Filter reviews based on search results
	$: displayedReviews = $searchResults.reviewMatches.length > 0 && $searchQuery 
		? $searchResults.reviewMatches 
		: sortedReviews;

	function handleViewChange(view: string) {
		isMapView = view === 'map';
	}

	function toggleMapView() {
		isMapView = !isMapView;
	}

	function toggleSortOrder() {
		$sortOrder = $sortOrder === 'asc' ? 'desc' : 'asc';
	}

	// After the mapComponent binding, add additional console logging for debugging
	$: if (mapComponent) {
		console.log('mapComponent is bound and available');
	}
</script>

<svelte:head>
	<title>ChickenWing Map | Find the Best Wings</title>
	<meta name="description" content="Discover and rate the best chicken wings near you." />
</svelte:head>

<div class="bg-gray-50 dark:bg-gray-900 min-h-full">
	<div class="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
		<!-- Top Bar: Search, View Toggle, Add Review -->
		<div class="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center mb-6">
			<!-- Modern Search Bar -->
			<div class="flex-1">
				<SearchBar 
					{reviews}
					placeholder="Search for wing places or reviews..."
					showSearchModeToggle={true}
					on:search={handleSearchComplete}
					on:resultSelect={handleResultSelect}
				/>
			</div>

			<!-- Modern Controls -->
			<div class="flex items-center gap-3">
				<!-- Modern View Toggle -->
				<SegmentedControl 
					options={viewOptions}
					value={currentView}
					size="md"
					on:change={(e) => handleViewChange(e.detail)}
				/>

				<!-- Filter & Sort Dropdown -->
				<div class="relative">
					<Button 
						variant="outline" 
						size="md"
						on:click={() => showFilterMenu = !showFilterMenu}
					>
						<Icon icon={faFilter} class="h-4 w-4 mr-2" />
						Sort
					</Button>

					{#if showFilterMenu}
						<div class="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-[1001] overflow-hidden">
							<div class="py-2" role="menu" aria-orientation="vertical">
								<!-- Sort options header -->
								<div class="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800/50">
									Sort by
								</div>
								
								<!-- Sort options -->
								<button
									class="w-full text-left px-4 py-2.5 text-sm transition-colors {$sortBy === 'rating' ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20' : 'text-gray-700 dark:text-gray-300'} hover:bg-gray-50 dark:hover:bg-gray-800"
									on:click={() => { $sortBy = 'rating'; showFilterMenu = false; }}
								>
									Rating
								</button>
								<button
									class="w-full text-left px-4 py-2.5 text-sm transition-colors {$sortBy === 'name' ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20' : 'text-gray-700 dark:text-gray-300'} hover:bg-gray-50 dark:hover:bg-gray-800"
									on:click={() => { $sortBy = 'name'; showFilterMenu = false; }}
								>
									Restaurant Name
								</button>
								<button
									class="w-full text-left px-4 py-2.5 text-sm transition-colors {$sortBy === 'date' ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20' : 'text-gray-700 dark:text-gray-300'} hover:bg-gray-50 dark:hover:bg-gray-800"
									on:click={() => { $sortBy = 'date'; showFilterMenu = false; }}
								>
									Date Visited
								</button>
								{#if userLocation}
									<button
										class="w-full text-left px-4 py-2.5 text-sm transition-colors {$sortBy === 'distance' ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20' : 'text-gray-700 dark:text-gray-300'} hover:bg-gray-50 dark:hover:bg-gray-800"
										on:click={() => { $sortBy = 'distance'; showFilterMenu = false; }}
									>
										Distance
									</button>
								{/if}

								<!-- Divider -->
								<div class="border-t border-gray-200 dark:border-gray-700 my-2"></div>

								<!-- Order direction -->
								<button
									class="w-full text-left px-4 py-2.5 text-sm flex items-center justify-between text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
									on:click={() => { toggleSortOrder(); showFilterMenu = false; }}
								>
									<span>{$sortOrder === 'desc' ? 'Descending' : 'Ascending'}</span>
									<Icon icon={$sortOrder === 'desc' ? faSortAmountDown : faSortAmountUp} class="h-4 w-4" />
								</button>
							</div>
						</div>
					{/if}
				</div>

				<!-- Modern Add Review Button -->
				<Button 
					variant="primary" 
					size="md"
					on:click={handleAddReview}
				>
					<Icon icon={faPlus} class="h-4 w-4 mr-2" />
					Add Review
				</Button>
			</div>
		</div>

		<!-- Loading State -->
		{#if isLoading}
			<div class="flex flex-col justify-center items-center h-96 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
				<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
				<p class="mt-4 text-sm text-gray-600 dark:text-gray-400">Loading reviews...</p>
			</div>
		{:else}
			<!-- Main Content: Map or List View -->
			<div class="relative rounded-xl overflow-hidden shadow-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 h-[calc(100vh-12rem)] md:h-[calc(100vh-10rem)]">
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
						on:voteChanged={e => handleVoteChange(e.detail)}
					/>
				{/if}
			</div>
		{/if}
	</div>
</div>

{#if showAddReviewModal}
	<AddReviewModal
		show={showAddReviewModal}
		{user}
		onClose={() => (showAddReviewModal = false)}
		onReviewAdded={() => {
			showAddReviewModal = false;
		}}
	/>
{/if}

{#if showSignInModal}
	<SignInModal on:close={() => (showSignInModal = false)} />
{/if}

<svelte:window on:click={() => (showFilterMenu = false)} />

<style>
	:global(body) {
		@apply bg-gray-50 dark:bg-gray-900;
	}
	
	/* Utility classes for line clamping */
	:global(.line-clamp-2) {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	
	/* Modern form inputs */
	:global(.form-input) {
		@apply block w-full rounded-lg shadow-sm border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:border-primary-500 dark:focus:border-primary-400 focus:ring focus:ring-primary-500/20 dark:focus:ring-primary-400/20 focus:ring-opacity-50 transition-all duration-200;
	}
</style>
