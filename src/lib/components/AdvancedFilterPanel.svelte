<script lang="ts">
	import { slide, fade } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import Icon from 'svelte-fa';
	import {
		faTimes,
		faSliders,
		faStar,
		faMapMarkerAlt,
		faClock,
		faThumbsUp,
		faUtensils,
		faCalendarAlt,
		faBookmark,
		faTrash,
		faSave
	} from '@fortawesome/free-solid-svg-icons';
	import Button from './Button.svelte';
	import {
		filterState,
		isFilterPanelOpen,
		activeFilterCount,
		commonSauces,
		updateFilter,
		resetFilters,
		closeFilterPanel,
		applyQuickFilter,
		saveFilterPreset,
		loadFilterPreset,
		getFilterPresets,
		deleteFilterPreset
	} from '$lib/stores/filterStore';

	export let userLocation: { latitude: number; longitude: number } | null = null;

	// Local state
	let presetName = '';
	let showPresets = false;

	// Get saved presets
	$: savedPresets = typeof window !== 'undefined' ? Object.keys(getFilterPresets()) : [];

	// Handle background click
	function handleBackgroundClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			closeFilterPanel();
		}
	}

	// Quick filter actions
	function handleQuickFilter(type: 'nearby' | 'top-rated' | 'recent') {
		applyQuickFilter(type, userLocation);
	}

	// Preset management
	function handleSavePreset() {
		if (presetName.trim()) {
			saveFilterPreset(presetName.trim());
			presetName = '';
			savedPresets = Object.keys(getFilterPresets());
		}
	}

	function handleLoadPreset(name: string) {
		loadFilterPreset(name);
		showPresets = false;
	}

	function handleDeletePreset(name: string) {
		deleteFilterPreset(name);
		savedPresets = Object.keys(getFilterPresets());
	}
</script>

