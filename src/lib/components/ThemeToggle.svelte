<script lang="ts">
  import { faSun, faMoon } from '@fortawesome/free-solid-svg-icons';
  import Icon from 'svelte-fa';
  
  export let checked: boolean;
  export let onChange: () => void;
</script>

<button
  on:click={onChange}
  class="p-2 rounded-full transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
  aria-label={checked ? "Switch to dark mode" : "Switch to light mode"}
>
  {#if checked}
    <Icon icon={faSun} class="text-yellow-500 h-5 w-5" />
  {:else}
    <Icon icon={faMoon} class="text-gray-400 h-5 w-5" />
  {/if}
</button>
