<script lang="ts">
  import "../app.css";
  import UserDisplay from "$lib/components/UserDisplay.svelte";
  import { onMount } from 'svelte';
  
  let isDarkMode = false;
  
  onMount(() => {
    // Check for saved theme preference or system preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
      isDarkMode = true;
    } else {
      document.documentElement.classList.remove('dark');
      isDarkMode = false;
    }
  });
  
  function toggleTheme() {
    isDarkMode = !isDarkMode;
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }
</script>

<div class="min-h-screen flex flex-col">
  <!-- Header: Fixed at top -->
  <header class="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
    <div class="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center h-16">
        <!-- Logo/Brand -->
        <div class="flex items-center">
          <a href="/" class="flex items-center space-x-2">
            <span class="text-2xl font-bold text-primary-600 dark:text-primary-400">ChickenWing</span>
            <span class="text-sm text-gray-500 dark:text-gray-400">Map</span>
          </a>
        </div>
        
        <!-- User Display (positioned at right) -->
        <div>
          <UserDisplay isDarkMode={isDarkMode} onThemeChange={toggleTheme} />
        </div>
      </div>
    </div>
  </header>

  <!-- Main Content: Flex-1 to fill available space -->
  <main class="flex-1">
    <slot />
  </main>
</div>
