<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import SignInModal from './SignInModal.svelte';
  import ThemeToggle from './ThemeToggle.svelte';
  import { faCog, faUserPlus, faTimes, faUser, faSignOutAlt, faChevronDown } from '@fortawesome/free-solid-svg-icons';
  import Icon from 'svelte-fa';

  export let isDarkMode: boolean;
  export let onThemeChange: () => void;

  let user: any = null;
  let showSignInModal = false;
  let showSettingsModal = false;
  let showAdminModal = false;
  let showSignOutConfirm = false;
  let showUserMenu = false;
  let displayName = '';
  let tempDisplayName = '';
  let isAdmin = false;
  let authorizedUsers: any[] = [];
  let newUserEmail = '';
  let settingsError = '';
  let adminError = '';

  onMount(async () => {
    const { data: { user: initialUser } } = await supabase.auth.getUser();
    user = initialUser;

    if (user) {
      await loadUserData();
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
      user = session?.user;
      if (user) {
        await loadUserData();
      }
    });
  });

  async function loadUserData() {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('display_name')
      .eq('user_id', user.id)
      .single();

    if (profile) {
      displayName = profile.display_name;
    } else {
      // Create a profile if it doesn't exist
      const { error } = await supabase
        .from('user_profiles')
        .insert({
          user_id: user.id,
          display_name: user.email.split('@')[0] // Default display name
        });

      if (!error) {
        displayName = user.email.split('@')[0];
      }
    }

    // Check if user is an admin
    const { data: admin } = await supabase
      .from('admins')
      .select('*')
      .eq('user_id', user.id)
      .single();

    isAdmin = !!admin;
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    showSignOutConfirm = false;
    showUserMenu = false;
  }

  async function updateDisplayName() {
    if (!tempDisplayName.trim()) {
      settingsError = 'Display name cannot be empty';
      return;
    }

    const { error } = await supabase
      .from('user_profiles')
      .update({ display_name: tempDisplayName })
      .eq('user_id', user.id);

    if (error) {
      settingsError = error.message;
    } else {
      displayName = tempDisplayName;
      showSettingsModal = false;
      settingsError = '';
    }
  }

  async function addAuthorizedUser() {
    if (!newUserEmail.trim()) {
      adminError = 'Email cannot be empty';
      return;
    }

    const { error } = await supabase
      .from('authorized_users')
      .insert({ email: newUserEmail });

    if (error) {
      adminError = error.message;
    } else {
      await loadAuthorizedUsers();
      newUserEmail = '';
      adminError = '';
    }
  }

  async function loadAuthorizedUsers() {
    const { data, error } = await supabase
      .from('authorized_users')
      .select('*');

    if (!error && data) {
      authorizedUsers = data;
    }
  }

  function openSettings() {
    tempDisplayName = displayName;
    showSettingsModal = true;
    showUserMenu = false;
  }

  function openAdminPanel() {
    loadAuthorizedUsers();
    showAdminModal = true;
    showUserMenu = false;
  }

  function closeModal() {
    showSettingsModal = false;
    showAdminModal = false;
    showSignOutConfirm = false;
    settingsError = '';
    adminError = '';
  }

  // Close dropdown when clicking outside
  function handleClickOutside(event: MouseEvent) {
    if (showUserMenu && !(event.target as HTMLElement).closest('.user-menu')) {
      showUserMenu = false;
    }
  }
</script>

<svelte:window on:click={handleClickOutside} />

