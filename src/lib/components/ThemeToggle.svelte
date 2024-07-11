<script lang="ts">
    export let checked: boolean;
    export let onChange: () => void;
  </script>
  
  <button
    on:click={onChange}
    class="p-2 rounded-full bg-gray-200 dark:bg-gray-700"
  >
    {#if checked}
      🌙
    {:else}
      ☀️
    {/if}
  </button>