<script lang="ts">
	// Props
	export let variant: 'text' | 'circular' | 'rectangular' | 'card' | 'list' = 'rectangular';
	export let width: string | undefined = undefined;
	export let height: string | undefined = undefined;
	export let lines: number = 1;
	export let rounded: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full' = 'md';
	export let animation: 'pulse' | 'wave' | 'none' = 'pulse';

	// Computed classes
	$: baseClasses = 'bg-gray-200 dark:bg-gray-700';

	$: animationClasses = {
		pulse: 'animate-pulse',
		wave: 'relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent',
		none: ''
	}[animation];

	$: roundedClasses = {
		none: 'rounded-none',
		sm: 'rounded-sm',
		md: 'rounded-md',
		lg: 'rounded-lg',
		xl: 'rounded-xl',
		full: 'rounded-full'
	}[rounded];

	$: containerClasses = `${baseClasses} ${animationClasses} ${roundedClasses}`;
</script>

{#if variant === 'text'}
	<div class="space-y-2">
		{#each Array(lines) as _, i}
			<div
				class="{containerClasses} h-4"
				style="width: {width || `${85 + Math.random() * 15}%`};"
			></div>
		{/each}
	</div>
{:else if variant === 'circular'}
	<div
		class="{containerClasses} rounded-full"
		style="width: {width || '40px'}; height: {height || width || '40px'};"
	></div>
{:else if variant === 'card'}
	<div
		class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 space-y-4"
	>
		<!-- Header skeleton -->
		<div class="flex items-start justify-between">
			<div class="space-y-2 flex-1">
				<div class="{baseClasses} {animationClasses} rounded-md h-6 w-3/4"></div>
				<div class="{baseClasses} {animationClasses} rounded-md h-4 w-1/2"></div>
			</div>
			<div class="{baseClasses} {animationClasses} rounded-full w-12 h-8"></div>
		</div>

		<!-- Rating skeleton -->
		<div class="flex items-center gap-1">
			{#each Array(5) as _}
				<div class="{baseClasses} {animationClasses} rounded-sm w-4 h-4"></div>
			{/each}
		</div>

		<!-- Content skeleton -->
		<div class="space-y-2">
			<div class="{baseClasses} {animationClasses} rounded-md h-4 w-full"></div>
			<div class="{baseClasses} {animationClasses} rounded-md h-4 w-4/5"></div>
		</div>

		<!-- Footer skeleton -->
		<div
			class="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800"
		>
			<div class="flex items-center gap-4">
				<div class="{baseClasses} {animationClasses} rounded-md h-4 w-12"></div>
				<div class="{baseClasses} {animationClasses} rounded-md h-4 w-12"></div>
			</div>
			<div class="{baseClasses} {animationClasses} rounded-md h-4 w-16"></div>
		</div>
	</div>
{:else if variant === 'list'}
	<div class="space-y-4">
		{#each Array(lines || 3) as _}
			<div
				class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6"
			>
				<div class="flex items-start gap-4">
					<!-- Avatar skeleton -->
					<div class="{baseClasses} {animationClasses} rounded-full w-12 h-12 flex-shrink-0"></div>

					<div class="flex-1 space-y-2">
						<!-- Title skeleton -->
						<div class="{baseClasses} {animationClasses} rounded-md h-5 w-3/4"></div>

						<!-- Subtitle skeleton -->
						<div class="{baseClasses} {animationClasses} rounded-md h-4 w-1/2"></div>

						<!-- Content skeleton -->
						<div class="space-y-1">
							<div class="{baseClasses} {animationClasses} rounded-md h-4 w-full"></div>
							<div class="{baseClasses} {animationClasses} rounded-md h-4 w-4/5"></div>
						</div>
					</div>

					<!-- Action skeleton -->
					<div class="{baseClasses} {animationClasses} rounded-lg w-16 h-8 flex-shrink-0"></div>
				</div>
			</div>
		{/each}
	</div>
{:else}
	<!-- Rectangular skeleton -->
	<div class={containerClasses} style="width: {width || '100%'}; height: {height || '20px'};"></div>
{/if}

<style>
	@keyframes shimmer {
		100% {
			transform: translateX(100%);
		}
	}
</style>
