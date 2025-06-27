<script lang="ts">
  import { faSun, faMoon } from '@fortawesome/free-solid-svg-icons';
  import Icon from 'svelte-fa';
  
  export let checked: boolean = false;
  export let onChange: () => void;
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let variant: 'button' | 'switch' = 'switch';
  
  // Size classes
  $: sizeClasses = {
    sm: {
      container: 'w-11 h-6',
      toggle: 'w-4 h-4',
      translate: checked ? 'translate-x-5' : 'translate-x-1',
      icon: 'h-3 w-3'
    },
    md: {
      container: 'w-14 h-7',
      toggle: 'w-5 h-5',
      translate: checked ? 'translate-x-7' : 'translate-x-1',
      icon: 'h-4 w-4'
    },
    lg: {
      container: 'w-16 h-8',
      toggle: 'w-6 h-6',
      translate: checked ? 'translate-x-8' : 'translate-x-1',
      icon: 'h-5 w-5'
    }
  }[size];
</script>

{#if variant === 'switch'}
  <!-- Modern toggle switch -->
  <button
    on:click={onChange}
    class="relative inline-flex {sizeClasses.container} items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900
           {checked 
             ? 'bg-gradient-to-r from-primary-500 to-primary-600 shadow-lg shadow-primary-500/25' 
             : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'}"
    aria-label={checked ? "Switch to light mode" : "Switch to dark mode"}
    role="switch"
    aria-checked={checked}
  >
    <!-- Toggle circle -->
    <div class="relative {sizeClasses.toggle} {sizeClasses.translate} bg-white rounded-full shadow-lg transform transition-all duration-300 flex items-center justify-center">
      <!-- Icon with smooth transition -->
      <div class="relative w-full h-full flex items-center justify-center">
        <!-- Sun icon -->
        <div class="absolute inset-0 flex items-center justify-center transition-all duration-300 {checked ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-180 scale-50'}">
          <Icon icon={faSun} class="{sizeClasses.icon} text-yellow-500" />
        </div>
        
        <!-- Moon icon -->
        <div class="absolute inset-0 flex items-center justify-center transition-all duration-300 {checked ? 'opacity-0 -rotate-180 scale-50' : 'opacity-100 rotate-0 scale-100'}">
          <Icon icon={faMoon} class="{sizeClasses.icon} text-gray-600" />
        </div>
      </div>
    </div>
    
    <!-- Background gradient overlay for extra visual appeal -->
    <div class="absolute inset-0 rounded-full bg-gradient-to-r {checked ? 'from-primary-400 to-primary-500' : 'from-gray-100 to-gray-200 dark:from-gray-600 dark:to-gray-700'} opacity-50 transition-all duration-300"></div>
  </button>
{:else}
  <!-- Button variant -->
  <button
    on:click={onChange}
    class="relative inline-flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 group
           {checked 
             ? 'bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/30 dark:to-primary-800/30 text-primary-600 dark:text-primary-400 shadow-lg shadow-primary-500/20' 
             : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}"
    aria-label={checked ? "Switch to light mode" : "Switch to dark mode"}
  >
    <!-- Background animation -->
    <div class="absolute inset-0 rounded-full bg-gradient-to-br from-white/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
    
    <!-- Icon container with animation -->
    <div class="relative flex items-center justify-center">
      <!-- Sun icon -->
      <div class="absolute transition-all duration-500 {checked ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-180 scale-0'}">
        <Icon icon={faSun} class="h-5 w-5 text-yellow-500" />
      </div>
      
      <!-- Moon icon -->
      <div class="absolute transition-all duration-500 {checked ? 'opacity-0 -rotate-180 scale-0' : 'opacity-100 rotate-0 scale-100'}">
        <Icon icon={faMoon} class="h-5 w-5" />
      </div>
    </div>
  </button>
{/if}
