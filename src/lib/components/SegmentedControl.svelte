<script lang="ts" context="module">
	export interface SegmentOption {
		value: string;
		label: string;
		icon?: any;
	}
</script>

<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Icon from 'svelte-fa';

	// Props
	export let options: SegmentOption[] = [];
	export let value: string = '';
	export let size: 'sm' | 'md' | 'lg' = 'md';
	export let fullWidth = false;

	// Event dispatcher
	const dispatch = createEventDispatcher<{
		change: string;
	}>();

	function handleSelect(optionValue: string) {
		value = optionValue;
		dispatch('change', optionValue);
	}

	// Computed classes
	$: containerClasses = fullWidth ? 'w-full' : 'w-auto';

	$: sizeClasses = {
		sm: {
			container: 'p-0.5',
			button: 'px-3 py-1.5 text-xs',
			icon: 'h-3 w-3'
		},
		md: {
			container: 'p-1',
			button: 'px-4 py-2 text-sm',
			icon: 'h-4 w-4'
		},
		lg: {
			container: 'p-1.5',
			button: 'px-6 py-3 text-base',
			icon: 'h-5 w-5'
		}
	}[size];
</script>

<div class="inline-flex {containerClasses}">
	<div class="flex bg-gray-100 dark:bg-gray-800 rounded-lg {sizeClasses.container}">
		{#each options as option, index (option.value)}
			<button
				type="button"
				class="relative flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:z-10
               {sizeClasses.button}
               {index === 0 ? 'rounded-l-md' : ''}
               {index === options.length - 1 ? 'rounded-r-md' : ''}
               {value === option.value
					? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
					: 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'}"
				on:click={() => handleSelect(option.value)}
				aria-pressed={value === option.value}
			>
				{#if option.icon}
					<Icon icon={option.icon} class="{sizeClasses.icon} {option.label ? 'mr-2' : ''}" />
				{/if}
				{#if option.label}
					<span>{option.label}</span>
				{/if}
			</button>
		{/each}
	</div>
</div>
