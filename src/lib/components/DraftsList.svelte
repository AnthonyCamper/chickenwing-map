<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { faFileAlt, faTrash, faEdit, faClock, faPlus } from '@fortawesome/free-solid-svg-icons';
	import Icon from 'svelte-fa';

	export let onEditDraft: (draftId: string) => void;
	export let onNewReview: () => void;
	export let user: any = null;

	interface Draft {
		id: string;
		title: string;
		current_step: number;
		restaurant_name: string | null;
		address: string | null;
		updated_at: string;
		created_at: string;
	}

	let drafts: Draft[] = [];
	let loading = true;
	let error = '';

	onMount(() => {
		loadDrafts();
	});

	async function loadDrafts() {
		if (!user) {
			loading = false;
			return;
		}

		try {
			const { data, error: fetchError } = await supabase
				.from('draft_reviews')
				.select('id, title, current_step, restaurant_name, address, updated_at, created_at')
				.eq('user_id', user.id)
				.order('updated_at', { ascending: false });

			if (fetchError) {
				error = fetchError.message;
			} else {
				drafts = data || [];
			}
		} catch (err) {
			error = 'Failed to load drafts';
			console.error('Error loading drafts:', err);
		} finally {
			loading = false;
		}
	}

	async function deleteDraft(draftId: string, event: Event) {
		event.stopPropagation(); // Prevent triggering edit

		if (!confirm('Are you sure you want to delete this draft?')) {
			return;
		}

		try {
			const { error: deleteError } = await supabase
				.from('draft_reviews')
				.delete()
				.eq('id', draftId);

			if (deleteError) {
				error = deleteError.message;
			} else {
				drafts = drafts.filter(draft => draft.id !== draftId);
			}
		} catch (err) {
			error = 'Failed to delete draft';
			console.error('Error deleting draft:', err);
		}
	}

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / (1000 * 60));
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffMins < 1) {
			return 'Just now';
		} else if (diffMins < 60) {
			return `${diffMins} min ago`;
		} else if (diffHours < 24) {
			return `${diffHours}h ago`;
		} else if (diffDays < 7) {
			return `${diffDays}d ago`;
		} else {
			return date.toLocaleDateString();
		}
	}

	function getStepName(step: number): string {
		const steps = ['Basic Info', 'Experience', 'Sauces', 'Ratings', 'Review'];
		return steps[step - 1] || 'Unknown';
	}

	function getDraftDisplayName(draft: Draft): string {
		if (draft.title && draft.title.trim() && !draft.title.startsWith('Draft from')) {
			return draft.title;
		}
		if (draft.restaurant_name) {
			return `Draft: ${draft.restaurant_name}`;
		}
		return `Draft from ${new Date(draft.created_at).toLocaleDateString()}`;
	}
</script>