<div class="flex items-center space-x-4">
  <!-- Theme Toggle -->
  <ThemeToggle checked={isDarkMode} onChange={onThemeChange} />
  
  <!-- User Section -->
  {#if user}
    <!-- Authenticated User -->
    <div class="relative user-menu">
      <button 
        class="flex items-center space-x-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 px-2 py-1 transition-colors duration-200"
        on:click={() => showUserMenu = !showUserMenu}
      >
        <div class="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-700 dark:text-primary-300">
          {#if displayName}
            <span>{displayName[0].toUpperCase()}</span>
          {:else}
            <Icon icon={faUser} class="h-4 w-4" />
          {/if}
        </div>
        <Icon icon={faChevronDown} class="h-3 w-3 text-gray-500 dark:text-gray-400" />
      </button>
      
      {#if showUserMenu}
        <div class="absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-50">
          <div class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
            {displayName || user.email}
          </div>
          <button 
            class="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            on:click={openSettings}
          >
            <div class="flex items-center">
              <Icon icon={faCog} class="mr-2 h-4 w-4" />
              <span>Settings</span>
            </div>
          </button>
          {#if isAdmin}
            <button 
              class="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              on:click={openAdminPanel}
            >
              <div class="flex items-center">
                <Icon icon={faUserPlus} class="mr-2 h-4 w-4" />
                <span>Admin Panel</span>
              </div>
            </button>
          {/if}
          <button 
            class="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            on:click={() => showSignOutConfirm = true}
          >
            <div class="flex items-center">
              <Icon icon={faSignOutAlt} class="mr-2 h-4 w-4" />
              <span>Sign Out</span>
            </div>
          </button>
        </div>
      {/if}
    </div>
  {:else}
    <!-- Sign In Button -->
    <button 
      class="btn-primary text-sm px-3 py-1.5"
      on:click={() => showSignInModal = true}
    >
      Sign In
    </button>
  {/if}
</div>

<!-- Settings Modal -->
{#if showSettingsModal}
  <div class="modal">
    <div class="modal-backdrop" on:click={closeModal}></div>
    <div class="modal-content max-w-md">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold">User Settings</h2>
        <button class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300" on:click={closeModal}>
          <Icon icon={faTimes} />
        </button>
      </div>
      
      <div class="mb-6">
        <label for="displayName" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Display Name
        </label>
        <input
          type="text"
          id="displayName"
          class="form-input"
          bind:value={tempDisplayName}
        />
        {#if settingsError}
          <p class="mt-1 text-sm text-error-500">{settingsError}</p>
        {/if}
      </div>
      
      <div class="flex justify-end space-x-3">
        <button class="btn-secondary" on:click={closeModal}>Cancel</button>
        <button class="btn-primary" on:click={updateDisplayName}>Save Changes</button>
      </div>
    </div>
  </div>
{/if}

<!-- Admin Modal -->
{#if showAdminModal}
  <div class="modal">
    <div class="modal-backdrop" on:click={closeModal}></div>
    <div class="modal-content max-w-md">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold">Admin Panel</h2>
        <button class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300" on:click={closeModal}>
          <Icon icon={faTimes} />
        </button>
      </div>
      
      <div class="mb-6">
        <h3 class="text-lg font-medium mb-2">Authorized Users</h3>
        
        <div class="space-y-2 mb-4 max-h-40 overflow-y-auto">
          {#if authorizedUsers.length === 0}
            <p class="text-sm text-gray-500 dark:text-gray-400">No authorized users added yet.</p>
          {:else}
            {#each authorizedUsers as user}
              <div class="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                <span class="text-sm">{user.email}</span>
                <button class="text-gray-500 hover:text-error-500 dark:text-gray-400 dark:hover:text-error-400">
                  <Icon icon={faTimes} />
                </button>
              </div>
            {/each}
          {/if}
        </div>
        
        <div class="flex space-x-2">
          <input
            type="email"
            placeholder="user@example.com"
            class="form-input flex-grow"
            bind:value={newUserEmail}
          />
          <button class="btn-primary" on:click={addAuthorizedUser}>Add</button>
        </div>
        
        {#if adminError}
          <p class="mt-1 text-sm text-error-500">{adminError}</p>
        {/if}
      </div>
      
      <div class="flex justify-end">
        <button class="btn-secondary" on:click={closeModal}>Close</button>
      </div>
    </div>
  </div>
{/if}

<!-- Sign Out Confirmation -->
{#if showSignOutConfirm}
  <div class="modal">
    <div class="modal-backdrop" on:click={closeModal}></div>
    <div class="modal-content max-w-sm">
      <h2 class="text-xl font-semibold mb-4">Sign Out</h2>
      <p class="mb-6">Are you sure you want to sign out?</p>
      
      <div class="flex justify-end space-x-3">
        <button class="btn-secondary" on:click={closeModal}>Cancel</button>
        <button class="btn-danger" on:click={handleSignOut}>Sign Out</button>
      </div>
    </div>
  </div>
{/if}

<!-- Sign In Modal -->
{#if showSignInModal}
  <SignInModal on:close={() => (showSignInModal = false)} />
{/if}
