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
  export let closeSlideout: () => void;
  export let user: any = null;
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
    
    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    
    // If scrolling more vertically than horizontally, don't slide
    if (Math.abs(touchY - touchStartY) > Math.abs(touchX - touchStartX)) {
      return;
    }
    
    // Only slide when dragging right (to close)
    if (touchX > touchStartX) {
      currentX = touchX - touchStartX;
      if (slideoutElement) {
        slideoutElement.style.transform = `translateX(${currentX}px)`;
      }
    }
  }

  // Handle touch end
  function handleTouchEnd() {
    if (!isDragging) return;
    
    isDragging = false;
    
    if (slideoutElement) {
      slideoutElement.style.transition = 'transform 0.3s ease-out';
      
      // If dragged far enough, close the slideout
      if (currentX > slideoutElement.offsetWidth * 0.3) {
        closeSlideout();
      } else {
        slideoutElement.style.transform = 'translateX(0)';
      }
    }
  }

  $: {
    if (review) {
      if (review.id !== prevReviewId) {
        prevReviewId = review.id;
        localUpvotes = review.upvotes_count ?? 0;
        localDownvotes = review.downvotes_count ?? 0;
        getUserVoteStatus();
        fetchLocationReviews();
      }
    }
  }

  async function fetchLocationReviews() {
    if (!review) return;
    
    isLoadingReviews = true;
    
    // Get other reviews for the same location
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        *,
        location:locations(*),
        votes (
          vote_type,
          user_id
        )
      `)
      .eq('location_id', review.location_id)
      .neq('id', review.id)
      .order('date_visited', { ascending: false });
      
    if (error) {
      console.error('Error fetching location reviews:', error);
    } else {
      // Process reviews to include vote counts
      locationReviews = (data || []).map((review: any) => ({
        ...review,
        upvotes_count: review.votes?.filter((v: any) => v.vote_type === 'up')?.length || 0,
        downvotes_count: review.votes?.filter((v: any) => v.vote_type === 'down')?.length || 0
      }));
    }
    
    isLoadingReviews = false;
  }

  async function getUserVoteStatus() {
    if (!review || !user) {
      userVote = null;
      return;
    }
    
    const { data, error } = await supabase
      .from('review_votes')
      .select('vote_type')
      .eq('review_id', review.id)
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (error) {
      console.error('Error getting vote status:', error);
      userVote = null;
    } else {
      userVote = data?.vote_type || null;
    }
  }

  async function handleVote(type: 'up' | 'down') {
    if (!review || !user) {
      showSignInModal = true;
      return;
    }
    
    if (isProcessingVote) return;
    
    isProcessingVote = true;
    
    // If user already voted the same way, remove the vote
    if (userVote === type) {
      await removeVote();
    } else {
      // If user voted the opposite way, update the vote
      if (userVote) {
        await updateVote(type);
      } else {
        // If user hasn't voted, add a new vote
        await addVote(type);
      }
    }
    
    isProcessingVote = false;
  }

  async function addVote(type: 'up' | 'down') {
    if (!review || !user) return;
    
    const { error } = await supabase
      .from('review_votes')
      .insert({
        review_id: review.id,
        user_id: user.id,
        vote_type: type
      });
    
    if (error) {
      console.error('Error adding vote:', error);
    } else {
      userVote = type;
      updateLocalVoteCounts();
    }
  }

  async function updateVote(type: 'up' | 'down') {
    if (!review || !user) return;
    
    const { error } = await supabase
      .from('review_votes')
      .update({ vote_type: type })
      .eq('review_id', review.id)
      .eq('user_id', user.id);
    
    if (error) {
      console.error('Error updating vote:', error);
    } else {
      userVote = type;
      updateLocalVoteCounts();
    }
  }

  async function removeVote() {
    if (!review || !user) return;
    
    const { error } = await supabase
      .from('review_votes')
      .delete()
      .eq('review_id', review.id)
      .eq('user_id', user.id);
    
    if (error) {
      console.error('Error removing vote:', error);
    } else {
      const oldVote = userVote;
      userVote = null;
      
      // Update local counts
      if (oldVote === 'up') {
        localUpvotes = Math.max(0, localUpvotes - 1);
      } else if (oldVote === 'down') {
        localDownvotes = Math.max(0, localDownvotes - 1);
      }
      
      updateLocalReview();
    }
  }

  function updateLocalVoteCounts() {
    // Calculate the new vote counts based on previous vote
    if (userVote === 'up') {
      if (review?.votes?.find(v => v.user_id === user?.id && v.vote_type === 'down')) {
        // Changed from down to up
        localUpvotes += 1;
        localDownvotes = Math.max(0, localDownvotes - 1);
      } else if (!review?.votes?.find(v => v.user_id === user?.id)) {
        // New upvote
        localUpvotes += 1;
      }
    } else if (userVote === 'down') {
      if (review?.votes?.find(v => v.user_id === user?.id && v.vote_type === 'up')) {
        // Changed from up to down
        localDownvotes += 1;
        localUpvotes = Math.max(0, localUpvotes - 1);
      } else if (!review?.votes?.find(v => v.user_id === user?.id)) {
        // New downvote
        localDownvotes += 1;
      }
    }
    
    updateLocalReview();
  }

  function updateLocalReview() {
    if (!review) return;
    
    // Update the local review with new vote counts
    const updatedReview = {
      ...review,
      upvotes_count: localUpvotes,
      downvotes_count: localDownvotes,
      votes: [
        ...(review.votes?.filter(v => v.user_id !== user?.id) || []),
        ...(userVote ? [{ user_id: user.id, vote_type: userVote }] : [])
      ]
    };
    
    // Update the parent component
    review = updatedReview;
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      closeSlideout();
    }
  }

  onMount(() => {
    if (browser) {
      window.addEventListener('keydown', handleKeyDown);
    }
  });

  onDestroy(() => {
    if (browser) {
      window.removeEventListener('keydown', handleKeyDown);
    }
  });
</script>

<style>
  /* Force the slideout to appear above leaflet map */
  :global(.leaflet-pane),
  :global(.leaflet-map-pane),
  :global(.leaflet-marker-pane),
  :global(.leaflet-popup-pane),
  :global(.leaflet-overlay-pane) {
    z-index: 40 !important;
  }
  
  :global(.leaflet-control) {
    z-index: 45 !important;
  }
  
  /* Ensure our slideout has a higher z-index than map controls */
  .slideout-container {
    z-index: 1000 !important;
  }
  
  .slideout-backdrop {
    z-index: 990 !important;
  }
  
  .slideout-content {
    z-index: 1000 !important;
  }
</style>

<svelte:window on:keydown={handleKeyDown} />

{#if review}
  <div 
    class="fixed inset-y-0 right-0 flex slideout-container w-full sm:w-[450px] max-w-full"
    transition:fly={{ x: 500, duration: 300 }}
    bind:this={slideoutElement}
    on:touchstart={handleTouchStart}
    on:touchmove={handleTouchMove}
    on:touchend={handleTouchEnd}
  >
    <!-- Backdrop on mobile (visible only on small screens) -->
    <div 
      class="fixed inset-0 bg-black bg-opacity-50 sm:hidden slideout-backdrop"
      on:click={closeSlideout}
      on:keydown={(e) => e.key === 'Enter' && closeSlideout()}
      role="button"
      tabindex="0"
      aria-label="Close review details"
    ></div>
    
    <!-- Slideout content -->
    <div class="flex flex-col w-full bg-white dark:bg-gray-800 shadow-xl overflow-hidden slideout-content">
      <div class="flex flex-col h-full overflow-hidden">
        <!-- Header with close button -->
        <div class="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
            {review.location.restaurant_name}
          </h2>
          <button 
            on:click={closeSlideout}
            class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close review details"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        
        <!-- Main content with scrollable area -->
        <div class="flex-1 overflow-y-auto p-4">
          {#if review}
            <div class="space-y-6">
              <!-- Voting section -->
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-4">
                  <div class="text-3xl font-bold text-primary-600 dark:text-primary-400">
                    {review.rating}/10
                  </div>
                  <div class="text-sm text-gray-500 dark:text-gray-400">
                    Reviewed on {new Date(review.date_visited).toLocaleDateString()}
                  </div>
                </div>
                
                <div class="flex items-center space-x-2">
                  <button 
                    class="p-1.5 rounded-full {userVote === 'up' ? 'bg-success-50 text-success-600 dark:bg-success-900 dark:text-success-300' : 'text-gray-500 hover:text-success-600 dark:text-gray-400 dark:hover:text-success-300'}"
                    on:click={() => handleVote('up')}
                    aria-label="Upvote review"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
                    </svg>
                    <span class="sr-only">Upvote</span>
                  </button>
                  <span class="text-sm font-medium">{localUpvotes}</span>
                  
                  <button 
                    class="p-1.5 rounded-full {userVote === 'down' ? 'bg-error-50 text-error-600 dark:bg-error-900 dark:text-error-300' : 'text-gray-500 hover:text-error-600 dark:text-gray-400 dark:hover:text-error-300'}"
                    on:click={() => handleVote('down')}
                    aria-label="Downvote review"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                    <span class="sr-only">Downvote</span>
                  </button>
                  <span class="text-sm font-medium">{localDownvotes}</span>
                </div>
              </div>
              
              <!-- Location info -->
              <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div class="text-gray-700 dark:text-gray-200">
                  <div class="font-medium">{review.location.address}</div>
                </div>
              </div>
              
              <!-- Review body -->
              <div>
                <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">Review</h3>
                <div class="bg-white dark:bg-gray-800 rounded-lg text-gray-700 dark:text-gray-300">
                  <p class="whitespace-pre-line">{review.review}</p>
                </div>
              </div>
              
              <!-- Experience details -->
              {#if review.experience_details}
                <div>
                  <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">Experience Details</h3>
                  <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg space-y-3">
                    {#if review.experience_details.wingFormat}
                      <div class="flex justify-between">
                        <span class="text-gray-600 dark:text-gray-400">Wing Format:</span>
                        <span class="font-medium">{review.experience_details.wingFormat}</span>
                      </div>
                    {/if}
                    
                    {#if review.experience_details.wingSize !== null}
                      <div class="flex justify-between">
                        <span class="text-gray-600 dark:text-gray-400">Wing Size:</span>
                        <span class="font-medium">{review.experience_details.wingSize}/10</span>
                      </div>
                    {/if}
                    
                    {#if review.experience_details.wingsPerOrder !== null}
                      <div class="flex justify-between">
                        <span class="text-gray-600 dark:text-gray-400">Wings Per Order:</span>
                        <span class="font-medium">{review.experience_details.wingsPerOrder}</span>
                      </div>
                    {/if}
                    
                    {#if review.experience_details.isTakeout !== null}
                      <div class="flex justify-between">
                        <span class="text-gray-600 dark:text-gray-400">Takeout:</span>
                        <span class="font-medium">{review.experience_details.isTakeout ? 'Yes' : 'No'}</span>
                      </div>
                    {/if}
                  </div>
                </div>
              {/if}
              
              <!-- Ratings -->
              {#if review.ratings}
                <div>
                  <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">Ratings</h3>
                  <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg space-y-3">
                    {#each Object.entries(review.ratings).filter(([key, value]) => value !== null && key !== 'blueCheeseNA') as [key, value]}
                      <div class="flex justify-between">
                        <span class="text-gray-600 dark:text-gray-400">
                          {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
                        </span>
                        <span class="font-medium">{value}/10</span>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

{#if showSignInModal}
  <SignInModal on:close={() => showSignInModal = false} />
{/if}
