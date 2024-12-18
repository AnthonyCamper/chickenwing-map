<script lang="ts">
  import { fly } from 'svelte/transition';
  import { onMount, onDestroy } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { browser } from '$app/environment';
  import SignInModal from './SignInModal.svelte';
  import type { Review } from './review/types';

  // Import modular components
  import ReviewHeader from './review/ReviewHeader.svelte';
  import ReviewSidebar from './review/ReviewSidebar.svelte';
  import ReviewVoting from './review/ReviewVoting.svelte';
  import ReviewDetails from './review/ReviewDetails.svelte';

  // Props
  export let review: Review | null = null;
  export let onClose: () => void;
  export let handleVoteChange: (review: Review) => void;
  export let fromListView = false;

  // Local state
  let userVote: 'up' | 'down' | null = null;
  let prevReviewId: number | null = null;
  let showSignInModal = false;
  let localUpvotes = 0;
  let localDownvotes = 0;
  let isProcessingVote = false;
  let locationReviews: Review[] = [];
  let showFullReview = false;

  // Handle visibility change for auth state
  async function handleVisibilityChange() {
    if (!browser || document.hidden) return;
    await refreshAuthState();
    if (review) {
      await loadUserVote();
    }
  }

  // Refresh authentication state
  async function refreshAuthState(): Promise<boolean> {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Error refreshing auth state:', error);
      return false;
    }
    return !!session;
  }

  // Handle voting action
  async function handleVoteAction(type: 'up' | 'down') {
    if (!review || isProcessingVote) return;
    
    const previousVote = userVote; // Declare at the start of the function
    
    try {
      isProcessingVote = true;

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        showSignInModal = true;
        return;
      }

      // Optimistically update UI
      if (userVote === type) {
        userVote = null;
        if (type === 'up') localUpvotes--;
        else localDownvotes--;
      } else {
        if (userVote === 'up') localUpvotes--;
        if (userVote === 'down') localDownvotes--;
        userVote = type;
        if (type === 'up') localUpvotes++;
        else localDownvotes++;
      }

      const { data: existingVote, error: checkError } = await supabase
        .from('votes')
        .select('vote_type')
        .eq('review_id', review.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (checkError) throw checkError;

      let error = null;
      if (existingVote?.vote_type === type) {
        const { error: rpcError } = await supabase.rpc('remove_vote', {
          p_review_id: review.id,
          p_user_id: user.id,
          p_vote_type: type
        });
        error = rpcError;
      } else if (existingVote) {
        const { error: rpcError } = await supabase.rpc('update_vote', {
          p_review_id: review.id,
          p_user_id: user.id,
          p_vote_type: type
        });
        error = rpcError;
      } else {
        const { error: rpcError } = await supabase.rpc('add_vote', {
          p_review_id: review.id,
          p_user_id: user.id,
          p_vote_type: type
        });
        error = rpcError;
      }

      if (error) throw error;

      await refreshReviewData();

    } catch (err) {
      console.error('Error in vote process:', err);
      // Revert optimistic updates on error
      userVote = previousVote;
      if (review) {
        localUpvotes = review.upvotes_count;
        localDownvotes = review.downvotes_count;
      }
    } finally {
      setTimeout(() => {
        isProcessingVote = false;
      }, 500);
    }
  }

  // Refresh review data after vote
  async function refreshReviewData() {
    if (!review) return;

    const { data: updatedReview, error: fetchError } = await supabase
      .from('reviews')
      .select(`
        *,
        votes (
          vote_type,
          user_id
        )
      `)
      .eq('id', review.id)
      .single();

    if (fetchError) throw fetchError;

    if (updatedReview) {
      const upvotes = (updatedReview.votes as any[] || []).filter(vote => vote.vote_type === 'up').length;
      const downvotes = (updatedReview.votes as any[] || []).filter(vote => vote.vote_type === 'down').length;
      
      const updatedReviewWithCounts = {
        ...updatedReview,
        upvotes_count: upvotes,
        downvotes_count: downvotes
      };
      
      review = updatedReviewWithCounts;
      localUpvotes = upvotes;
      localDownvotes = downvotes;
      handleVoteChange(updatedReviewWithCounts);
    }
  }

  // Load user's vote for current review
  async function loadUserVote() {
    if (!review) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data, error } = await supabase
          .from('votes')
          .select('vote_type')
          .eq('review_id', review.id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;
        userVote = data?.vote_type as 'up' | 'down' | null;
      } else {
        userVote = null;
      }
    } catch (err) {
      console.error('Error loading user vote:', err);
      userVote = null;
    }
  }

  // Load all reviews for the current location
  async function loadLocationReviews() {
    if (!review?.location_id) return;
    
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          locations (*),
          votes (
            vote_type,
            user_id
          )
        `)
        .eq('location_id', review.location_id)
        .order('date_visited', { ascending: false });

      if (error) throw error;

      if (data) {
        locationReviews = data.map(review => ({
          ...review,
          location: review.locations,
          upvotes_count: (review.votes as any[] || []).filter(vote => vote.vote_type === 'up').length,
          downvotes_count: (review.votes as any[] || []).filter(vote => vote.vote_type === 'down').length
        }));
      }
    } catch (err) {
      console.error('Error loading location reviews:', err);
      locationReviews = [];
    }
  }

  // Handle review selection from sidebar
  function handleReviewSelect(selectedReview: Review) {
    review = selectedReview;
    loadUserVote();
    showFullReview = true; // Show the full review when selected on mobile
  }

  // Reset state when review changes
  $: if (review && review.id !== prevReviewId) {
    prevReviewId = review.id;
    userVote = null;
    localUpvotes = review.upvotes_count;
    localDownvotes = review.downvotes_count;
    loadUserVote();
    loadLocationReviews();
  }

  onMount(() => {
    if (review) {
      localUpvotes = review.upvotes_count;
      localDownvotes = review.downvotes_count;
      loadUserVote();
      loadLocationReviews();
    }

    if (browser) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
  });

  onDestroy(() => {
    if (browser) {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  });
</script>

{#if review && review.location}
  <!-- Semi-transparent overlay -->
  <div 
    class="fixed inset-0 bg-black bg-opacity-50 z-[9998]"
    on:click={onClose}
  ></div>

  <!-- Main slideout container with improved mobile responsiveness -->
  <div
    transition:fly={{ x: '100%', duration: 300 }}
    class="fixed inset-y-0 right-0 w-full sm:w-[600px] bg-white dark:bg-gray-900 
           shadow-lg z-[9999] flex flex-col overflow-hidden"
  >
    <!-- Header -->
    <ReviewHeader 
      restaurantName={review.location.restaurant_name}
      {onClose}
    />

    <div class="flex flex-1 overflow-hidden">
      <!-- Reviews List Sidebar - Always show when multiple reviews exist -->
      {#if locationReviews.length > 1}
        <div class="w-full sm:w-auto border-r border-gray-200 dark:border-gray-700 
                   {showFullReview ? 'hidden sm:block' : 'block'}">
          <ReviewSidebar
            reviews={locationReviews}
            selectedReview={review}
            onReviewSelect={handleReviewSelect}
          />
        </div>
      {/if}

      <!-- Main Content Area -->
      <div class="flex-1 flex flex-col overflow-hidden 
                  {showFullReview || locationReviews.length === 1 ? 'block' : 'hidden sm:block'}">
        <!-- Back to Reviews Button (mobile only) -->
        {#if locationReviews.length > 1 && showFullReview}
          <button
            class="sm:hidden px-4 py-2 text-blue-600 dark:text-blue-400 text-left border-b 
                   border-gray-200 dark:border-gray-700"
            on:click={() => showFullReview = false}
          >
            ← Back to Reviews
          </button>
        {/if}

        <!-- Voting Section -->
        <ReviewVoting
          upvotes={localUpvotes}
          downvotes={localDownvotes}
          {userVote}
          isProcessing={isProcessingVote}
          on:vote={e => handleVoteAction(e.detail)}
        />
        
        <!-- Review Details -->
        <ReviewDetails {review} />
      </div>
    </div>
  </div>

  <!-- Sign In Modal -->
  <SignInModal 
    show={showSignInModal} 
    onClose={() => showSignInModal = false} 
  />
{/if}
