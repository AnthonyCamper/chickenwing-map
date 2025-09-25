<script lang="ts">
  import { faTimes, faTrash } from '@fortawesome/free-solid-svg-icons';
  import Icon from 'svelte-fa';
  import { supabase } from '$lib/supabase';

  export let reviewId: number;
  export let restaurantName: string;
  export let onClose: () => void;
  export let onDeleted: () => void;

  let passphrase = '';
  let error = '';
  let isDeleting = false;
  let step: 'confirm' | 'passphrase' = 'confirm';

  const requiredPassphrase = 'DELETE REVIEW';

  function proceedToPassphrase() {
    step = 'passphrase';
    error = '';
  }

  async function confirmDelete() {
    if (passphrase !== requiredPassphrase) {
      error = `Please type "${requiredPassphrase}" exactly to confirm deletion`;
      return;
    }

    try {
      isDeleting = true;
      error = '';

      const { error: deleteError } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId);

      if (deleteError) {
        throw deleteError;
      }

      onDeleted();
      onClose();
    } catch (err) {
      console.error('Delete review error:', err);
      error = err instanceof Error ? err.message : 'Failed to delete review';
    } finally {
      isDeleting = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      if (step === 'confirm') {
        proceedToPassphrase();
      } else if (step === 'passphrase') {
        confirmDelete();
      }
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="modal">
  <div class="modal-backdrop" on:click={onClose}></div>
  <div class="modal-content max-w-md">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold text-red-600 dark:text-red-400 flex items-center">
        <Icon icon={faTrash} class="mr-2" />
        Delete Review
      </h2>
      <button
        class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        on:click={onClose}
        disabled={isDeleting}
      >
        <Icon icon={faTimes} />
      </button>
    </div>

    {#if step === 'confirm'}
      <div class="mb-6">
        <p class="text-gray-700 dark:text-gray-300 mb-4">
          Are you sure you want to permanently delete this review for <strong>{restaurantName}</strong>?
        </p>
        <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p class="text-yellow-800 dark:text-yellow-200 text-sm">
            ⚠️ <strong>Warning:</strong> This action cannot be undone. The review and all associated data will be permanently removed.
          </p>
        </div>
      </div>

      <div class="flex justify-end space-x-3">
        <button class="btn-secondary" on:click={onClose}>Cancel</button>
        <button
          class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          on:click={proceedToPassphrase}
        >
          Continue to Delete
        </button>
      </div>
    {:else}
      <div class="mb-6">
        <p class="text-gray-700 dark:text-gray-300 mb-4">
          To confirm deletion, please type the following phrase exactly:
        </p>
        <div class="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 mb-4">
          <code class="text-red-600 dark:text-red-400 font-mono font-bold text-lg">
            {requiredPassphrase}
          </code>
        </div>

        <input
          type="text"
          class="form-input w-full font-mono"
          bind:value={passphrase}
          placeholder="Type the phrase above"
          disabled={isDeleting}
          autofocus
        />

        {#if error}
          <p class="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        {/if}
      </div>

      <div class="flex justify-end space-x-3">
        <button
          class="btn-secondary"
          on:click={onClose}
          disabled={isDeleting}
        >
          Cancel
        </button>
        <button
          class="bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
          on:click={confirmDelete}
          disabled={isDeleting || passphrase !== requiredPassphrase}
        >
          {#if isDeleting}
            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Deleting...
          {:else}
            <Icon icon={faTrash} class="mr-2" />
            Delete Review
          {/if}
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .modal-backdrop {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
  }

  .modal-content {
    position: relative;
    background: white;
    border-radius: 0.5rem;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    padding: 1.5rem;
    width: 100%;
  }

  :global(.dark) .modal-content {
    background: rgb(31 41 55);
  }
</style>