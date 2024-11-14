<script lang="ts">
  import { fly } from 'svelte/transition';
  import { faTimes } from '@fortawesome/free-solid-svg-icons';
  import Icon from 'svelte-fa';
  import { supabase } from '$lib/supabase';

  export let show = false;
  export let onClose: () => void;

  let loading = false;
  let error = '';

  // Get the base URL for redirects
  const redirectUrl = window.location.origin === 'http://localhost:5173' 
    ? 'http://localhost:5173'
    : 'https://wingkingtony.com';

  async function signInWithGoogle() {
    try {
      loading = true;
      error = '';

      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${redirectUrl}/`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });

      if (signInError) throw signInError;
      
      // Close modal after initiating OAuth
      onClose();
    } catch (err) {
      if (err instanceof Error) {
        error = err.message;
      } else {
        error = 'An error occurred during sign in';
      }
    } finally {
      loading = false;
    }
  }
</script>

{#if show}
  <div class="fixed inset-0 bg-black bg-opacity-50 z-[3000] flex items-center justify-center p-4">
    <div 
      transition:fly={{ y: 20, duration: 300 }}
      class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6"
    >
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">Sign in to vote</h2>
        <button 
          on:click={onClose}
          class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
        >
          <Icon icon={faTimes} />
        </button>
      </div>

      <div class="space-y-4">
        {#if error}
          <p class="text-red-600 dark:text-red-400 text-center">
            {error}
          </p>
        {/if}

        <button
          on:click={signInWithGoogle}
          disabled={loading}
          class="w-full flex items-center justify-center gap-3 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" class="w-5 h-5" />
          {loading ? 'Signing in...' : 'Continue with Google'}
        </button>

        <p class="text-sm text-gray-500 dark:text-gray-400 text-center mt-4">
          Sign in securely with your Google account to vote on reviews.
        </p>
      </div>
    </div>
  </div>
{/if}
