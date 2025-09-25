<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { faTimes, faUser, faSearch, faUserPlus, faEdit, faTrash, faShield } from '@fortawesome/free-solid-svg-icons';
  import Icon from 'svelte-fa';

  export let onClose: () => void;
  export let currentUserId: string;

  interface AuthorizedUser {
    user_id: string;
    display_name: string | null;
    email: string | null;
    is_admin: boolean;
    can_add_reviews: boolean;
    can_delete_reviews: boolean;
    can_edit_reviews: boolean;
    authorized_at: string;
    authorized_by: string | null;
    notes: string | null;
  }

  let authorizedUsers: AuthorizedUser[] = [];
  let searchEmail = '';
  let searchResults: any[] = [];
  let isSearching = false;
  let error = '';
  let success = '';
  let selectedUser: AuthorizedUser | null = null;
  let showEditModal = false;

  // Edit form fields
  let editForm = {
    is_admin: false,
    can_add_reviews: true,
    can_delete_reviews: false,
    can_edit_reviews: false,
    notes: ''
  };

  onMount(() => {
    loadAuthorizedUsers();
  });

  async function loadAuthorizedUsers() {
    try {
      // Use the enhanced database function to get users with emails from auth.users
      const { data, error: err } = await supabase.rpc('get_authorized_users_with_auth_emails');

      if (err) {
        error = `Error loading users: ${err.message}`;
        return;
      }

      if (!data) {
        authorizedUsers = [];
        return;
      }

      // Map the data from the database function
      authorizedUsers = data.map(user => ({
        user_id: user.user_id,
        display_name: user.display_name,
        email: user.email, // Now comes from auth.users
        is_admin: user.is_admin || false,
        can_add_reviews: user.can_add_reviews ?? true,
        can_delete_reviews: user.can_delete_reviews ?? false,
        can_edit_reviews: user.can_edit_reviews ?? false,
        authorized_at: user.authorized_at,
        authorized_by: user.authorized_by,
        notes: user.notes
      }));
    } catch (err) {
      // If the function fails (e.g., user is not admin), fall back to the old method
      error = `Access denied: Only administrators can view user details`;
    }
  }

  async function searchUsers() {
    if (!searchEmail.trim()) return;

    isSearching = true;
    error = '';

    try {
      // Use the enhanced auth users search function
      const { data, error: err } = await supabase.rpc('search_auth_users', {
        search_term: searchEmail.trim()
      });

      if (err) {
        error = `Search failed: ${err.message}`;
        searchResults = [];
      } else {
        searchResults = data || [];
        if (data && data.length === 0) {
          error = 'No users found matching that email. You can still add users directly by UUID using the + button.';
        } else if (data && data.length > 0) {
          error = ''; // Clear any previous errors
        }
      }
    } catch (err) {
      error = `Search failed: ${err}`;
      searchResults = [];
    }

    isSearching = false;
  }

  async function addUserById() {
    if (!searchEmail.trim()) return;

    try {
      // Assume the input is a user ID (UUID format)
      const userId = searchEmail.trim();

      const { error: err } = await supabase
        .from('authorized_users')
        .insert({
          user_id: userId,
          authorized_by: currentUserId,
          is_admin: false,
          can_add_reviews: true,
          can_delete_reviews: false,
          can_edit_reviews: false
        });

      if (err) {
        error = `Failed to add user: ${err.message}`;
        return;
      }

      success = `Successfully authorized user ${userId.slice(0, 8)}...`;
      searchEmail = '';
      await loadAuthorizedUsers();

      setTimeout(() => { success = ''; }, 3000);
    } catch (err) {
      error = `Failed to add user: ${err}`;
    }
  }

  async function addUser(userId: string, email: string) {
    try {
      const { error: err } = await supabase
        .from('authorized_users')
        .insert({
          user_id: userId,
          authorized_by: currentUserId,
          is_admin: false,
          can_add_reviews: true,
          can_delete_reviews: false,
          can_edit_reviews: false
        });

      if (err) {
        error = `Failed to add user: ${err.message}`;
        return;
      }

      success = `Successfully authorized ${email}`;
      searchEmail = '';
      searchResults = [];
      await loadAuthorizedUsers();

      setTimeout(() => { success = ''; }, 3000);
    } catch (err) {
      error = `Failed to add user: ${err}`;
    }
  }

  async function removeUser(userId: string, displayName: string | null, email: string | null) {
    const userLabel = displayName || email || `user ${userId.slice(0, 8)}...`;
    if (!confirm(`Remove ${userLabel} from authorized users?`)) return;

    try {
      const { error: err } = await supabase
        .from('authorized_users')
        .delete()
        .eq('user_id', userId);

      if (err) {
        error = `Failed to remove user: ${err.message}`;
        return;
      }

      success = `Successfully removed ${userLabel}`;
      await loadAuthorizedUsers();

      setTimeout(() => { success = ''; }, 3000);
    } catch (err) {
      error = `Failed to remove user: ${err}`;
    }
  }

  function openEditModal(user: AuthorizedUser) {
    selectedUser = user;
    editForm = {
      is_admin: user.is_admin,
      can_add_reviews: user.can_add_reviews,
      can_delete_reviews: user.can_delete_reviews,
      can_edit_reviews: user.can_edit_reviews,
      notes: user.notes || ''
    };
    showEditModal = true;
  }

  async function savePermissions() {
    if (!selectedUser) return;

    try {
      const { error: err } = await supabase
        .from('authorized_users')
        .update(editForm)
        .eq('user_id', selectedUser.user_id);

      if (err) {
        error = `Failed to update permissions: ${err.message}`;
        return;
      }

      success = `Successfully updated permissions for ${selectedUser.display_name || selectedUser.email || 'user ' + selectedUser.user_id.slice(0, 8) + '...'}`;
      showEditModal = false;
      selectedUser = null;
      await loadAuthorizedUsers();

      setTimeout(() => { success = ''; }, 3000);
    } catch (err) {
      error = `Failed to update permissions: ${err}`;
    }
  }

  function getPermissionSummary(user: AuthorizedUser): string {
    const permissions: string[] = [];
    if (user.is_admin) permissions.push('Admin');
    if (user.can_add_reviews) permissions.push('Add Reviews');
    if (user.can_delete_reviews) permissions.push('Delete Reviews');
    if (user.can_edit_reviews) permissions.push('Edit Reviews');
    return permissions.join(', ') || 'No permissions';
  }

  function getPermissionBadgeClass(user: AuthorizedUser): string {
    if (user.is_admin) return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
    if (user.can_delete_reviews) return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300';
    if (user.can_edit_reviews) return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
    return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
  }