{#if $isFilterPanelOpen}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity duration-300"
		on:click={handleBackgroundClick}
		transition:fade={{ duration: 300 }}
	>
		<!-- Filter Panel -->
		<div
			class="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl overflow-y-auto"
			transition:slide={{ duration: 400, easing: quintOut, axis: 'x' }}
		>
			<!-- Header -->
			<div
				class="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 z-10"
			>
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-3">
						<div
							class="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center"
						>
							<Icon icon={faSliders} class="h-5 w-5 text-primary-600 dark:text-primary-400" />
						</div>
						<div>
							<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
								Advanced Filters
							</h2>
							{#if $activeFilterCount > 0}
								<p class="text-sm text-primary-600 dark:text-primary-400">
									{$activeFilterCount} active filter{$activeFilterCount !== 1 ? 's' : ''}
								</p>
							{/if}
						</div>
					</div>
					<Button variant="ghost" size="sm" on:click={closeFilterPanel}>
						<Icon icon={faTimes} class="h-5 w-5" />
					</Button>
				</div>
			</div>

			<!-- Content -->
			<div class="p-6 space-y-8">
				<!-- Quick Filters -->
				<div>
					<h3
						class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2"
					>
						<Icon icon={faBookmark} class="h-4 w-4" />
						Quick Filters
					</h3>
					<div class="grid grid-cols-1 gap-2">
						{#if userLocation}
							<Button
								variant="outline"
								size="sm"
								fullWidth
								on:click={() => handleQuickFilter('nearby')}
							>
								<Icon icon={faMapMarkerAlt} class="h-4 w-4 mr-2" />
								Nearby (5km)
							</Button>
						{/if}
						<Button
							variant="outline"
							size="sm"
							fullWidth
							on:click={() => handleQuickFilter('top-rated')}
						>
							<Icon icon={faStar} class="h-4 w-4 mr-2" />
							Top Rated (8+)
						</Button>
						<Button
							variant="outline"
							size="sm"
							fullWidth
							on:click={() => handleQuickFilter('recent')}
						>
							<Icon icon={faClock} class="h-4 w-4 mr-2" />
							Recent (30 days)
						</Button>
					</div>
				</div>

				<!-- Rating Filter -->
				<div>
					<h3
						class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2"
					>
						<Icon icon={faStar} class="h-4 w-4" />
						Rating Range
					</h3>
					<div class="space-y-4">
						<div>
							<label class="block text-xs text-gray-600 dark:text-gray-400 mb-2">
								Minimum Rating: {$filterState.minRating}/10
							</label>
							<input
								type="range"
								min="0"
								max="10"
								step="0.5"
								bind:value={$filterState.minRating}
								on:input={(e) => updateFilter('minRating', Number(e.target.value))}
								class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
							/>
						</div>
						<div>
							<label class="block text-xs text-gray-600 dark:text-gray-400 mb-2">
								Maximum Rating: {$filterState.maxRating}/10
							</label>
							<input
								type="range"
								min="0"
								max="10"
								step="0.5"
								bind:value={$filterState.maxRating}
								on:input={(e) => updateFilter('maxRating', Number(e.target.value))}
								class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
							/>
						</div>
					</div>
				</div>

				<!-- Distance Filter -->
				{#if userLocation}
					<div>
						<h3
							class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2"
						>
							<Icon icon={faMapMarkerAlt} class="h-4 w-4" />
							Distance
						</h3>
						<div class="space-y-3">
							<label class="flex items-center gap-3">
								<input
									type="checkbox"
									checked={$filterState.maxDistance !== null}
									on:change={(e) => updateFilter('maxDistance', e.target.checked ? 10 : null)}
									class="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
								/>
								<span class="text-sm text-gray-700 dark:text-gray-300">Limit by distance</span>
							</label>
							{#if $filterState.maxDistance !== null}
								<div transition:slide={{ duration: 200 }}>
									<label class="block text-xs text-gray-600 dark:text-gray-400 mb-2">
										Within {$filterState.maxDistance}km
									</label>
									<input
										type="range"
										min="1"
										max="50"
										step="1"
										bind:value={$filterState.maxDistance}
										on:input={(e) => updateFilter('maxDistance', Number(e.target.value))}
										class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
									/>
								</div>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Engagement Filter -->
				<div>
					<h3
						class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2"
					>
						<Icon icon={faThumbsUp} class="h-4 w-4" />
						Community Engagement
					</h3>
					<div>
						<label class="block text-xs text-gray-600 dark:text-gray-400 mb-2">
							Minimum votes: {$filterState.minVotes}
						</label>
						<input
							type="range"
							min="0"
							max="20"
							step="1"
							bind:value={$filterState.minVotes}
							on:input={(e) => updateFilter('minVotes', Number(e.target.value))}
							class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
						/>
					</div>
				</div>

				<!-- Date Filters -->
				<div>
					<h3
						class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2"
					>
						<Icon icon={faCalendarAlt} class="h-4 w-4" />
						Visit Date
					</h3>
					<div class="space-y-3">
						<label class="flex items-center gap-3">
							<input
								type="checkbox"
								bind:checked={$filterState.hasRecentVisits}
								on:change={(e) => updateFilter('hasRecentVisits', e.target.checked)}
								class="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
							/>
							<span class="text-sm text-gray-700 dark:text-gray-300"
								>Recent visits only (last 30 days)</span
							>
						</label>
					</div>
				</div>

				<!-- Sauce Filter -->
				<div>
					<h3
						class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2"
					>
						<Icon icon={faUtensils} class="h-4 w-4" />
						Sauce Types
					</h3>
					<div class="grid grid-cols-2 gap-2">
						{#each commonSauces as sauce}
							<label
								class="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
							>
								<input
									type="checkbox"
									value={sauce}
									checked={$filterState.selectedSauces.includes(sauce)}
									on:change={(e) => {
										const sauces = e.target.checked
											? [...$filterState.selectedSauces, sauce]
											: $filterState.selectedSauces.filter((s) => s !== sauce);
										updateFilter('selectedSauces', sauces);
									}}
									class="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
								/>
								<span class="text-sm text-gray-700 dark:text-gray-300">{sauce}</span>
							</label>
						{/each}
					</div>
					{#if $filterState.selectedSauces.length > 0}
						<div class="mt-3 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
							<p class="text-xs text-primary-700 dark:text-primary-300 mb-2">Selected sauces:</p>
							<div class="flex flex-wrap gap-1">
								{#each $filterState.selectedSauces as sauce}
									<span
										class="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-800 text-primary-700 dark:text-primary-300 text-xs rounded-full"
									>
										{sauce}
										<button
											on:click={() =>
												updateFilter(
													'selectedSauces',
													$filterState.selectedSauces.filter((s) => s !== sauce)
												)}
											class="text-primary-500 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-200"
										>
											<Icon icon={faTimes} class="h-3 w-3" />
										</button>
									</span>
								{/each}
							</div>
						</div>
					{/if}
				</div>

				<!-- Presets -->
				<div>
					<h3
						class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2"
					>
						<Icon icon={faSave} class="h-4 w-4" />
						Filter Presets
					</h3>

					<!-- Save new preset -->
					<div class="space-y-3">
						<div class="flex gap-2">
							<input
								type="text"
								placeholder="Preset name..."
								bind:value={presetName}
								class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white"
							/>
							<Button
								variant="primary"
								size="sm"
								disabled={!presetName.trim()}
								on:click={handleSavePreset}
							>
								Save
							</Button>
						</div>

						<!-- Saved presets -->
						{#if savedPresets.length > 0}
							<div class="space-y-2">
								<button
									class="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
									on:click={() => (showPresets = !showPresets)}
								>
									{showPresets ? 'Hide' : 'Show'} saved presets ({savedPresets.length})
								</button>

								{#if showPresets}
									<div class="space-y-1" transition:slide={{ duration: 200 }}>
										{#each savedPresets as presetName}
											<div
												class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
											>
												<button
													class="flex-1 text-left text-sm text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
													on:click={() => handleLoadPreset(presetName)}
												>
													{presetName}
												</button>
												<button
													class="text-red-500 hover:text-red-700 transition-colors p-1"
													on:click={() => handleDeletePreset(presetName)}
												>
													<Icon icon={faTrash} class="h-3 w-3" />
												</button>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Footer -->
			<div
				class="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-4"
			>
				<div class="flex gap-3">
					<Button variant="outline" size="md" fullWidth on:click={resetFilters}>Reset All</Button>
					<Button variant="primary" size="md" fullWidth on:click={closeFilterPanel}>
						Apply Filters
					</Button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Custom slider styles */
	.slider::-webkit-slider-thumb {
		appearance: none;
		height: 20px;
		width: 20px;
		border-radius: 50%;
		background: linear-gradient(135deg, #3b82f6, #1d4ed8);
		cursor: pointer;
		box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
		transition: all 0.2s ease;
	}

	.slider::-webkit-slider-thumb:hover {
		transform: scale(1.1);
		box-shadow: 0 4px 8px rgba(59, 130, 246, 0.4);
	}

	.slider::-moz-range-thumb {
		height: 20px;
		width: 20px;
		border-radius: 50%;
		background: linear-gradient(135deg, #3b82f6, #1d4ed8);
		cursor: pointer;
		border: none;
		box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
		transition: all 0.2s ease;
	}

	.slider::-moz-range-thumb:hover {
		transform: scale(1.1);
		box-shadow: 0 4px 8px rgba(59, 130, 246, 0.4);
	}
</style>
