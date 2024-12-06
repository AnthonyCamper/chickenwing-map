<script lang="ts">
  import { fly } from 'svelte/transition';
  import { faTimes, faStar, faMapMarkerAlt, faCalendar, faRuler, faThumbsUp, faThumbsDown, faUser } from '@fortawesome/free-solid-svg-icons';
  import Icon from 'svelte-fa';
  import { supabase } from '$lib/supabase';
  import { onMount, onDestroy } from 'svelte';
  import SignInModal from './SignInModal.svelte';
  import { browser } from '$app/environment';
  import type { PostgrestError } from '@supabase/supabase-js';

  interface Location {
    id: number;
    restaurant_name: string;
    address: string;
    latitude: number;
    longitude: number;
  }

  interface Review {
    id: number;
    location_id: number;
    user_id: string;
    review: string;
    rating: string;
    date_visited: string;
    location?: Location;
    distance?: number;
    upvotes_count: number;
    downvotes_count: number;
  }

  interface Vote {
    vote_type: 'up' | 'down';
  }

  export let review: Review | null = null;
  export let onClose: () => void;
  export let onVoteChange: () => void;

  let userVote: 'up' | 'down' | null = null;
  let prevReviewId: number | null = null;
  let showSignInModal = false;
  let localUpvotes = 0;
  let localDownvotes = 0;
  let isProcessingVote = false;

  function getGoogleMapsLink(address: string) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }

  // Update local vote counts based on vote type change
  function updateLocalCounts(oldVote: 'up' | 'down' | null, newVote: 'up' | 'down' | null) {
    if (!review) return;

    // Reset to original counts
    localUpvotes = review.upvotes_count;
    localDownvotes = review.downvotes_count;

    // Remove old vote if it exists
    if (oldVote === 'up') localUpvotes--;
    if (oldVote === 'down') localDownvotes--;

    // Add new vote if it exists
    if (newVote === 'up') localUpvotes++;
    if (newVote === 'down') localDownvotes++;
  }

  // Handle visibility change
  async function handleVisibilityChange() {
    if (!browser || document.hidden) return;
    
    // Refresh auth state and user vote when tab becomes visible
    await refreshAuthState();
    if (review) {
      await loadUserVote();
    }
  }

  // Refresh auth state
  async function refreshAuthState(): Promise<boolean> {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Error refreshing auth state:', error);
      return false;
    }
    return !!session;
  }

  async function handleVote(type: 'up' | 'down') {
    if (!review || isProcessingVote) return;
    console.log('Starting vote process for type:', type);

    const previousVote = userVote;
    
    try {
      isProcessingVote = true;

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.log('No user found, showing sign in modal');
        showSignInModal = true;
        return;
      }

      // Optimistically update UI
      if (userVote === type) {
        // Removing vote
        updateLocalCounts(type, null);
        userVote = null;
      } else {
        // Adding or changing vote
        updateLocalCounts(userVote, type);
        userVote = type;
      }

      // Check if user has already voted
      const { data: existingVote, error: checkError } = await supabase
        .from('votes')
        .select('vote_type')
        .eq('review_id', review.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (checkError) throw checkError;

      let error: PostgrestError | null = null;

      // Handle vote operation
      if (existingVote?.vote_type === type) {
        // Remove vote and decrement count
        const { error: rpcError } = await supabase.rpc('remove_vote', {
          p_review_id: review.id,
          p_user_id: user.id,
          p_vote_type: type
        });
        error = rpcError;
      } else if (existingVote) {
        // Update vote and update counts
        const { error: rpcError } = await supabase.rpc('update_vote', {
          p_review_id: review.id,
          p_user_id: user.id,
          p_old_vote_type: existingVote.vote_type,
          p_new_vote_type: type
        });
        error = rpcError;
      } else {
        // Create new vote and increment count
        const { error: rpcError } = await supabase.rpc('add_vote', {
          p_review_id: review.id,
          p_user_id: user.id,
          p_vote_type: type
        });
        error = rpcError;
      }

      if (error) throw error;

      // Fetch updated review to sync with server
      const { data: updatedReview, error: fetchError } = await supabase
        .from('reviews')
        .select('upvotes_count, downvotes_count')
        .eq('id', review.id)
        .single();

      if (fetchError) throw fetchError;

      if (updatedReview) {
        review.upvotes_count = updatedReview.upvotes_count;
        review.downvotes_count = updatedReview.downvotes_count;
        localUpvotes = updatedReview.upvotes_count;
        localDownvotes = updatedReview.downvotes_count;
      }

      onVoteChange();

    } catch (err) {
      console.error('Error in vote process:', err);
      // Revert local state on error
      if (review) {
        userVote = previousVote;
        localUpvotes = review.upvotes_count;
        localDownvotes = review.downvotes_count;
      }
    } finally {
      isProcessingVote = false;
    }
  }

  async function loadUserVote() {
    if (!review) return;
    console.log('Loading user vote for review:', review.id);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Check if user has already voted
        const { data, error } = await supabase
          .from('votes')
          .select('vote_type')
          .eq('review_id', review.id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error loading user vote:', error);
          return;
        }

        userVote = data?.vote_type as 'up' | 'down' | null;
        console.log('Loaded user vote:', userVote);
      } else {
        userVote = null;
      }
    } catch (err) {
      console.error('Error in loadUserVote:', err);
      userVote = null;
    }
  }

  // Reset state when review changes
  $: if (review && review.id !== prevReviewId) {
    console.log('Review changed, resetting state');
    prevReviewId = review.id;
    userVote = null;
    localUpvotes = review.upvotes_count;
    localDownvotes = review.downvotes_count;
    loadUserVote();
  }

  onMount(() => {
    if (review) {
      console.log('Component mounted, initializing with review:', review.id);
      localUpvotes = review.upvotes_count;
      localDownvotes = review.downvotes_count;
      loadUserVote();
    }

    if (browser) {
      // Add visibility change listener
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
  });

  onDestroy(() => {
    if (browser) {
      // Remove visibility change listener
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  });
</script>

{#if review && review.location}
  <div
    transition:fly={{ x: '100%', duration: 300 }}
    class="fixed inset-y-0 right-0 w-full sm:w-96 bg-white dark:bg-gray-900 shadow-lg z-[2000] flex flex-col"
  >
    <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-xl font-bold text-gray-800 dark:text-gray-100">{review.location.restaurant_name}</h2>
      <button 
        on:click={onClose} 
        class="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600"
        aria-label="Close review"
      >
        <Icon icon={faTimes} class="text-xl" />
      </button>
    </div>

    <!-- Voting Section -->
    <div class="p-4 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center justify-center space-x-12">
        <button
          on:click={() => handleVote('up')}
          disabled={isProcessingVote}
          class="flex flex-col items-center p-3 rounded-lg transition-colors {userVote === 'up' ? 'text-green-500 bg-green-100 dark:bg-green-900' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'} {isProcessingVote ? 'opacity-50 cursor-not-allowed' : ''}"
          aria-label="Upvote review"
        >
          <Icon icon={faThumbsUp} class="text-2xl mb-1" />
          <span class="font-medium">{localUpvotes}</span>
        </button>
        
        <button
          on:click={() => handleVote('down')}
          disabled={isProcessingVote}
          class="flex flex-col items-center p-3 rounded-lg transition-colors {userVote === 'down' ? 'text-red-500 bg-red-100 dark:bg-red-900' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'} {isProcessingVote ? 'opacity-50 cursor-not-allowed' : ''}"
          aria-label="Downvote review"
        >
          <Icon icon={faThumbsDown} class="text-2xl mb-1" />
          <span class="font-medium">{localDownvotes}</span>
        </button>
      </div>
    </div>
    
    <div class="flex-1 overflow-y-auto">
      <div class="p-4 space-y-4">
        <div class="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
          <!-- Reviewer Info -->
          <div class="flex items-center mb-4">
            <Icon icon={faUser} class="text-gray-400 mr-2" />
            <span class="text-gray-700 dark:text-gray-200">Anonymous</span>
          </div>

          <div class="flex items-center mb-2">
            <Icon icon={faStar} class="text-yellow-400 mr-2" />
            <span class="text-2xl font-bold text-gray-700 dark:text-gray-200">{review.rating}/10</span>
          </div>
          
          <a 
            href={getGoogleMapsLink(review.location.address)} 
            target="_blank" 
            rel="noopener noreferrer" 
            class="flex items-center mb-2 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            aria-label="View on Google Maps"
          >
            <Icon icon={faMapMarkerAlt} class="mr-2" />
            <span class="underline">{review.location.address}</span>
          </a>
          
          <div class="flex items-center mb-2 text-gray-600 dark:text-gray-300">
            <Icon icon={faCalendar} class="mr-2" />
            <span>Visited: {new Date(review.date_visited).toLocaleDateString()}</span>
          </div>
          
          {#if review.distance !== undefined}
            <div class="flex items-center text-gray-600 dark:text-gray-300">
              <Icon icon={faRuler} class="mr-2" />
              <span>Distance: {review.distance.toFixed(2)} km</span>
            </div>
          {/if}
        </div>
        
        <div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <h3 class="text-lg font-semibold mb-2 text-gray-700 dark:text-gray-200">Review</h3>
          <p class="text-gray-600 dark:text-gray-300 leading-relaxed">{review.review}</p>
        </div>
      </div>
    </div>
  </div>

  <SignInModal 
    show={showSignInModal} 
    onClose={() => showSignInModal = false} 
  />
{/if}
