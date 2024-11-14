<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import SignInModal from './SignInModal.svelte';
  import { faCog, faUserPlus, faTimes } from '@fortawesome/free-solid-svg-icons';
  import Icon from 'svelte-fa';

  let user: any = null;
  let showSignInModal = false;
  let showSettingsModal = false;
  let showAdminModal = false;
  let displayName = '';
  let isAdmin = false;
  let authorizedUsers: any[] = [];
  let newUserEmail = '';
  let settingsError = '';
  let adminError = '';

  onMount(async () => {
    // Get initial auth state
    const { data: { user: initialUser } } = await supabase.auth.getUser();
    user = initialUser;

    if (user) {
      await loadUserData();
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (_event, session) => {
      user = session?.user;
      if (user) {
        await loadUserData();
      }
    });
  });

  async function loadUserData() {
    // Load user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('display_name')
      .eq('user_id', user.id)
      .single();

    if (profile) {
      displayName = profile.display_name;
    } else {
      // Create default profile if none exists
      const defaultName = user.email.split('@')[0];
      await supabase
        .from('user_profiles')
        .insert([{ user_id: user.id, display_name: defaultName }]);
      displayName = defaultName;
    }

    // Check if admin
    const { data: adminData } = await supabase
      .from('authorized_users')
      .select('is_admin')
      .eq('user_id', user.id)
      .single();

    isAdmin = adminData?.is_admin || false;

    if (isAdmin) {
      await loadAuthorizedUsers();
    }
  }

  async function loadAuthorizedUsers() {
    const { data } = await supabase
      .from('authorized_users')
      .select(`
        user_id,
        authorized_at,
        authorized_by,
        is_admin,
        profiles:user_profiles(display_name)
      `)
      .order('authorized_at', { ascending: false });

    authorizedUsers = data || [];
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  async function updateDisplayName() {
    if (!displayName.trim()) {
      settingsError = 'Display name cannot be empty';
      return;
    }

    const { error } = await supabase
      .from('user_profiles')
      .update({ display_name: displayName.trim(), updated_at: new Date().toISOString() })
      .eq('user_id', user.id);

    if (error) {
      settingsError = error.message;
    } else {
      showSettingsModal = false;
    }
  }

  async function authorizeUser() {
    if (!newUserEmail.trim()) {
      adminError = 'Email cannot be empty';
      return;
    }

    try {
      // Get user ID from email
      const { data: userData, error: userError } = await supabase
        .from('auth.users')
        .select('id')
        .eq('email', newUserEmail.trim())
        .single();

      if (userError || !userData) {
        adminError = 'User not found';
        return;
      }

      const { error } = await supabase
        .from('authorized_users')
        .insert([{
          user_id: userData.id,
          authorized_by: user.id
        }]);

      if (error) {
        adminError = error.message;
      } else {
        newUserEmail = '';
        await loadAuthorizedUsers();
      }
    } catch (err) {
      adminError = 'Error authorizing user';
      console.error('Error:', err);
    }
  }
</script>

<div class="fixed top-4 right-4 z-[2000]">
  {#if user}
    <div class="flex items-center gap-4">
      <span class="text-gray-700 dark:text-gray-300">{displayName}</span>
      <button
        on:click={() => showSettingsModal = true}
        class="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <Icon icon={faCog} />
      </button>
      {#if isAdmin}
        <button
          on:click={() => showAdminModal = true}
          class="px-3 py-1 text-sm bg-purple-500 hover:bg-purple-600 text-white rounded-md"
        >
          Admin Panel
        </button>
      {/if}
      <button
        on:click={handleSignOut}
        class="px-3 py-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded-md"
      >
        Sign Out
      </button>
    </div>
  {:else}
    <button
      on:click={() => showSignInModal = true}
      class="px-3 py-1 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md"
    >
      Sign In
    </button>
  {/if}
</div>

<!-- Settings Modal -->
{#if showSettingsModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 z-[3000] flex items-center justify-center p-4">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">User Settings</h2>
        <button 
          on:click={() => showSettingsModal = false}
          class="text-gray-400 hover:text-gray-500"
        >
          <Icon icon={faTimes} />
        </button>
      </div>

      <div class="space-y-4">
        {#if settingsError}
          <p class="text-red-600 dark:text-red-400">{settingsError}</p>
        {/if}

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Display Name
          </label>
          <input
            type="text"
            bind:value={displayName}
            class="w-full p-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
          />
        </div>

        <button
          on:click={updateDisplayName}
          class="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
        >
          Save Changes
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Admin Modal -->
{#if showAdminModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 z-[3000] flex items-center justify-center p-4">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">Admin Panel</h2>
        <button 
          on:click={() => showAdminModal = false}
          class="text-gray-400 hover:text-gray-500"
        >
          <Icon icon={faTimes} />
        </button>
      </div>

      <div class="space-y-6">
        <!-- Add New User -->
        <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h3 class="text-lg font-semibold mb-4">Authorize New User</h3>
          
          {#if adminError}
            <p class="text-red-600 dark:text-red-400 mb-4">{adminError}</p>
          {/if}

          <div class="flex gap-4">
            <input
              type="email"
              bind:value={newUserEmail}
              placeholder="Enter user email"
              class="flex-1 p-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
            />
            <button
              on:click={authorizeUser}
              class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md"
            >
              <Icon icon={faUserPlus} class="mr-2" />
              Authorize
            </button>
          </div>
        </div>

        <!-- Authorized Users List -->
        <div>
          <h3 class="text-lg font-semibold mb-4">Authorized Users</h3>
          <div class="bg-white dark:bg-gray-700 rounded-lg shadow overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
              <thead class="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Display Name
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Authorized At
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Admin
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white dark:bg-gray-700 divide-y divide-gray-200 dark:divide-gray-600">
                {#each authorizedUsers as user}
                  <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-gray-100">
                      {user.profiles?.display_name || 'N/A'}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-300">
                      {new Date(user.authorized_at).toLocaleDateString()}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-300">
                      {user.is_admin ? 'Yes' : 'No'}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<SignInModal 
  show={showSignInModal}
  onClose={() => showSignInModal = false}
/>
