<script lang="ts">
  import { faTimes, faTrash } from '@fortawesome/free-solid-svg-icons';
  import Icon from 'svelte-fa';
  import type { Location } from './types';

  export let restaurantName: string;
  export let onClose: () => void;
  export let isAdmin = false;
  export let onDeleteClick: (() => void) | null = null;
</script>

<div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 
            sticky top-0 bg-white dark:bg-gray-900 z-10">
  <h2 class="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 truncate pr-4">
    {restaurantName}
  </h2>
  <div class="flex items-center space-x-2">
    {#if isAdmin && onDeleteClick}
      <button
        on:click={onDeleteClick}
        class="p-3 rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20
               transition-colors focus:outline-none focus:ring-2 focus:ring-red-300
               dark:focus:ring-red-600 min-w-[44px] min-h-[44px] touch-manipulation"
        aria-label="Delete review (Admin)"
        title="Delete review"
      >
        <Icon icon={faTrash} class="text-lg" />
      </button>
    {/if}
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
</div>
