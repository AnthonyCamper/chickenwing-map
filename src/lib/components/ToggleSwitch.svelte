<script lang="ts">
    export let checked: boolean;
    export let onChange: () => void;
    export let label: string;
  </script>
  
  <label class="flex items-center cursor-pointer">
    <div class="relative">
      <input
        type="checkbox"
        class="sr-only"
        {checked}
        on:change={onChange}
      />
      <div class="w-10 h-4 bg-gray-400 rounded-full shadow-inner"></div>
      <div class="dot absolute w-6 h-6 bg-white rounded-full shadow -left-1 -top-1 transition"></div>
    </div>
    <div class="ml-3 text-gray-700 dark:text-gray-300 font-medium">
      {label}
    </div>
  </label>
  
  <style>
    input:checked ~ .dot {
      transform: translateX(100%);
      background-color: #4299e1;
    }
  </style>