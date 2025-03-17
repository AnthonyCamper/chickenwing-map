<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { faTimes } from '@fortawesome/free-solid-svg-icons';
  import { faGoogle } from '@fortawesome/free-brands-svg-icons';
  import Icon from 'svelte-fa';
  import { supabase } from '$lib/supabase';
  import { onMount } from 'svelte';

  const dispatch = createEventDispatcher();
  
  let loading = false;
  let error = '';
  let redirectUrl = '';

  onMount(() => {
    // Set redirect URL only after component is mounted in browser
    redirectUrl = window.location.origin === 'http://localhost:5173' 
      ? 'http://localhost:5173'
      : 'https://wingkingtony.com';
  });

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
      dispatch('close');
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
  
  function close() {
    dispatch('close');
  }
</script>

<style>
  .modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999; /* High z-index to be above everything */
  }

  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: -1;
  }

  .modal-content {
    background-color: white;
    padding: 1.5rem;
    border-radius: 0.5rem;
    width: 90%;
    max-width: 500px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  :global(.dark) .modal-content {
    background-color: #1f2937;
    color: white;
  }
</style>

<div class="modal">
  <div 
    class="modal-backdrop" 
    on:click={close}
    on:keydown={(e) => e.key === 'Enter' && close()}
    role="button"
    tabindex="0"
    aria-label="Close sign in dialog"
  ></div>
  <div class="modal-content max-w-md">
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Sign In</h2>
      <button 
        on:click={close}
        class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
      >
        <Icon icon={faTimes} />
      </button>
    </div>

    <div class="space-y-6">
      <p class="text-gray-600 dark:text-gray-300 text-center">
        Sign in to add reviews, vote, and interact with the community.
      </p>

      {#if error}
        <div class="bg-error-50 text-error-600 p-3 rounded-md text-sm">
          {error}
        </div>
      {/if}

      <button
        on:click={signInWithGoogle}
        disabled={loading}
        class="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
      >
        <Icon icon={faGoogle} class="h-5 w-5" />
        {loading ? 'Signing in...' : 'Continue with Google'}
      </button>
      
      <p class="text-xs text-gray-500 dark:text-gray-400 text-center">
        By signing in, you agree to our Terms of Service and Privacy Policy.
      </p>
    </div>
  </div>
</div>
