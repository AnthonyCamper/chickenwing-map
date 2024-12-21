<script lang="ts">
  import { fly } from 'svelte/transition';
  import { onMount, onDestroy, tick } from 'svelte';
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
  let isLoadingReviews = true;
  let touchStartX = 0;
  let touchStartY = 0;
  let slideoutElement: HTMLElement;
  let isDragging = false;
  let currentX = 0;

  // Handle touch start
  function handleTouchStart(e: TouchEvent) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    isDragging = true;
    currentX = 0;
    if (slideoutElement) {
      slideoutElement.style.transition = 'none';
    }
  }

  // Handle touch move
  function handleTouchMove(e: TouchEvent) {
    if (!isDragging) return;
    
    const touchCurrentX = e.touches[0].clientX;
    const touchCurrentY = e.touches[0].clientY;
    
    // Calculate horizontal and vertical distance
    const deltaX = touchCurrentX - touchStartX;
    const deltaY = Math.abs(touchCurrentY - touchStartY);

    // If moving more vertically than horizontally, cancel the swipe
    if (deltaY > Math.abs(deltaX)) {
      isDragging = false;
      if (slideoutElement) {
        slideoutElement.style.transform = '';
        slideoutElement.style.transition = '';
      }
      return;
    }

    // Only allow right swipe
    if (deltaX > 0) {
      currentX = deltaX;
      if (slideoutElement) {
        slideoutElement.style.transform = `translateX(${currentX}px)`;
      }
    }

    // Prevent default to stop scrolling
    e.preventDefault();
  }

  // Handle touch end
  async function handleTouchEnd() {
    if (!isDragging) return;
    isDragging = false;

    if (slideoutElement) {
      slideoutElement.style.transition = 'transform 0.3s ease-out';
      
      // If swiped more than 100px or 30% of the width, close the slideout
      const threshold = Math.min(window.innerWidth * 0.3, 100);
      if (currentX > threshold) {
        onClose();
      } else {
        slideoutElement.style.transform = '';
        await tick();
        slideoutElement.style.transition = '';
      }
    }
  }

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
    
    isLoadingReviews = true;
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
    } finally {
      isLoadingReviews = false;
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
    bind:this={slideoutElement}
    transition:fly={{ x: '100%', duration: 300 }}
    class="fixed inset-y-0 right-0 w-full sm:w-[600px] bg-white dark:bg-gray-900 
           shadow-lg z-[9999] flex flex-col overflow-hidden touch-pan-y"
    on:touchstart={handleTouchStart}
    on:touchmove={handleTouchMove}
    on:touchend={handleTouchEnd}
    on:touchcancel={handleTouchEnd}
  >
    <!-- Header -->
    <ReviewHeader 
      restaurantName={review.location.restaurant_name}
      {onClose}
    />

    <div class="flex flex-1 overflow-hidden">
      <!-- Reviews List Sidebar - Always show when multiple reviews exist -->
      {#if locationReviews.length > 1 || isLoadingReviews}
        <div class="w-full sm:w-auto border-r border-gray-200 dark:border-gray-700 
                   {showFullReview ? 'hidden sm:block' : 'block'}">
          {#if isLoadingReviews}
            <!-- Mobile loading skeleton for reviews list -->
            <div class="p-4 space-y-4">
              {#each Array(3) as _}
                <div class="bg-white dark:bg-gray-800 rounded-lg p-4 animate-pulse">
                  <div class="space-y-3">
                    <div class="flex items-center justify-between">
                      <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                      <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                    </div>
                    <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                    <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <ReviewSidebar
              reviews={locationReviews}
              selectedReview={review}
              onReviewSelect={handleReviewSelect}
            />
          {/if}
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
        {#if isLoadingReviews}
          <div class="p-4 space-y-4">
            <!-- Loading skeleton for basic info -->
            <div class="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 sm:p-6 animate-pulse">
              <div class="space-y-4">
                <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
              </div>
            </div>
            
            <!-- Loading skeleton for experience details -->
            <div class="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow animate-pulse">
              <div class="space-y-4">
                <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              </div>
            </div>
            
            <!-- Loading skeleton for review text -->
            <div class="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow animate-pulse">
              <div class="space-y-4">
                <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
                <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/5"></div>
              </div>
            </div>
          </div>
        {:else}
          <ReviewDetails {review} />
        {/if}
      </div>
    </div>
  </div>

  <!-- Sign In Modal -->
  <SignInModal 
    show={showSignInModal} 
    onClose={() => showSignInModal = false} 
  />
{/if}
