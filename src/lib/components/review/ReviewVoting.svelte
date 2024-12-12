<script lang="ts">
  import { faThumbsUp, faThumbsDown } from '@fortawesome/free-solid-svg-icons';
  import Icon from 'svelte-fa';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher<{
    vote: 'up' | 'down';
  }>();

  export let upvotes: number = 0;
  export let downvotes: number = 0;
  export let userVote: 'up' | 'down' | null = null;
  export let isProcessing: boolean = false;

  function handleVote(type: 'up' | 'down') {
    if (!isProcessing) {
      dispatch('vote', type);
    }
  }
</script>

<div class="p-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900">
  <div class="flex items-center justify-center space-x-8 sm:space-x-12">
    <button
      on:click={() => handleVote('up')}
      disabled={isProcessing}
      class="flex flex-col items-center p-4 rounded-lg transition-colors
             {userVote === 'up' ? 'text-green-500 bg-green-100 dark:bg-green-900' : 
             'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}
             {isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
             min-w-[64px] min-h-[64px] touch-manipulation"
      aria-label="Upvote review"
    >
      <Icon icon={faThumbsUp} class="text-2xl mb-2" />
      <span class="font-medium text-base">{upvotes}</span>
    </button>
    
    <button
      on:click={() => handleVote('down')}
      disabled={isProcessing}
      class="flex flex-col items-center p-4 rounded-lg transition-colors
             {userVote === 'down' ? 'text-red-500 bg-red-100 dark:bg-red-900' : 
             'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}
             {isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
             min-w-[64px] min-h-[64px] touch-manipulation"
      aria-label="Downvote review"
    >
      <Icon icon={faThumbsDown} class="text-2xl mb-2" />
      <span class="font-medium text-base">{downvotes}</span>
    </button>
  </div>
</div>
