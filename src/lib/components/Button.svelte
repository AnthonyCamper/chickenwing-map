<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  // Props
  export let variant: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' = 'primary';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let disabled = false;
  export let loading = false;
  export let fullWidth = false;
  export let type: 'button' | 'submit' | 'reset' = 'button';
  export let href: string | undefined = undefined;
  export let target: string | undefined = undefined;
  
  // Event dispatcher
  const dispatch = createEventDispatcher<{
    click: MouseEvent;
  }>();
  
  function handleClick(event: MouseEvent) {
    if (!disabled && !loading) {
      dispatch('click', event);
    }
  }
  
  // Computed classes
  $: baseClasses = "inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
  
  $: variantClasses = {
    primary: "bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500 shadow-sm hover:shadow-md",
    secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 shadow-sm",
    outline: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 shadow-sm",
    ghost: "text-gray-700 hover:bg-gray-100 focus:ring-gray-500 dark:text-gray-300 dark:hover:bg-gray-800",
    destructive: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-sm hover:shadow-md"
  }[variant];
  
  $: sizeClasses = {
    sm: "px-3 py-1.5 text-xs rounded-md",
    md: "px-4 py-2 text-sm rounded-md",
    lg: "px-6 py-3 text-base rounded-lg"
  }[size];
  
  $: widthClasses = fullWidth ? "w-full" : "";
  
  $: classes = `${baseClasses} ${variantClasses} ${sizeClasses} ${widthClasses}`;
</script>

{#if href}
  <a 
    {href} 
    {target}
    class={classes}
    class:opacity-50={disabled}
    class:pointer-events-none={disabled}
    role="button"
    tabindex={disabled ? -1 : 0}
  >
    {#if loading}
      <svg class="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    {/if}
    <slot />
  </a>
{:else}
  <button
    {type}
    {disabled}
    class={classes}
    on:click={handleClick}
  >
    {#if loading}
      <svg class="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    {/if}
    <slot />
  </button>
{/if}