<div class="drafts-container">
	<div class="drafts-header">
		<div class="flex items-center justify-between">
			<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Review Drafts</h3>
			<button
				class="btn-primary-sm"
				on:click={onNewReview}
			>
				<Icon icon={faPlus} class="w-3 h-3 mr-1" />
				New
			</button>
		</div>
	</div>

	{#if loading}
		<div class="drafts-loading">
			<div class="spinner"></div>
			<span class="text-sm text-gray-500 dark:text-gray-400">Loading drafts...</span>
		</div>
	{:else if error}
		<div class="drafts-error">
			<p class="text-sm text-red-600 dark:text-red-400">{error}</p>
			<button class="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1" on:click={loadDrafts}>
				Try again
			</button>
		</div>
	{:else if drafts.length === 0}
		<div class="drafts-empty">
			<Icon icon={faFileAlt} class="w-8 h-8 text-gray-400 dark:text-gray-500 mb-2" />
			<p class="text-sm text-gray-500 dark:text-gray-400 mb-3">No drafts yet</p>
			<button
				class="btn-secondary-sm"
				on:click={onNewReview}
			>
				<Icon icon={faPlus} class="w-3 h-3 mr-1" />
				Create your first review
			</button>
		</div>
	{:else}
		<div class="drafts-list">
			{#each drafts as draft (draft.id)}
				<div class="draft-item" on:click={() => onEditDraft(draft.id)} role="button" tabindex="0">
					<div class="draft-content">
						<div class="draft-header">
							<h4 class="draft-title">
								{getDraftDisplayName(draft)}
							</h4>
							<button
								class="draft-delete-btn"
								on:click={(e) => deleteDraft(draft.id, e)}
								aria-label="Delete draft"
							>
								<Icon icon={faTrash} class="w-3 h-3" />
							</button>
						</div>

						<div class="draft-meta">
							<div class="draft-step">
								<Icon icon={faEdit} class="w-3 h-3 mr-1" />
								Step {draft.current_step}/5: {getStepName(draft.current_step)}
							</div>

							{#if draft.address}
								<div class="draft-location">
									{draft.address.length > 30 ? draft.address.substring(0, 30) + '...' : draft.address}
								</div>
							{/if}
						</div>

						<div class="draft-footer">
							<div class="draft-time">
								<Icon icon={faClock} class="w-3 h-3 mr-1" />
								{formatDate(draft.updated_at)}
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.drafts-container {
		min-width: 280px;
		max-width: 320px;
		max-height: 400px;
		display: flex;
		flex-direction: column;
	}

	.drafts-header {
		padding: 1rem 1rem 0.5rem 1rem;
		border-bottom: 1px solid #e5e7eb;
		flex-shrink: 0;
	}

	:global(.dark) .drafts-header {
		border-color: #4b5563;
	}

	.drafts-loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		gap: 0.75rem;
	}

	.spinner {
		width: 1.5rem;
		height: 1.5rem;
		border: 2px solid #e5e7eb;
		border-top: 2px solid #3b82f6;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	:global(.dark) .spinner {
		border-color: #4b5563;
		border-top-color: #3b82f6;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	.drafts-error {
		padding: 1rem;
		text-align: center;
	}

	.drafts-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		text-align: center;
	}

	.drafts-list {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem;
	}

	.draft-item {
		cursor: pointer;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		margin-bottom: 0.5rem;
		transition: all 0.2s ease;
		background-color: white;
	}

	.draft-item:hover {
		border-color: #3b82f6;
		box-shadow: 0 2px 4px rgba(59, 130, 246, 0.1);
		transform: translateY(-1px);
	}

	:global(.dark) .draft-item {
		background-color: #374151;
		border-color: #4b5563;
	}

	:global(.dark) .draft-item:hover {
		border-color: #3b82f6;
		box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
	}

	.draft-content {
		padding: 0.75rem;
	}

	.draft-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 0.5rem;
	}

	.draft-title {
		font-weight: 600;
		color: #1f2937;
		font-size: 0.875rem;
		line-height: 1.25;
		flex: 1;
		margin-right: 0.5rem;
	}

	:global(.dark) .draft-title {
		color: #f3f4f6;
	}

	.draft-delete-btn {
		color: #6b7280;
		hover: #ef4444;
		padding: 0.25rem;
		border-radius: 0.25rem;
		transition: all 0.2s ease;
		flex-shrink: 0;
	}

	.draft-delete-btn:hover {
		color: #ef4444;
		background-color: #fef2f2;
	}

	:global(.dark) .draft-delete-btn {
		color: #9ca3af;
	}

	:global(.dark) .draft-delete-btn:hover {
		color: #ef4444;
		background-color: #451a1a;
	}

	.draft-meta {
		margin-bottom: 0.5rem;
	}

	.draft-step {
		display: flex;
		align-items: center;
		font-size: 0.75rem;
		color: #3b82f6;
		font-weight: 500;
		margin-bottom: 0.25rem;
	}

	.draft-location {
		font-size: 0.75rem;
		color: #6b7280;
		line-height: 1.25;
	}

	:global(.dark) .draft-location {
		color: #9ca3af;
	}

	.draft-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.draft-time {
		display: flex;
		align-items: center;
		font-size: 0.75rem;
		color: #6b7280;
	}

	:global(.dark) .draft-time {
		color: #9ca3af;
	}

	.btn-primary-sm {
		background-color: #3b82f6;
		color: white;
		border: none;
		border-radius: 0.375rem;
		padding: 0.375rem 0.75rem;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		display: flex;
		align-items: center;
		transition: all 0.2s ease;
	}

	.btn-primary-sm:hover {
		background-color: #2563eb;
		transform: translateY(-1px);
	}

	.btn-secondary-sm {
		background-color: transparent;
		color: #6b7280;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		padding: 0.375rem 0.75rem;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		display: flex;
		align-items: center;
		transition: all 0.2s ease;
	}

	.btn-secondary-sm:hover {
		color: #374151;
		border-color: #9ca3af;
		background-color: #f9fafb;
	}

	:global(.dark) .btn-secondary-sm {
		color: #9ca3af;
		border-color: #4b5563;
	}

	:global(.dark) .btn-secondary-sm:hover {
		color: #d1d5db;
		border-color: #6b7280;
		background-color: #4b5563;
	}

	/* Scrollbar styling */
	.drafts-list::-webkit-scrollbar {
		width: 4px;
	}

	.drafts-list::-webkit-scrollbar-track {
		background: #f1f5f9;
		border-radius: 2px;
	}

	.drafts-list::-webkit-scrollbar-thumb {
		background: #cbd5e1;
		border-radius: 2px;
	}

	.drafts-list::-webkit-scrollbar-thumb:hover {
		background: #94a3b8;
	}

	:global(.dark) .drafts-list::-webkit-scrollbar-track {
		background: #1e293b;
	}

	:global(.dark) .drafts-list::-webkit-scrollbar-thumb {
		background: #475569;
	}

	:global(.dark) .drafts-list::-webkit-scrollbar-thumb:hover {
		background: #64748b;
	}

	/* Mobile responsiveness */
	@media (max-width: 640px) {
		.drafts-container {
			min-width: 250px;
			max-width: 280px;
		}

		.draft-content {
			padding: 0.5rem;
		}

		.draft-title {
			font-size: 0.8125rem;
		}
	}
</style>