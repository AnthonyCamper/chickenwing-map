<script lang="ts">
	import { fly, slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { faTimes, faArrowLeft, faArrowRight, faSave, faCheck } from '@fortawesome/free-solid-svg-icons';
	import Icon from 'svelte-fa';
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';

	export let show = false;
	export let onClose: () => void;
	export let onReviewAdded: () => void;
	export let user: any = null;
	export let draftId: string | null = null; // For editing existing drafts

	// Steps configuration with better UX descriptions
	const TOTAL_STEPS = 5;
	const STEP_CONFIG = [
		{
			title: 'Basic Info',
			description: 'Where did you go?',
			subtext: 'Let\'s start with the basics about your wing adventure',
			icon: '🏪'
		},
		{
			title: 'Experience',
			description: 'Tell us about your visit',
			subtext: 'What was the setting and context of your meal?',
			icon: '🍽️'
		},
		{
			title: 'Sauces',
			description: 'Let\'s talk sauce',
			subtext: 'What sauce options were available and what did you try?',
			icon: '🌶️'
		},
		{
			title: 'Ratings',
			description: 'Rate your experience',
			subtext: 'Give us the details - this is what makes your review valuable!',
			icon: '⭐'
		},
		{
			title: 'Review',
			description: 'Final thoughts',
			subtext: 'Share any additional details about your wing experience',
			icon: '✍️'
		}
	];

	let currentStep = 1;
	let isLoading = false;
	let error = '';
	let saveTimeout: NodeJS.Timeout;

	// Form data - matching the database schema
	let formData = {
		title: '',
		restaurantName: '',
		address: '',
		dateVisited: new Date().toISOString().split('T')[0],
		websiteUrl: '',
		latitude: null as number | null,
		longitude: null as number | null,

		// Experience Details
		moodComparison: 0,
		beerInfluence: false,
		isTakeout: false,
		wingsPerOrder: 10,
		wingSize: 2,
		wingFormat: 'Fried',
		takeoutContainer: 'Styrofoam',
		takeoutWaitTime: 15,

		// Sauce Information
		sauceAvailability: true,
		selectedSauces: [] as string[],

		// Ratings
		appearance: 5,
		aroma: 5,
		sauceQuantity: 5,
		sauceConsistency: 5,
		sauceHeat: 5,
		skinConsistency: 5,
		meatQuality: 5,
		greasiness: 3,
		blueCheeseQuality: 5,
		blueCheeseNA: false,
		satisfactionScore: 3,
		recommendationScore: 7,

		// Review Notes
		reviewNotes: ''
	};

	let coordinates: { latitude: number; longitude: number } | null = null;
	let lastSaveTime: Date | null = null;

	// Enhanced validation with helpful error messages
	let validationErrors: Record<string, string> = {};

	function validateStep(step: number): boolean {
		const errors: Record<string, string> = {};

		switch (step) {
			case 1:
				if (!formData.restaurantName.trim()) {
					errors.restaurantName = 'Restaurant name is required';
				}
				if (!formData.address.trim()) {
					errors.address = 'Address is required';
				}
				validationErrors = errors;
				return Object.keys(errors).length === 0;
			case 2:
				return true; // Experience step has defaults, so always valid
			case 3:
				return true; // Sauce step has defaults, so always valid
			case 4:
				return true; // Ratings have defaults, so always valid
			case 5:
				// Final validation check
				if (!coordinates) {
					errors.coordinates = 'Please verify the restaurant address before submitting';
					validationErrors = errors;
					return false;
				}
				return true;
			default:
				return false;
		}
	}

	// Reactive validation for current step to update button states
	$: isCurrentStepValid = (() => {
		switch (currentStep) {
			case 1:
				return !!(formData.restaurantName.trim() && formData.address.trim());
			case 2:
				return true;
			case 3:
				return true;
			case 4:
				return true;
			case 5:
				return !!coordinates;
			default:
				return false;
		}
	})();

	// Auto-save draft functionality
	async function saveDraft() {
		if (!user) return;

		try {
			const draftData = {
				user_id: user.id,
				title: formData.title || generateDraftTitle(),
				current_step: currentStep,
				restaurant_name: formData.restaurantName,
				address: formData.address,
				latitude: coordinates?.latitude || null,
				longitude: coordinates?.longitude || null,
				date_visited: formData.dateVisited,
				website_url: formData.websiteUrl || null,
				mood_comparison: formData.moodComparison,
				beer_influence: formData.beerInfluence,
				is_takeout: formData.isTakeout,
				wings_per_order: formData.wingsPerOrder,
				wing_size: formData.wingSize,
				wing_format: formData.wingFormat,
				takeout_container: formData.takeoutContainer,
				takeout_wait_time: formData.takeoutWaitTime,
				sauce_availability: formData.sauceAvailability,
				selected_sauces: formData.selectedSauces,
				appearance_rating: formData.appearance,
				aroma_rating: formData.aroma,
				sauce_quantity_rating: formData.sauceQuantity,
				sauce_consistency_rating: formData.sauceConsistency,
				sauce_heat_rating: formData.sauceHeat,
				skin_consistency_rating: formData.skinConsistency,
				meat_quality_rating: formData.meatQuality,
				greasiness_rating: formData.greasiness,
				blue_cheese_quality_rating: formData.blueCheeseNA ? null : formData.blueCheeseQuality,
				blue_cheese_na: formData.blueCheeseNA,
				satisfaction_score: formData.satisfactionScore,
				recommendation_score: formData.recommendationScore,
				review: formData.reviewNotes || null
			};

			if (draftId) {
				// Update existing draft
				const { error } = await supabase
					.from('draft_reviews')
					.update(draftData)
					.eq('id', draftId);

				if (!error) {
					lastSaveTime = new Date();
				}
			} else {
				// Create new draft
				const { data, error } = await supabase
					.from('draft_reviews')
					.insert([draftData])
					.select('id')
					.single();

				if (!error && data) {
					draftId = data.id;
					lastSaveTime = new Date();
				}
			}
		} catch (err) {
			console.error('Failed to save draft:', err);
		}
	}

	// Generate a friendly draft title
	function generateDraftTitle(): string {
		if (formData.restaurantName) {
			return `Draft: ${formData.restaurantName}`;
		}
		const date = new Date().toLocaleDateString();
		return `Draft from ${date}`;
	}

	// Debounced auto-save
	function scheduleAutoSave() {
		if (saveTimeout) clearTimeout(saveTimeout);
		saveTimeout = setTimeout(saveDraft, 2000);
	}

	// Watch for changes to trigger auto-save
	$: {
		if (show && user && (formData.restaurantName || formData.address || formData.reviewNotes)) {
			scheduleAutoSave();
		}
	}

	// Load draft data if editing
	onMount(async () => {
		if (draftId && user) {
			try {
				const { data, error } = await supabase
					.from('draft_reviews')
					.select('*')
					.eq('id', draftId)
					.eq('user_id', user.id)
					.single();

				if (data && !error) {
					// Load draft data into form
					currentStep = data.current_step || 1;
					formData.title = data.title || '';
					formData.restaurantName = data.restaurant_name || '';
					formData.address = data.address || '';
					if (data.latitude && data.longitude) {
						coordinates = { latitude: data.latitude, longitude: data.longitude };
					}
					formData.dateVisited = data.date_visited || new Date().toISOString().split('T')[0];
					formData.websiteUrl = data.website_url || '';
					formData.moodComparison = data.mood_comparison || 0;
					formData.beerInfluence = data.beer_influence || false;
					formData.isTakeout = data.is_takeout || false;
					formData.wingsPerOrder = data.wings_per_order || 10;
					formData.wingSize = data.wing_size || 2;
					formData.wingFormat = data.wing_format || 'Fried';
					formData.takeoutContainer = data.takeout_container || 'Styrofoam';
					formData.takeoutWaitTime = data.takeout_wait_time || 15;
					formData.sauceAvailability = data.sauce_availability !== false; // Default to true
					formData.selectedSauces = data.selected_sauces || [];
					formData.appearance = data.appearance_rating || 5;
					formData.aroma = data.aroma_rating || 5;
					formData.sauceQuantity = data.sauce_quantity_rating || 5;
					formData.sauceConsistency = data.sauce_consistency_rating || 5;
					formData.sauceHeat = data.sauce_heat_rating || 5;
					formData.skinConsistency = data.skin_consistency_rating || 5;
					formData.meatQuality = data.meat_quality_rating || 5;
					formData.greasiness = data.greasiness_rating || 3;
					formData.blueCheeseQuality = data.blue_cheese_quality_rating || 5;
					formData.blueCheeseNA = data.blue_cheese_na || false;
					formData.satisfactionScore = data.satisfaction_score || 3;
					formData.recommendationScore = data.recommendation_score || 7;
					formData.reviewNotes = data.review || '';
				}
			} catch (err) {
				console.error('Failed to load draft:', err);
			}
		}
	});

	// Navigation functions
	function nextStep() {
		if (currentStep < TOTAL_STEPS && validateStep(currentStep)) {
			currentStep++;
			saveDraft(); // Save when moving forward
		}
	}

	function prevStep() {
		if (currentStep > 1) {
			currentStep--;
		}
	}

	function goToStep(step: number) {
		currentStep = step;
	}

	// Geocoding function (simplified version from original)
	async function geocodeAddress() {
		if (!formData.address) return;

		try {
			const response = await fetch(
				`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(formData.address)}&limit=1`
			);
			const data = await response.json();

			if (data && data.length > 0) {
				coordinates = {
					latitude: parseFloat(data[0].lat),
					longitude: parseFloat(data[0].lon)
				};
				error = '';
			} else {
				error = 'Could not find the address. Please verify it\'s correct.';
			}
		} catch (err) {
			error = 'Failed to verify address. Please check your internet connection.';
		}
	}

	// Calculate overall rating
	function calculateOverallRating(): number {
		const ratings = [
			formData.appearance,
			formData.aroma,
			formData.sauceQuantity,
			formData.sauceConsistency,
			formData.sauceHeat,
			formData.skinConsistency,
			formData.meatQuality,
			formData.greasiness,
			formData.blueCheeseNA ? null : formData.blueCheeseQuality,
			formData.satisfactionScore,
			formData.recommendationScore
		].filter((rating) => rating !== null);

		if (ratings.length === 0) return 0;

		const sum = ratings.reduce((acc, rating) => acc + rating, 0);
		const average = sum / ratings.length;

		return Math.round(average * 10) / 10;
	}

	// Submit final review
	async function submitReview() {
		try {
			isLoading = true;
			error = '';

			if (!coordinates) {
				error = 'Please verify the restaurant address';
				return;
			}

			const {
				data: { user: currentUser },
				error: userError
			} = await supabase.auth.getUser();

			if (userError || !currentUser) {
				error = 'You must be signed in to add a review';
				return;
			}

			// Check authorization (same as original)
			const { data: authorizedUser, error: authError } = await supabase
				.from('authorized_users')
				.select('user_id, can_add_reviews, is_admin')
				.eq('user_id', currentUser.id)
				.single();

			if (authError || !authorizedUser || (!authorizedUser.can_add_reviews && !authorizedUser.is_admin)) {
				error = 'You are not authorized to add reviews. Please contact an administrator.';
				return;
			}

			// Check/create location
			const { data: existingLocation, error: locationError } = await supabase
				.from('locations')
				.select('id')
				.eq('restaurant_name', formData.restaurantName)
				.eq('address', formData.address)
				.single();

			let locationId: number;

			if (!existingLocation) {
				const { data: newLocation, error: insertLocationError } = await supabase
					.from('locations')
					.insert([{
						restaurant_name: formData.restaurantName,
						address: formData.address,
						latitude: coordinates.latitude,
						longitude: coordinates.longitude
					}])
					.select('id')
					.single();

				if (insertLocationError) throw insertLocationError;
				locationId = newLocation.id;
			} else {
				locationId = existingLocation.id;
			}

			// Insert review
			// Use the user's input rating instead of calculated rating
			const overallRating = formData.rating || 0;
			const { error: insertReviewError } = await supabase.from('reviews').insert([{
				location_id: locationId,
				user_id: currentUser.id,
				review: formData.reviewNotes,
				rating: overallRating.toString(),
				date_visited: formData.dateVisited,
				website_url: formData.websiteUrl,
				mood_comparison: formData.moodComparison,
				beer_influence: Boolean(formData.beerInfluence),
				is_takeout: Boolean(formData.isTakeout),
				wing_format: formData.wingFormat,
				wings_per_order: formData.wingsPerOrder,
				wing_size: formData.wingSize,
				sauce_availability: Boolean(formData.sauceAvailability),
				selected_sauces: formData.selectedSauces,
				appearance_rating: formData.appearance,
				aroma_rating: formData.aroma,
				sauce_quantity_rating: formData.sauceQuantity,
				sauce_consistency_rating: formData.sauceConsistency,
				sauce_heat_rating: formData.sauceHeat,
				skin_consistency_rating: formData.skinConsistency,
				meat_quality_rating: formData.meatQuality,
				greasiness_rating: formData.greasiness,
				blue_cheese_quality_rating: formData.blueCheeseNA ? null : formData.blueCheeseQuality,
				blue_cheese_na: Boolean(formData.blueCheeseNA),
				satisfaction_score: formData.satisfactionScore,
				recommendation_score: formData.recommendationScore,
				takeout_container: formData.isTakeout ? formData.takeoutContainer : null,
				takeout_wait_time: formData.isTakeout ? formData.takeoutWaitTime : null
			}]);

			if (insertReviewError) {
				console.error('Review insertion error:', insertReviewError);
				throw new Error(`Failed to insert review: ${insertReviewError.message || insertReviewError.details || insertReviewError}`);
			}

			// Delete draft after successful submission
			if (draftId) {
				await supabase.from('draft_reviews').delete().eq('id', draftId);
			}

			onReviewAdded();
			onClose();

		} catch (err) {
			console.error('Submission error:', err);
			error = err instanceof Error ? err.message : 'An error occurred while adding the review';
		} finally {
			isLoading = false;
		}
	}

	function handleClose() {
		saveDraft(); // Save before closing
		onClose();
	}

	// Manage body scroll lock
	$: {
		if (typeof document !== 'undefined') {
			if (show) {
				document.body.classList.add('modal-open');
			} else {
				document.body.classList.remove('modal-open');
			}
		}
	}
</script>

{#if show}
	<div class="modal-container" transition:fly={{ y: 20, duration: 300 }}>
		<div class="modal-overlay" on:click={handleClose} on:keydown={(e) => e.key === 'Enter' && handleClose()} role="button" tabindex="0" aria-label="Close review form"></div>
		<div class="modal-content">
			<!-- Header with Progress -->
			<div class="modal-header">
				<div class="flex justify-between items-start mb-6">
					<div class="flex-1">
						<div class="flex items-center mb-2">
							<span class="text-2xl mr-3">{STEP_CONFIG[currentStep - 1].icon}</span>
							<div>
								<h2 class="text-2xl font-bold text-gray-900 dark:text-white">
									{STEP_CONFIG[currentStep - 1].description}
								</h2>
								<p class="text-sm text-gray-500 dark:text-gray-400">
									Step {currentStep} of {TOTAL_STEPS}
								</p>
							</div>
						</div>
					</div>
					<button class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-full" on:click={handleClose} aria-label="Close modal">
						<Icon icon={faTimes} />
					</button>
				</div>

				<!-- Progress Bar -->
				<div class="progress-container mb-6">
					<div class="progress-bar">
						<div class="progress-fill" style="width: {(currentStep / TOTAL_STEPS) * 100}%"></div>
					</div>
					<div class="step-indicators">
						{#each STEP_CONFIG as stepConfig, i}
							<div class="step-indicator-container">
								<button
									class="step-indicator {currentStep > i + 1 ? 'completed' : currentStep === i + 1 ? 'current' : 'upcoming'}"
									on:click={() => goToStep(i + 1)}
									disabled={i + 1 > currentStep && !isCurrentStepValid}
									aria-label="Go to step {i + 1}: {stepConfig.title}"
									title="{stepConfig.title}"
								>
									{#if currentStep > i + 1}
										<Icon icon={faCheck} class="w-3 h-3" />
									{:else}
										<span class="step-icon">{stepConfig.icon}</span>
									{/if}
								</button>
								<span class="step-label">{stepConfig.title}</span>
							</div>
						{/each}
					</div>
				</div>

				<!-- Auto-save Status -->
				{#if lastSaveTime}
					<div class="flex items-center text-xs text-gray-500 dark:text-gray-400 mb-4">
						<Icon icon={faSave} class="w-3 h-3 mr-1" />
						Draft saved {lastSaveTime.toLocaleTimeString()}
					</div>
				{/if}
			</div>

			{#if error}
				<div class="error-message mb-4">
					{error}
				</div>
			{/if}

			<!-- Step Content -->
			<div class="step-content">
				{#if currentStep === 1}
					<div class="step-section" transition:slide={{ duration: 200, easing: cubicOut }}>
						<div class="step-intro">
							<p class="step-subtitle">{STEP_CONFIG[currentStep - 1].subtext}</p>
						</div>

						<div class="form-grid">
							<div class="form-group">
								<label for="restaurantName" class="form-label required">Restaurant Name</label>
								<input
									type="text"
									id="restaurantName"
									class="form-input {validationErrors.restaurantName ? 'error' : ''}"
									bind:value={formData.restaurantName}
									placeholder="e.g. Buffalo Wild Wings"
									required
									aria-describedby={validationErrors.restaurantName ? 'restaurantName-error' : undefined}
								/>
								{#if validationErrors.restaurantName}
									<p id="restaurantName-error" class="field-error">{validationErrors.restaurantName}</p>
								{/if}
							</div>

							<div class="form-group">
								<label for="address" class="form-label required">Address</label>
								<div class="address-input-group">
									<input
										type="text"
										id="address"
										class="form-input {validationErrors.address ? 'error' : ''}"
										bind:value={formData.address}
										placeholder="123 Main St, City, State"
										required
										aria-describedby={validationErrors.address ? 'address-error' : undefined}
									/>
									<button
										type="button"
										class="btn-verify"
										on:click={geocodeAddress}
										disabled={!formData.address.trim()}
										aria-label="Verify address location"
									>
										{#if isLoading}
											<span class="inline-block animate-spin">↻</span>
										{:else}
											Verify
										{/if}
									</button>
								</div>
								{#if coordinates}
									<div class="success-message">
										<Icon icon={faCheck} class="w-4 h-4 mr-1" />
										Address verified
									</div>
								{/if}
								{#if validationErrors.address}
									<p id="address-error" class="field-error">{validationErrors.address}</p>
								{/if}
							</div>

							<div class="form-group">
								<label for="dateVisited" class="form-label">Date Visited</label>
								<input type="date" id="dateVisited" class="form-input" bind:value={formData.dateVisited} />
							</div>

							<div class="form-group">
								<label for="websiteUrl" class="form-label">Website (Optional)</label>
								<input type="url" id="websiteUrl" class="form-input" bind:value={formData.websiteUrl} placeholder="https://..." />
							</div>
						</div>
					</div>
				{:else if currentStep === 2}
					<div class="step-section" transition:slide={{ duration: 200, easing: cubicOut }}>
						<div class="step-intro">
							<p class="step-subtitle">{STEP_CONFIG[currentStep - 1].subtext}</p>
						</div>

						<div class="form-grid">
							<div class="form-group">
								<label class="form-label">Dining Style</label>
								<div class="radio-group">
									<label class="radio-option">
										<input type="radio" bind:group={formData.isTakeout} value={false} />
										<span>Dine-in</span>
									</label>
									<label class="radio-option">
										<input type="radio" bind:group={formData.isTakeout} value={true} />
										<span>Takeout</span>
									</label>
								</div>
							</div>

							<div class="form-group">
								<label for="wingsPerOrder" class="form-label">Wings per Order</label>
								<input type="number" id="wingsPerOrder" class="form-input" bind:value={formData.wingsPerOrder} min="1" max="100" />
							</div>

							<div class="form-group">
								<label class="form-label">Wing Size</label>
								<div class="size-buttons">
									{#each ['XS', 'S', 'M', 'L', 'XL'] as size, i}
										<button
											type="button"
											class="size-button {formData.wingSize === i + 1 ? 'selected' : ''}"
											on:click={() => formData.wingSize = i + 1}
											aria-label="Wing size {size}"
										>
											{size}
										</button>
									{/each}
								</div>
								<div class="size-label">Size: {['Extra Small', 'Small', 'Medium', 'Large', 'Extra Large'][formData.wingSize - 1]}</div>
							</div>

							<div class="form-group">
								<label for="wingFormat" class="form-label">Wing Style</label>
								<select id="wingFormat" class="form-select" bind:value={formData.wingFormat}>
									<option value="Fried">Fried</option>
									<option value="Grilled">Grilled</option>
									<option value="Baked">Baked</option>
									<option value="Smoked">Smoked</option>
								</select>
							</div>

							{#if formData.isTakeout}
								<div class="form-group">
									<label for="takeoutContainer" class="form-label">Container Type</label>
									<select id="takeoutContainer" class="form-select" bind:value={formData.takeoutContainer}>
										<option value="Styrofoam">Styrofoam</option>
										<option value="Paper">Paper</option>
										<option value="Plastic">Plastic</option>
										<option value="Cardboard">Cardboard</option>
									</select>
								</div>

								<div class="form-group">
									<label for="takeoutWaitTime" class="form-label">Wait Time (minutes)</label>
									<input type="number" id="takeoutWaitTime" class="form-input" bind:value={formData.takeoutWaitTime} min="0" max="120" />
								</div>
							{/if}

							<div class="form-group">
								<label class="form-label">Had a few beers?</label>
								<div class="radio-group">
									<label class="radio-option">
										<input type="radio" bind:group={formData.beerInfluence} value={false} />
										<span>Sober</span>
									</label>
									<label class="radio-option">
										<input type="radio" bind:group={formData.beerInfluence} value={true} />
										<span>Had a few</span>
									</label>
								</div>
							</div>

							<div class="form-group">
								<label class="form-label">Your Mood</label>
								<div class="mood-buttons">
									{#each [{emoji: '😞', label: 'Terrible', value: -2}, {emoji: '😕', label: 'Bad', value: -1}, {emoji: '😐', label: 'Okay', value: 0}, {emoji: '😊', label: 'Good', value: 1}, {emoji: '😄', label: 'Great', value: 2}] as mood}
										<button
											type="button"
											class="mood-button emoji-mood {formData.moodComparison === mood.value ? 'selected' : ''}"
											on:click={() => formData.moodComparison = mood.value}
											aria-label="{mood.label} mood"
											title="{mood.label}"
										>
											<span class="emoji">{mood.emoji}</span>
											<span class="mood-text">{mood.label}</span>
										</button>
									{/each}
								</div>
							</div>
						</div>
					</div>
				{:else if currentStep === 3}
					<div class="step-section" transition:slide={{ duration: 200, easing: cubicOut }}>
						<div class="step-intro">
							<p class="step-subtitle">{STEP_CONFIG[currentStep - 1].subtext}</p>
						</div>

						<div class="form-group">
							<label class="form-label">Sauce Availability</label>
							<div class="radio-group">
								<label class="radio-option">
									<input type="radio" bind:group={formData.sauceAvailability} value={true} />
									<span>Sauces available</span>
								</label>
								<label class="radio-option">
									<input type="radio" bind:group={formData.sauceAvailability} value={false} />
									<span>No sauces</span>
								</label>
							</div>
						</div>

						{#if formData.sauceAvailability}
							<div class="form-group">
								<label class="form-label">Which sauces did you try?</label>
								<div class="sauce-grid">
									{#each ['Buffalo', 'BBQ', 'Honey Mustard', 'Ranch', 'Blue Cheese', 'Teriyaki', 'Sweet & Sour', 'Garlic Parmesan', 'Hot Sauce', 'Mild', 'Medium', 'Hot', 'Extra Hot'] as sauce}
										<label class="sauce-option">
											<input type="checkbox" bind:group={formData.selectedSauces} value={sauce} />
											<span>{sauce}</span>
										</label>
									{/each}
								</div>

								{#if formData.selectedSauces.length > 0}
									<p class="text-sm text-gray-600 dark:text-gray-400 mt-2">
										Selected: {formData.selectedSauces.join(', ')}
									</p>
								{/if}
							</div>
						{/if}
					</div>
				{:else if currentStep === 4}
					<div class="step-section" transition:slide={{ duration: 200, easing: cubicOut }}>
						<div class="step-intro">
							<p class="step-subtitle">{STEP_CONFIG[currentStep - 1].subtext}</p>
						</div>

						<div class="ratings-grid">
							<div class="rating-group">
								<label class="form-label">Appearance</label>
								<div class="rating-buttons">
									{#each Array(10) as _, i}
										<button
											type="button"
											class="rating-button {formData.appearance === i + 1 ? 'selected' : ''}"
											on:click={() => formData.appearance = i + 1}
											aria-label="Rate appearance {i + 1} out of 10"
										>
											{i + 1}
										</button>
									{/each}
								</div>
								<div class="rating-label">Rating: {formData.appearance}/10</div>
							</div>

							<div class="rating-group">
								<label class="form-label">Aroma</label>
								<div class="rating-buttons">
									{#each Array(10) as _, i}
										<button
											type="button"
											class="rating-button {formData.aroma === i + 1 ? 'selected' : ''}"
											on:click={() => formData.aroma = i + 1}
											aria-label="Rate aroma {i + 1} out of 10"
										>
											{i + 1}
										</button>
									{/each}
								</div>
								<div class="rating-label">Rating: {formData.aroma}/10</div>
							</div>

							{#if formData.sauceAvailability}
								<div class="rating-group">
									<label class="form-label">Sauce Quantity</label>
									<div class="rating-buttons">
										{#each Array(10) as _, i}
											<button
												type="button"
												class="rating-button {formData.sauceQuantity === i + 1 ? 'selected' : ''}"
												on:click={() => formData.sauceQuantity = i + 1}
												aria-label="Rate sauce quantity {i + 1} out of 10"
											>
												{i + 1}
											</button>
										{/each}
									</div>
									<div class="rating-label">Rating: {formData.sauceQuantity}/10</div>
								</div>

								<div class="rating-group">
									<label class="form-label">Sauce Consistency</label>
									<div class="rating-buttons">
										{#each Array(10) as _, i}
											<button
												type="button"
												class="rating-button {formData.sauceConsistency === i + 1 ? 'selected' : ''}"
												on:click={() => formData.sauceConsistency = i + 1}
												aria-label="Rate sauce consistency {i + 1} out of 10"
											>
												{i + 1}
											</button>
										{/each}
									</div>
									<div class="rating-label">Rating: {formData.sauceConsistency}/10</div>
								</div>

								<div class="rating-group">
									<label class="form-label">Sauce Heat</label>
									<div class="rating-buttons">
										{#each Array(10) as _, i}
											<button
												type="button"
												class="rating-button {formData.sauceHeat === i + 1 ? 'selected' : ''}"
												on:click={() => formData.sauceHeat = i + 1}
												aria-label="Rate sauce heat {i + 1} out of 10"
											>
												{i + 1}
											</button>
										{/each}
									</div>
									<div class="rating-label">Rating: {formData.sauceHeat}/10</div>
								</div>
							{/if}

							<div class="rating-group">
								<label class="form-label">Skin Consistency</label>
								<div class="rating-buttons">
									{#each Array(10) as _, i}
										<button
											type="button"
											class="rating-button {formData.skinConsistency === i + 1 ? 'selected' : ''}"
											on:click={() => formData.skinConsistency = i + 1}
											aria-label="Rate skin consistency {i + 1} out of 10"
										>
											{i + 1}
										</button>
									{/each}
								</div>
								<div class="rating-label">Rating: {formData.skinConsistency}/10</div>
							</div>

							<div class="rating-group">
								<label class="form-label">Meat Quality</label>
								<div class="rating-buttons">
									{#each Array(10) as _, i}
										<button
											type="button"
											class="rating-button {formData.meatQuality === i + 1 ? 'selected' : ''}"
											on:click={() => formData.meatQuality = i + 1}
											aria-label="Rate meat quality {i + 1} out of 10"
										>
											{i + 1}
										</button>
									{/each}
								</div>
								<div class="rating-label">Rating: {formData.meatQuality}/10</div>
							</div>

							<div class="rating-group">
								<label class="form-label">Greasiness</label>
								<div class="rating-buttons">
									{#each Array(10) as _, i}
										<button
											type="button"
											class="rating-button {formData.greasiness === i + 1 ? 'selected' : ''}"
											on:click={() => formData.greasiness = i + 1}
											aria-label="Rate greasiness {i + 1} out of 10"
										>
											{i + 1}
										</button>
									{/each}
								</div>
								<div class="rating-label">Rating: {formData.greasiness}/10</div>
							</div>

							<div class="rating-group">
								<label class="form-label">Overall Satisfaction</label>
								<div class="rating-buttons">
									{#each Array(10) as _, i}
										<button
											type="button"
											class="rating-button {formData.satisfactionScore === i + 1 ? 'selected' : ''}"
											on:click={() => formData.satisfactionScore = i + 1}
											aria-label="Rate overall satisfaction {i + 1} out of 10"
										>
											{i + 1}
										</button>
									{/each}
								</div>
								<div class="rating-label">Rating: {formData.satisfactionScore}/10</div>
							</div>

							<div class="rating-group">
								<label class="form-label">Would Recommend</label>
								<div class="rating-buttons">
									{#each Array(10) as _, i}
										<button
											type="button"
											class="rating-button {formData.recommendationScore === i + 1 ? 'selected' : ''}"
											on:click={() => formData.recommendationScore = i + 1}
											aria-label="Rate recommendation {i + 1} out of 10"
										>
											{i + 1}
										</button>
									{/each}
								</div>
								<div class="rating-label">Rating: {formData.recommendationScore}/10</div>
							</div>

							<div class="rating-group">
								<label class="form-label">Blue Cheese</label>
								<div class="radio-group mb-3">
									<label class="radio-option">
										<input type="radio" bind:group={formData.blueCheeseNA} value={false} />
										<span>Available</span>
									</label>
									<label class="radio-option">
										<input type="radio" bind:group={formData.blueCheeseNA} value={true} />
										<span>Not Available</span>
									</label>
								</div>
								{#if !formData.blueCheeseNA}
									<div class="rating-buttons">
										{#each Array(10) as _, i}
											<button
												type="button"
												class="rating-button {formData.blueCheeseQuality === i + 1 ? 'selected' : ''}"
												on:click={() => formData.blueCheeseQuality = i + 1}
												aria-label="Rate blue cheese quality {i + 1} out of 10"
											>
												{i + 1}
											</button>
										{/each}
									</div>
									<div class="rating-label">Rating: {formData.blueCheeseQuality}/10</div>
								{/if}
							</div>

							<div class="rating-group overall-rating-input">
								<label for="overallRating" class="form-label">Overall Rating (out of 10)</label>
								<div class="decimal-input-container">
									<input
										type="number"
										id="overallRating"
										class="decimal-rating-input"
										bind:value={formData.rating}
										min="0"
										max="10"
										step="0.1"
										placeholder="7.5"
									/>
									<span class="input-suffix">/10</span>
								</div>
								<p class="input-help">Enter a decimal rating (e.g., 7.5, 8.2)</p>
							</div>
						</div>

						<div class="calculated-rating">
							<span class="text-sm text-gray-600 dark:text-gray-400">
								Calculated from individual ratings: {calculateOverallRating()}/10
							</span>
						</div>
					</div>
				{:else if currentStep === 5}
					<div class="step-section" transition:slide={{ duration: 200, easing: cubicOut }}>
						<div class="step-intro">
							<p class="step-subtitle">{STEP_CONFIG[currentStep - 1].subtext}</p>
						</div>

						{#if validationErrors.coordinates}
							<div class="error-message mb-4">
								{validationErrors.coordinates}
							</div>
						{/if}

						<div class="form-group">
							<label for="reviewNotes" class="form-label">Review Notes (Optional)</label>
							<textarea
								id="reviewNotes"
								class="form-textarea"
								bind:value={formData.reviewNotes}
								rows="6"
								placeholder="Tell us more about your experience... What made it special or disappointing? Any details that other wing lovers should know?"
							></textarea>
						</div>

						<div class="review-summary">
							<h4 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Review Summary</h4>
							<div class="summary-grid">
								<div class="summary-item">
									<span class="summary-label">Restaurant:</span>
									<span class="summary-value">{formData.restaurantName}</span>
								</div>
								<div class="summary-item">
									<span class="summary-label">Date:</span>
									<span class="summary-value">{new Date(formData.dateVisited).toLocaleDateString()}</span>
								</div>
								<div class="summary-item">
									<span class="summary-label">Dining Style:</span>
									<span class="summary-value">{formData.isTakeout ? 'Takeout' : 'Dine-in'}</span>
								</div>
								<div class="summary-item">
									<span class="summary-label">Overall Rating:</span>
									<span class="summary-value font-bold text-primary-600">{calculateOverallRating()}/10</span>
								</div>
							</div>
						</div>
					</div>
				{/if}
			</div>

			<!-- Navigation -->
			<div class="modal-footer">
				<div class="flex justify-between items-center">
					<button
						type="button"
						class="btn-secondary flex items-center"
						on:click={prevStep}
						disabled={currentStep === 1}
					>
						<Icon icon={faArrowLeft} class="w-4 h-4 mr-2" />
						Previous
					</button>

					<div class="flex items-center space-x-3">
						{#if currentStep < TOTAL_STEPS}
							<button
								type="button"
								class="btn-primary flex items-center"
								on:click={nextStep}
								disabled={!isCurrentStepValid}
							>
								Next
								<Icon icon={faArrowRight} class="w-4 h-4 ml-2" />
							</button>
						{:else}
							<button
								type="button"
								class="btn-primary flex items-center"
								on:click={submitReview}
								disabled={isLoading || !coordinates}
							>
								{#if isLoading}
									<span class="inline-block animate-spin mr-2">↻</span>
									Submitting...
								{:else}
									<Icon icon={faCheck} class="w-4 h-4 mr-2" />
									Submit Review
								{/if}
							</button>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Design System Variables */
	:root {
		--color-primary: #3b82f6;
		--color-primary-hover: #2563eb;
		--color-primary-light: #dbeafe;
		--color-success: #10b981;
		--color-success-light: #d1fae5;
		--color-error: #ef4444;
		--color-error-light: #fee2e2;
		--color-warning: #f59e0b;
		--color-warning-light: #fef3c7;

		--border-radius-sm: 0.375rem;
		--border-radius: 0.5rem;
		--border-radius-lg: 0.75rem;
		--border-radius-xl: 1rem;

		--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
		--shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
		--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
		--shadow-xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);

		--transition: all 0.2s ease;
		--transition-fast: all 0.15s ease;
	}

	.modal-container {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: var(--z-modal);
		padding: 1rem;
	}

	.modal-overlay {
		position: absolute;
		inset: 0;
		background-color: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(2px);
	}

	.modal-content {
		position: relative;
		background-color: white;
		border-radius: 1rem;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
		width: 100%;
		max-width: 700px;
		max-height: 90vh;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	:global(.dark) .modal-content {
		background-color: #1f2937;
		color: #f3f4f6;
	}

	.modal-header {
		padding: 2rem 2rem 0 2rem;
		flex-shrink: 0;
	}

	.progress-container {
		position: relative;
	}

	.progress-bar {
		width: 100%;
		height: 6px;
		background-color: #e5e7eb;
		border-radius: 3px;
		overflow: hidden;
	}

	:global(.dark) .progress-bar {
		background-color: #374151;
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, #3b82f6, #1d4ed8);
		transition: width 0.3s ease;
	}

	.step-indicators {
		display: flex;
		justify-content: space-between;
		margin-top: 1rem;
	}

	.step-indicator-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}

	.step-indicator {
		width: 3rem;
		height: 3rem;
		border-radius: 50%;
		border: 2px solid #e5e7eb;
		background-color: white;
		color: #6b7280;
		font-size: 0.875rem;
		font-weight: 600;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: var(--transition);
		cursor: pointer;
		position: relative;
		box-shadow: var(--shadow-sm);
	}

	.step-icon {
		font-size: 1rem;
	}

	.step-label {
		font-size: 0.75rem;
		font-weight: 500;
		color: #6b7280;
		text-align: center;
		line-height: 1.2;
		max-width: 4rem;
	}

	.step-indicator:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.step-indicator.completed {
		border-color: var(--color-success);
		background-color: var(--color-success);
		color: white;
		box-shadow: var(--shadow);
	}

	.step-indicator.completed + .step-label {
		color: var(--color-success);
		font-weight: 600;
	}

	.step-indicator.current {
		border-color: var(--color-primary);
		background-color: var(--color-primary);
		color: white;
		transform: scale(1.05);
		box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2), var(--shadow);
		animation: pulse-ring 2s infinite;
	}

	.step-indicator.current + .step-label {
		color: var(--color-primary);
		font-weight: 600;
	}

	@keyframes pulse-ring {
		0% {
			box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.3), var(--shadow);
		}
		70% {
			box-shadow: 0 0 0 8px rgba(59, 130, 246, 0), var(--shadow);
		}
		100% {
			box-shadow: 0 0 0 0 rgba(59, 130, 246, 0), var(--shadow);
		}
	}

	:global(.dark) .step-indicator {
		border-color: #4b5563;
		background-color: #374151;
		color: #9ca3af;
	}

	:global(.dark) .step-indicator.completed {
		border-color: #10b981;
		background-color: #10b981;
		color: white;
	}

	:global(.dark) .step-indicator.current {
		border-color: #3b82f6;
		background-color: #3b82f6;
		color: white;
	}

	.step-content {
		padding: 1rem 2rem;
		flex: 1;
		overflow-y: auto;
	}

	.step-section {
		max-width: 100%;
	}

	.step-intro {
		margin-bottom: 2rem;
		text-align: center;
		padding: 1rem;
		background: linear-gradient(135deg, #f3f4f6, #e5e7eb);
		border-radius: var(--border-radius-lg);
		border: 1px solid #e5e7eb;
	}

	:global(.dark) .step-intro {
		background: linear-gradient(135deg, #374151, #4b5563);
		border-color: #4b5563;
	}

	.step-subtitle {
		color: #4b5563;
		font-size: 1.125rem;
		font-weight: 500;
		line-height: 1.5;
	}

	:global(.dark) .step-subtitle {
		color: #d1d5db;
	}

	.form-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1.5rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
	}

	.form-label {
		font-weight: 500;
		color: #374151;
		margin-bottom: 0.5rem;
		font-size: 0.875rem;
	}

	.form-label.required::after {
		content: ' *';
		color: #ef4444;
	}

	:global(.dark) .form-label {
		color: #d1d5db;
	}

	.form-input, .form-select, .form-textarea {
		padding: 0.875rem 1rem;
		border: 2px solid #e5e7eb;
		border-radius: var(--border-radius);
		font-size: 1rem;
		transition: var(--transition);
		background-color: white;
		position: relative;
	}

	.form-input:focus, .form-select:focus, .form-textarea:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1), var(--shadow-sm);
		transform: translateY(-1px);
	}

	.form-input.error, .form-select.error, .form-textarea.error {
		border-color: var(--color-error);
		box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
	}

	.field-error {
		color: var(--color-error);
		font-size: 0.875rem;
		margin-top: 0.25rem;
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.success-message {
		color: var(--color-success);
		font-size: 0.875rem;
		margin-top: 0.5rem;
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-weight: 500;
	}

	:global(.dark) .form-input,
	:global(.dark) .form-select,
	:global(.dark) .form-textarea {
		background-color: #374151;
		border-color: #4b5563;
		color: #f3f4f6;
	}

	:global(.dark) .form-input:focus,
	:global(.dark) .form-select:focus,
	:global(.dark) .form-textarea:focus {
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
	}

	.address-input-group {
		display: flex;
		gap: 0.75rem;
		align-items: flex-start;
	}

	.address-input-group .form-input {
		flex: 1;
	}

	.btn-verify {
		padding: 0.875rem 1.25rem;
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: var(--border-radius);
		font-weight: 600;
		transition: var(--transition);
		cursor: pointer;
		white-space: nowrap;
		box-shadow: var(--shadow-sm);
	}

	.btn-verify:hover:not(:disabled) {
		background: var(--color-primary-hover);
		transform: translateY(-1px);
		box-shadow: var(--shadow);
	}

	.btn-verify:disabled {
		background: #9ca3af;
		cursor: not-allowed;
		opacity: 0.6;
	}

	.radio-group {
		display: flex;
		gap: 1rem;
		margin-top: 0.5rem;
	}

	.radio-option {
		display: flex;
		align-items: center;
		cursor: pointer;
		padding: 0.5rem 1rem;
		border: 2px solid #e5e7eb;
		border-radius: 0.5rem;
		transition: all 0.2s ease;
	}

	.radio-option:hover {
		border-color: #3b82f6;
	}

	.radio-option input[type="radio"] {
		margin-right: 0.5rem;
	}

	:global(.dark) .radio-option {
		border-color: #4b5563;
	}

	:global(.dark) .radio-option:hover {
		border-color: #3b82f6;
	}

	.form-range {
		-webkit-appearance: none;
		appearance: none;
		background: transparent;
		cursor: pointer;
	}

	.form-range::-webkit-slider-track {
		background: #e5e7eb;
		height: 6px;
		border-radius: 3px;
	}

	.form-range::-webkit-slider-thumb {
		appearance: none;
		height: 20px;
		width: 20px;
		border-radius: 50%;
		background: #3b82f6;
		cursor: pointer;
		margin-top: -7px;
		transition: all 0.2s ease;
	}

	.form-range::-webkit-slider-thumb:hover {
		transform: scale(1.2);
	}

	.range-labels {
		display: flex;
		justify-content: space-between;
		margin-top: 0.5rem;
		font-size: 0.875rem;
		color: #6b7280;
	}

	:global(.dark) .range-labels {
		color: #9ca3af;
	}

	.sauce-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.sauce-option {
		display: flex;
		align-items: center;
		cursor: pointer;
		padding: 0.5rem;
		border: 1px solid #e5e7eb;
		border-radius: 0.375rem;
		transition: all 0.2s ease;
		font-size: 0.875rem;
	}

	.sauce-option:hover {
		border-color: #3b82f6;
		background-color: #f3f4f6;
	}

	.sauce-option input[type="checkbox"] {
		margin-right: 0.5rem;
	}

	:global(.dark) .sauce-option {
		border-color: #4b5563;
		background-color: #374151;
	}

	:global(.dark) .sauce-option:hover {
		border-color: #3b82f6;
		background-color: #4b5563;
	}

	.ratings-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 2rem;
	}

	.rating-group {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.rating-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		justify-content: center;
	}

	.rating-button {
		width: 48px;
		height: 48px;
		border: 2px solid #e5e7eb;
		border-radius: var(--border-radius);
		background: white;
		color: #6b7280;
		font-weight: 600;
		font-size: 1rem;
		cursor: pointer;
		transition: var(--transition);
		display: flex;
		align-items: center;
		justify-content: center;
		user-select: none;
		-webkit-tap-highlight-color: transparent;
	}

	.rating-button:hover {
		border-color: var(--color-primary);
		background: var(--color-primary-light);
		color: var(--color-primary);
		transform: translateY(-1px);
		box-shadow: var(--shadow-sm);
	}

	.rating-button.selected {
		border-color: var(--color-primary);
		background: var(--color-primary);
		color: white;
		box-shadow: var(--shadow);
	}

	.rating-button:active {
		transform: translateY(0);
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	:global(.dark) .rating-button {
		background: #374151;
		border-color: #4b5563;
		color: #d1d5db;
	}

	:global(.dark) .rating-button:hover {
		border-color: var(--color-primary);
		background: var(--color-primary-light);
		color: var(--color-primary-dark);
	}

	:global(.dark) .rating-button.selected {
		border-color: var(--color-primary);
		background: var(--color-primary);
		color: white;
	}

	.rating-label {
		text-align: center;
		font-weight: 600;
		color: var(--color-primary);
		font-size: 0.875rem;
	}

	:global(.dark) .rating-label {
		color: var(--color-primary-light);
	}

	.overall-rating-input {
		border: 2px solid var(--color-primary);
		border-radius: var(--border-radius-lg);
		padding: 1.5rem;
		background: linear-gradient(135deg, var(--color-primary-light), #eff6ff);
		margin-top: 1rem;
	}

	:global(.dark) .overall-rating-input {
		background: linear-gradient(135deg, #1e3a8a, #1e40af);
		border-color: var(--color-primary);
	}

	.overall-rating-input .form-label {
		font-size: 1.125rem;
		font-weight: 700;
		color: var(--color-primary-dark);
		text-align: center;
		margin-bottom: 1rem;
	}

	:global(.dark) .overall-rating-input .form-label {
		color: white;
	}

	.overall-rating-input .rating-label {
		font-size: 1rem;
		font-weight: 700;
		color: var(--color-primary-dark);
	}

	:global(.dark) .overall-rating-input .rating-label {
		color: white;
	}

	.calculated-rating {
		text-align: center;
		margin-top: 0.75rem;
		padding: 0.5rem;
	}

	/* Decimal Rating Input */
	.decimal-input-container {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		justify-content: center;
		margin: 1rem 0;
	}

	.decimal-rating-input {
		width: 120px;
		padding: 1rem;
		border: 2px solid var(--color-primary);
		border-radius: var(--border-radius);
		font-size: 1.25rem;
		font-weight: 700;
		text-align: center;
		background: white;
		color: var(--color-primary-dark);
	}

	:global(.dark) .decimal-rating-input {
		background: #374151;
		color: white;
		border-color: var(--color-primary);
	}

	.decimal-rating-input:focus {
		outline: none;
		box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2);
		transform: scale(1.02);
	}

	.input-suffix {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--color-primary-dark);
	}

	:global(.dark) .input-suffix {
		color: white;
	}

	.input-help {
		text-align: center;
		font-size: 0.875rem;
		color: #6b7280;
		font-style: italic;
	}

	:global(.dark) .input-help {
		color: #9ca3af;
	}

	/* Size Buttons */
	.size-buttons {
		display: flex;
		gap: 0.5rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	.size-button {
		width: 56px;
		height: 48px;
		border: 2px solid #e5e7eb;
		border-radius: var(--border-radius);
		background: white;
		color: #6b7280;
		font-weight: 700;
		font-size: 1rem;
		cursor: pointer;
		transition: var(--transition);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.size-button:hover {
		border-color: var(--color-primary);
		background: var(--color-primary-light);
		color: var(--color-primary);
		transform: translateY(-1px);
	}

	.size-button.selected {
		border-color: var(--color-primary);
		background: var(--color-primary);
		color: white;
		box-shadow: var(--shadow);
	}

	:global(.dark) .size-button {
		background: #374151;
		border-color: #4b5563;
		color: #d1d5db;
	}

	.size-label {
		text-align: center;
		font-weight: 600;
		color: var(--color-primary);
		font-size: 0.875rem;
		margin-top: 0.5rem;
	}

	/* Mood Buttons */
	.mood-buttons {
		display: flex;
		gap: 0.5rem;
		justify-content: center;
		flex-wrap: wrap;
		margin: 1rem 0;
	}

	.mood-button.emoji-mood {
		min-width: 80px;
		height: 48px;
		padding: 0.5rem;
		border: 2px solid #e5e7eb;
		border-radius: var(--border-radius);
		background: white;
		color: #374151;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: var(--transition);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
	}

	.mood-button.emoji-mood .emoji {
		font-size: 1.25rem;
		line-height: 1;
	}

	.mood-button.emoji-mood .mood-text {
		font-size: 0.75rem;
		line-height: 1;
	}

	.mood-button.emoji-mood:hover {
		border-color: #8b5cf6;
		background: #f3e8ff;
		color: #8b5cf6;
		transform: translateY(-1px);
	}

	.mood-button.emoji-mood.selected {
		border-color: #8b5cf6;
		background: #8b5cf6;
		color: white;
		box-shadow: var(--shadow);
	}

	:global(.dark) .mood-button.emoji-mood {
		background: #374151;
		border-color: #4b5563;
		color: #d1d5db;
	}

	:global(.dark) .mood-button.emoji-mood:hover {
		border-color: #8b5cf6;
		background: #581c87;
		color: white;
	}

	:global(.dark) .mood-button.emoji-mood.selected {
		background: #8b5cf6;
		border-color: #8b5cf6;
		color: white;
	}


	.review-summary {
		background-color: #f9fafb;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		padding: 1.5rem;
		margin-top: 2rem;
	}

	:global(.dark) .review-summary {
		background-color: #374151;
		border-color: #4b5563;
	}

	.summary-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		margin-top: 1rem;
	}

	.summary-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0;
		border-bottom: 1px solid #e5e7eb;
	}

	:global(.dark) .summary-item {
		border-color: #4b5563;
	}

	.summary-label {
		font-weight: 500;
		color: #6b7280;
	}

	:global(.dark) .summary-label {
		color: #9ca3af;
	}

	.summary-value {
		font-weight: 600;
		color: #1f2937;
	}

	:global(.dark) .summary-value {
		color: #f3f4f6;
	}

	.modal-footer {
		padding: 1.5rem 2rem 2rem 2rem;
		border-top: 1px solid #e5e7eb;
		flex-shrink: 0;
	}

	:global(.dark) .modal-footer {
		border-color: #4b5563;
	}

	.error-message {
		background: linear-gradient(135deg, var(--color-error-light), #fecaca);
		border: 1px solid var(--color-error);
		color: var(--color-error);
		padding: 1rem;
		border-radius: var(--border-radius-lg);
		text-align: center;
		font-weight: 500;
		box-shadow: var(--shadow-sm);
	}

	:global(.dark) .error-message {
		background: linear-gradient(135deg, #451a1a, #7f1d1d);
		border-color: #ef4444;
		color: #f87171;
	}

	/* Enhanced mobile responsiveness */
	@media (max-width: 768px) {
		.step-indicators {
			gap: 0.75rem;
			overflow-x: auto;
			padding: 0 0.5rem;
			scrollbar-width: none;
			-ms-overflow-style: none;
		}

		.step-indicators::-webkit-scrollbar {
			display: none;
		}

		.step-indicator {
			width: 2.5rem;
			height: 2.5rem;
			flex-shrink: 0;
		}

		.step-label {
			font-size: 0.6875rem;
			max-width: 3rem;
		}

		.address-input-group {
			flex-direction: column;
			gap: 0.5rem;
		}

		.btn-verify {
			width: 100%;
		}
	}

	@media (max-width: 640px) {
		.modal-container {
			padding: 0.5rem;
		}

		.modal-content {
			max-height: 95vh;
		}

		.modal-header, .step-content, .modal-footer {
			padding-left: 1rem;
			padding-right: 1rem;
		}

		.form-grid {
			grid-template-columns: 1fr;
			gap: 1rem;
		}

		.ratings-grid {
			gap: 1.5rem;
		}

		.rating-buttons {
			gap: 0.375rem;
		}

		.rating-button {
			width: 44px;
			height: 44px;
			font-size: 0.875rem;
		}

		.decimal-rating-input {
			width: 100px;
			padding: 0.75rem;
			font-size: 1.125rem;
		}

		.size-buttons {
			gap: 0.375rem;
		}

		.size-button {
			width: 48px;
			height: 44px;
			font-size: 0.875rem;
		}

		.mood-buttons {
			gap: 0.25rem;
			flex-direction: column;
		}

		.mood-button.emoji-mood {
			min-width: 70px;
			height: 44px;
			padding: 0.25rem;
		}

		.mood-button.emoji-mood .emoji {
			font-size: 1rem;
		}

		.mood-button.emoji-mood .mood-text {
			font-size: 0.6875rem;
		}

		.step-indicators {
			gap: 0.5rem;
		}

		.step-indicator {
			width: 2.25rem;
			height: 2.25rem;
			font-size: 0.75rem;
		}

		.step-intro {
			padding: 0.75rem;
		}

		.step-subtitle {
			font-size: 1rem;
		}

		.radio-group {
			flex-direction: column;
			gap: 0.5rem;
		}

		.address-input-group {
			flex-direction: column;
		}
	}

	/* Extra small devices (iPhone SE, etc.) */
	@media (max-width: 375px) {
		.rating-buttons {
			gap: 0.25rem;
		}

		.rating-button {
			width: 40px;
			height: 40px;
			font-size: 0.8125rem;
		}

		.ratings-grid {
			gap: 1.25rem;
		}

		.decimal-rating-input {
			width: 90px;
			padding: 0.5rem;
			font-size: 1rem;
		}

		.size-button {
			width: 42px;
			height: 40px;
			font-size: 0.8125rem;
		}

		.mood-button.emoji-mood {
			min-width: 60px;
			height: 40px;
			padding: 0.25rem;
		}

		.mood-button.emoji-mood .emoji {
			font-size: 0.875rem;
		}

		.mood-button.emoji-mood .mood-text {
			font-size: 0.625rem;
		}

		.mood-buttons {
			gap: 0.125rem;
			flex-direction: column;
		}
	}
</style>