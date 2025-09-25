<script lang="ts">
	import {
		faStar,
		faMapMarkerAlt,
		faCalendarAlt,
		faThumbsUp,
		faThumbsDown
	} from '@fortawesome/free-solid-svg-icons';
	import Icon from 'svelte-fa';
	import type { Review } from './types';

	export let review: Review;
	export let isSelected: boolean = false;

	// Calculate relative time
	function getRelativeTime(date: string): string {
		const now = new Date();
		const reviewDate = new Date(date);
		const diffTime = Math.abs(now.getTime() - reviewDate.getTime());
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

		if (diffDays === 1) return '1 day ago';
		if (diffDays < 7) return `${diffDays} days ago`;
		if (diffDays < 30)
			return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) !== 1 ? 's' : ''} ago`;
		if (diffDays < 365)
			return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) !== 1 ? 's' : ''} ago`;
		return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) !== 1 ? 's' : ''} ago`;
	}

	// Generate rating stars
	function generateStars(rating: number): ('full' | 'half' | 'empty')[] {
		const stars: ('full' | 'half' | 'empty')[] = [];
		const fullStars = Math.floor(rating / 2);
		const hasHalfStar = rating % 2 >= 1;

		for (let i = 0; i < fullStars; i++) {
			stars.push('full');
		}
		if (hasHalfStar) {
			stars.push('half');
		}
		while (stars.length < 5) {
			stars.push('empty');
		}
		return stars;
	}

	$: stars = generateStars(Number(review.rating));
	$: hasVotes = (review.upvotes_count || 0) > 0 || (review.downvotes_count || 0) > 0;
</script>

<div
	class="group relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 transition-all duration-300 hover:shadow-lg hover:shadow-gray-200/50 dark:hover:shadow-gray-900/50 hover:-translate-y-0.5 cursor-pointer
         {isSelected
		? 'ring-2 ring-primary-500 ring-offset-2 ring-offset-gray-50 dark:ring-offset-gray-900 shadow-lg'
		: 'hover:border-gray-300 dark:hover:border-gray-600'}"
	on:click
	role="button"
	tabindex="0"
	on:keydown
>
	<!-- Restaurant header -->
	<div class="flex items-start justify-between mb-3">
		<div class="flex-1 min-w-0">
			<h3
				class="font-semibold text-lg text-gray-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors"
			>
				{review.location.restaurant_name}
			</h3>

			<!-- Location and date -->
			<div class="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
				<div class="flex items-center gap-1">
					<Icon icon={faMapMarkerAlt} class="h-3.5 w-3.5" />
					<span class="truncate">{review.location.address || 'Location'}</span>
				</div>
				<div class="flex items-center gap-1 flex-shrink-0">
					<Icon icon={faCalendarAlt} class="h-3.5 w-3.5" />
					<span>{getRelativeTime(review.date_visited)}</span>
				</div>
			</div>
		</div>

		<!-- Rating badge -->
		<div class="flex-shrink-0 ml-4">
			<div
				class="inline-flex items-center gap-2 bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900/30 dark:to-primary-800/30 text-primary-700 dark:text-primary-300 px-3 py-2 rounded-full border border-primary-200 dark:border-primary-700"
			>
				<Icon icon={faStar} class="h-4 w-4 text-yellow-500" />
				<span class="font-bold text-sm">{review.rating}/10</span>
			</div>
		</div>
	</div>

	<!-- Star rating -->
	<div class="flex items-center gap-1 mb-3">
		{#each stars as star}
			<span
				class="text-lg {star === 'full'
					? 'text-yellow-400'
					: star === 'half'
						? 'text-yellow-400'
						: 'text-gray-300 dark:text-gray-600'}"
			>
				{star === 'full' ? '★' : star === 'half' ? '☆' : '☆'}
			</span>
		{/each}
		<span class="ml-2 text-sm text-gray-500 dark:text-gray-400">
			({review.rating}/10)
		</span>
	</div>

	<!-- Review text -->
	<p class="text-gray-700 dark:text-gray-300 text-sm leading-relaxed line-clamp-2 mb-4">
		{review.review}
	</p>

	<!-- Footer with votes and engagement -->
	<div class="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
		<!-- Vote counts -->
		{#if hasVotes}
			<div class="flex items-center gap-4">
				{#if (review.upvotes_count || 0) > 0}
					<div class="flex items-center gap-1 text-green-600 dark:text-green-400">
						<Icon icon={faThumbsUp} class="h-3.5 w-3.5" />
						<span class="text-sm font-medium">{review.upvotes_count}</span>
					</div>
				{/if}
				{#if (review.downvotes_count || 0) > 0}
					<div class="flex items-center gap-1 text-red-500 dark:text-red-400">
						<Icon icon={faThumbsDown} class="h-3.5 w-3.5" />
						<span class="text-sm font-medium">{review.downvotes_count}</span>
					</div>
				{/if}
			</div>
		{:else}
			<div class="text-xs text-gray-400 dark:text-gray-500">No votes yet</div>
		{/if}

		<!-- View indicator -->
		<div
			class="flex items-center text-xs text-gray-400 dark:text-gray-500 group-hover:text-primary-500 dark:group-hover:text-primary-400 transition-colors"
		>
			<span class="opacity-0 group-hover:opacity-100 transition-opacity">
				Click to view details
			</span>
		</div>
	</div>

	<!-- Hover effect indicator -->
	<div
		class="absolute inset-0 bg-gradient-to-r from-primary-500/5 to-primary-600/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
	></div>
</div>
