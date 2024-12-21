<script lang="ts">
    export let checked: boolean;
    export let onChange: () => void;
  </script>
  
  <button
    on:click={onChange}
    class="p-1.5 rounded-full bg-gray-200 dark:bg-gray-700 text-sm"
  >
    {#if checked}
      ☀️
    {:else}
      🌙
    {/if}
  </button>
