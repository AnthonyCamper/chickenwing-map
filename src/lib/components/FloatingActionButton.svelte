<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Icon from 'svelte-fa';
  import { faPlus } from '@fortawesome/free-solid-svg-icons';
  
  // Props
  export let icon = faPlus;
  export let label = 'Add';
  export let size: 'sm' | 'md' | 'lg' = 'lg';
  export let position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' = 'bottom-right';
  export let variant: 'primary' | 'secondary' = 'primary';
  export let showLabel = false;
  export let pulse = false;
  
  // Event dispatcher
  const dispatch = createEventDispatcher<{
    click: MouseEvent;
  }>();
  
  function handleClick(event: MouseEvent) {
    dispatch('click', event);
  }
  
  // Computed classes
  $: sizeClasses = {
    sm: {
      button: 'w-12 h-12',
      icon: 'h-5 w-5',
      label: 'text-sm px-3 py-2'
    },
    md: {
      button: 'w-14 h-14',
      icon: 'h-6 w-6', 
      label: 'text-sm px-4 py-2'
    },
    lg: {
      button: 'w-16 h-16',
      icon: 'h-7 w-7',
      label: 'text-base px-4 py-3'
    }
  }[size];
  
  $: positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'top-right': 'top-6 right-6', 
    'top-left': 'top-6 left-6'
  }[position];
  
  $: variantClasses = {
    primary: 'bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30',
    secondary: 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl hover:bg-gray-50 dark:hover:bg-gray-700'
  }[variant];
</script>

<div class="fixed {positionClasses} z-50">
  <div class="flex items-center gap-3 {showLabel && position.includes('right') ? 'flex-row-reverse' : ''}">
    
    <!-- Main FAB button -->
    <button
      class="group relative {sizeClasses.button} {variantClasses} rounded-full transition-all duration-300 transform hover:scale-110 active:scale-95 focus:outline-none focus:ring-4 focus:ring-primary-500/20 {pulse ? 'animate-pulse' : ''}"
      on:click={handleClick}
      aria-label={label}
    >
      <!-- Background glow effect -->
      <div class="absolute inset-0 rounded-full bg-gradient-to-r from-primary-400 to-primary-500 opacity-0 group-hover:opacity-20 transition-opacity duration-300 blur-xl"></div>
      
      <!-- Icon container -->
      <div class="relative flex items-center justify-center w-full h-full">
        <Icon {icon} class="{sizeClasses.icon} transition-transform duration-300 group-hover:rotate-90" />
      </div>
      
      <!-- Ripple effect on click -->
      <div class="absolute inset-0 rounded-full bg-white/20 scale-0 opacity-0 group-active:scale-100 group-active:opacity-100 transition-all duration-150"></div>
    </button>
    
    <!-- Optional label -->
    {#if showLabel}
      <div 
        class="bg-gray-900 dark:bg-gray-700 text-white dark:text-gray-100 {sizeClasses.label} rounded-lg shadow-lg whitespace-nowrap opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 pointer-events-none"
        style="transform-origin: {position.includes('right') ? 'right' : 'left'} center;"
      >
        {label}
      </div>
    {/if}
  </div>
  
  <!-- Floating particles animation (optional) -->
  {#if pulse}
    <div class="absolute inset-0 pointer-events-none">
      {#each Array(3) as _, i}
        <div 
          class="absolute w-2 h-2 bg-primary-400 rounded-full opacity-60 animate-ping"
          style="animation-delay: {i * 0.5}s; animation-duration: 2s;"
        ></div>
      {/each}
    </div>
  {/if}
</div>

<style>
  /* Custom animations for enhanced micro-interactions */
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-6px); }
  }
  
  .group:hover {
    animation: float 2s ease-in-out infinite;
  }
</style>