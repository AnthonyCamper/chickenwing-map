<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import SignInModal from './SignInModal.svelte';

  let user: any = null;
  let showSignInModal = false;

  onMount(async () => {
    // Get initial auth state
    const { data: { user: initialUser } } = await supabase.auth.getUser();
    user = initialUser;

    // Listen for auth changes
    supabase.auth.onAuthStateChange((_event, session) => {
      user = session?.user;
    });
  });

  async function handleSignOut() {
    await supabase.auth.signOut();
  }
</script>

<div class="fixed top-4 right-4 z-[2000]">
  {#if user}
    <div class="flex items-center gap-4">
      <span class="text-gray-700 dark:text-gray-300">{user.email}</span>
      <button
        on:click={handleSignOut}
        class="px-3 py-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors"
      >
        Sign Out
      </button>
    </div>
  {:else}
    <button
      on:click={() => showSignInModal = true}
      class="px-3 py-1 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
    >
      Sign In
    </button>
  {/if}
</div>

<SignInModal 
  show={showSignInModal}
  onClose={() => showSignInModal = false}
/>
