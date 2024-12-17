<script lang="ts">
  import { faStar as faStarSolid } from '@fortawesome/free-solid-svg-icons';
  import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons';
  import Icon from 'svelte-fa';

  export let rating: number | null;
  export let label: string;
  export let showValue = true;
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let color = 'yellow';

  const maxRating = 10;
  
  $: stars = rating !== null ? Math.round((rating / 2) * 2) / 2 : 0;
  $: fullStars = Math.floor(stars);
  $: hasHalfStar = stars % 1 !== 0;

  const colorClasses = {
    yellow: 'text-yellow-400',
    green: 'text-green-500',
    blue: 'text-blue-500',
    red: 'text-red-500',
    purple: 'text-purple-500'
  };

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };
</script>

<div class="flex items-center gap-2 {sizeClasses[size]}">
  {#if label}
    <span class="text-gray-600 dark:text-gray-300 min-w-[120px]">{label}:</span>
  {/if}
  
  <div class="flex items-center gap-1">
    {#if rating === null}
      <span class="text-gray-400">N/A</span>
    {:else}
      <div class="flex items-center gap-0.5 {colorClasses[color]}">
        {#each Array(5) as _, i}
          <Icon 
            icon={i < fullStars / 2 ? faStarSolid : faStarRegular} 
            class="transition-colors duration-200"
          />
        {/each}
      </div>
      {#if showValue}
        <span class="ml-2 font-medium text-gray-700 dark:text-gray-300">
          {rating}/10
        </span>
      {/if}
    {/if}
  </div>
</div>
