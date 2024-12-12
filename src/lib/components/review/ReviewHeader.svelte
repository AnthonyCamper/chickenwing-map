<script lang="ts">
  import { faTimes } from '@fortawesome/free-solid-svg-icons';
  import Icon from 'svelte-fa';
  import type { Location } from './types';

  export let restaurantName: string;
  export let onClose: () => void;
</script>

<div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 
            sticky top-0 bg-white dark:bg-gray-900 z-10">
  <h2 class="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 truncate pr-4">
    {restaurantName}
  </h2>
  <button 
    on:click={onClose} 
    class="p-3 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 
           transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300 
           dark:focus:ring-gray-600 min-w-[44px] min-h-[44px] touch-manipulation"
    aria-label="Close review"
  >
    <Icon icon={faTimes} class="text-xl" />
  </button>
</div>