</script>

<div class="modal">
  <div class="modal-backdrop" on:click={onClose}></div>
  <div class="modal-content max-w-4xl">
    <!-- Header -->
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">Permissions Manager</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage user permissions for adding, editing, and deleting reviews</p>
      </div>
      <button
        class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        on:click={onClose}
      >
        <Icon icon={faTimes} class="w-6 h-6" />
      </button>
    </div>

    <!-- Status Messages -->
    {#if error}
      <div class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
        <p class="text-sm text-red-700 dark:text-red-300">{error}</p>
      </div>
    {/if}

    {#if success}
      <div class="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
        <p class="text-sm text-green-700 dark:text-green-300">{success}</p>
      </div>
    {/if}

    <!-- Add New User Section -->
    <div class="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-3">Add New Authorized User</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
        Search for users by email address to authorize them. You can also enter a UUID directly.
      </p>
      <div class="flex space-x-3">
        <div class="flex-1">
          <input
            type="text"
            placeholder="Enter email address or UUID to search..."
            class="form-input w-full"
            bind:value={searchEmail}
            on:input={searchUsers}
          />
        </div>
        <button
          class="btn-primary px-4"
          on:click={searchUsers}
          disabled={isSearching || !searchEmail.trim()}
        >
          <Icon icon={faSearch} class="w-4 h-4" />
        </button>
        <button
          class="btn-secondary px-4"
          on:click={addUserById}
          disabled={isSearching || !searchEmail.trim()}
          title="Add directly by UUID"
        >
          <Icon icon={faUserPlus} class="w-4 h-4" />
        </button>
      </div>

      <!-- Search Results -->
      {#if searchResults.length > 0}
        <div class="mt-3 space-y-2">
          <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Search Results:</p>
          {#each searchResults as user}
            <div class="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded border">
              <div class="flex items-center space-x-3">
                <div class="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                  <Icon icon={faUser} class="w-4 h-4 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-900 dark:text-white">{user.email}</p>
                  {#if user.display_name}
                    <p class="text-xs text-gray-500 dark:text-gray-400">{user.display_name}</p>
                  {:else}
                    <p class="text-xs text-gray-500 dark:text-gray-400">User ID: {user.user_id.slice(0, 8)}...</p>
                  {/if}
                </div>
              </div>
              <button
                class="btn-primary btn-sm"
                on:click={() => addUser(user.user_id, user.email)}
              >
                <Icon icon={faUserPlus} class="w-4 h-4 mr-1" />
                Add User
              </button>
            </div>
          {/each}
        </div>
      {:else if isSearching}
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">Searching...</p>
      {:else if searchEmail.trim()}
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">No users found</p>
      {/if}
    </div>

    <!-- Authorized Users List -->
    <div>
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">Authorized Users ({authorizedUsers.length})</h3>
      </div>

      {#if authorizedUsers.length === 0}
        <div class="text-center py-8">
          <Icon icon={faUser} class="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <p class="text-gray-500 dark:text-gray-400">No authorized users yet</p>
        </div>
      {:else}
        <div class="space-y-3 max-h-96 overflow-y-auto">
          {#each authorizedUsers as user}
            <div class="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <div class="flex items-center space-x-4">
                <div class="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                  {#if user.is_admin}
                    <Icon icon={faShield} class="w-5 h-5 text-red-600 dark:text-red-400" />
                  {:else}
                    <Icon icon={faUser} class="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  {/if}
                </div>
                <div class="flex-1">
                  <div class="flex items-center space-x-2">
                    <p class="font-medium text-gray-900 dark:text-white">
                      {user.display_name || 'No display name'}
                    </p>
                    <span class="px-2 py-1 text-xs font-medium rounded-full {getPermissionBadgeClass(user)}">
                      {user.is_admin ? 'Admin' : 'User'}
                    </span>
                  </div>
                  <p class="text-sm text-gray-500 dark:text-gray-400">{user.email || `ID: ${user.user_id.slice(0, 8)}...`}</p>
                  <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">{getPermissionSummary(user)}</p>
                  {#if user.notes}
                    <p class="text-xs text-gray-400 dark:text-gray-500 italic mt-1">"{user.notes}"</p>
                  {/if}
                </div>
              </div>
              <div class="flex items-center space-x-2">
                <button
                  class="btn-secondary btn-sm"
                  on:click={() => openEditModal(user)}
                  title="Edit permissions"
                >
                  <Icon icon={faEdit} class="w-4 h-4" />
                </button>
                {#if user.user_id !== currentUserId}
                  <button
                    class="btn-danger btn-sm"
                    on:click={() => removeUser(user.user_id, user.display_name, user.email)}
                    title="Remove user"
                  >
                    <Icon icon={faTrash} class="w-4 h-4" />
                  </button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <div class="flex justify-end mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
      <button class="btn-secondary" on:click={onClose}>Close</button>
    </div>
  </div>
</div>

<!-- Edit Permissions Modal -->
{#if showEditModal && selectedUser}
  <div class="modal z-50">
    <div class="modal-backdrop" on:click={() => { showEditModal = false; selectedUser = null; }}></div>
    <div class="modal-content max-w-md">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-semibold">Edit Permissions</h3>
        <button
          class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          on:click={() => { showEditModal = false; selectedUser = null; }}
        >
          <Icon icon={faTimes} />
        </button>
      </div>

      <div class="mb-4">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {selectedUser.display_name || 'User'} • {selectedUser.email || selectedUser.user_id.slice(0, 8) + '...'}
        </p>
      </div>

      <div class="space-y-4 mb-6">
        <label class="flex items-center space-x-3">
          <input
            type="checkbox"
            class="form-checkbox"
            bind:checked={editForm.is_admin}
          />
          <div>
            <span class="text-sm font-medium text-gray-900 dark:text-white">Administrator</span>
            <p class="text-xs text-gray-500 dark:text-gray-400">Full access to all features including user management</p>
          </div>
        </label>

        <label class="flex items-center space-x-3">
          <input
            type="checkbox"
            class="form-checkbox"
            bind:checked={editForm.can_add_reviews}
          />
          <div>
            <span class="text-sm font-medium text-gray-900 dark:text-white">Add Reviews</span>
            <p class="text-xs text-gray-500 dark:text-gray-400">Can create new reviews</p>
          </div>
        </label>

        <label class="flex items-center space-x-3">
          <input
            type="checkbox"
            class="form-checkbox"
            bind:checked={editForm.can_edit_reviews}
          />
          <div>
            <span class="text-sm font-medium text-gray-900 dark:text-white">Edit Reviews</span>
            <p class="text-xs text-gray-500 dark:text-gray-400">Can modify existing reviews</p>
          </div>
        </label>

        <label class="flex items-center space-x-3">
          <input
            type="checkbox"
            class="form-checkbox"
            bind:checked={editForm.can_delete_reviews}
          />
          <div>
            <span class="text-sm font-medium text-gray-900 dark:text-white">Delete Reviews</span>
            <p class="text-xs text-gray-500 dark:text-gray-400">Can remove reviews (destructive action)</p>
          </div>
        </label>

        <div>
          <label class="block text-sm font-medium text-gray-900 dark:text-white mb-2">Notes</label>
          <textarea
            class="form-input w-full h-16"
            placeholder="Optional notes about this user's permissions..."
            bind:value={editForm.notes}
          ></textarea>
        </div>
      </div>

      <div class="flex justify-end space-x-3">
        <button
          class="btn-secondary"
          on:click={() => { showEditModal = false; selectedUser = null; }}
        >
          Cancel
        </button>
        <button class="btn-primary" on:click={savePermissions}>
          Save Changes
        </button>
      </div>
    </div>
  </div>
{/if}