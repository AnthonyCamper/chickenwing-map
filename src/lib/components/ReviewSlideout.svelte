<script lang="ts">
  import { fly } from 'svelte/transition';
  import { faTimes, faStar, faMapMarkerAlt, faCalendar, faRuler, faThumbsUp, faThumbsDown, faUser } from '@fortawesome/free-solid-svg-icons';
  import Icon from 'svelte-fa';
  import { supabase } from '$lib/supabase';
  import { onMount } from 'svelte';
  import SignInModal from './SignInModal.svelte';

  interface WingRating {
    id: number;
    restaurant_name: string;
    address: string;
    rating: number;
    review: string;
    date_visited: string;
    latitude: number;
    longitude: number;
    distance?: number;
    upvotes_count: number;
    downvotes_count: number;
    user_display_name: string;
  }

  export let rating: WingRating | null = null;
  export let onClose: () => void;
  export let onVoteChange: () => void;

  let userVote: 'up' | 'down' | null = null;
  let prevRatingId: number | null = null;
  let showSignInModal = false;
  let localUpvotes = 0;
  let localDownvotes = 0;
  let isProcessingVote = false;

  function getGoogleMapsLink(address: string) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }

  async function handleVote(type: 'up' | 'down') {
    if (!rating || isProcessingVote) return;
    console.log('Starting vote process for type:', type);

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log('Current user:', user?.id);
    
    if (userError || !user) {
      console.log('No user found, showing sign in modal');
      showSignInModal = true;
      return;
    }

    try {
      isProcessingVote = true;
      console.log('Processing vote...');

      // Check if user has already voted
      const { data: existingVote, error: checkError } = await supabase
        .from('votes')
        .select('vote_type')
        .eq('rating_id', rating.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing vote:', checkError);
      }
      console.log('Existing vote:', existingVote);

      if (existingVote?.vote_type === type) {
        console.log('Removing existing vote');
        // Remove vote
        const { error: deleteError } = await supabase
          .from('votes')
          .delete()
          .eq('rating_id', rating.id)
          .eq('user_id', user.id);

        if (deleteError) {
          console.error('Error deleting vote:', deleteError);
          throw deleteError;
        }

        userVote = null;

      } else if (existingVote) {
        console.log('Updating existing vote');
        // Update vote
        const { error: updateError } = await supabase
          .from('votes')
          .update({ vote_type: type })
          .eq('rating_id', rating.id)
          .eq('user_id', user.id);

        if (updateError) {
          console.error('Error updating vote:', updateError);
          throw updateError;
        }

        userVote = type;

      } else {
        console.log('Creating new vote');
        // Create new vote
        console.log(user.id, rating.id, type)
        const { error: insertError } = await supabase
          .from('votes')
          .insert({
            rating_id: rating.id,
            user_id: user.id,
            vote_type: type
          });

        if (insertError) {
          console.error('Error inserting vote:', insertError);
          throw insertError;
        }

        userVote = type;
      }

      // Fetch updated rating to get new vote counts
      const { data: updatedRating, error: fetchError } = await supabase
        .from('wing_ratings')
        .select('upvotes_count, downvotes_count')
        .eq('id', rating.id)
        .single();

      if (fetchError) {
        console.error('Error fetching updated counts:', fetchError);
        throw fetchError;
      }

      if (updatedRating) {
        localUpvotes = updatedRating.upvotes_count;
        localDownvotes = updatedRating.downvotes_count;
        rating.upvotes_count = updatedRating.upvotes_count;
        rating.downvotes_count = updatedRating.downvotes_count;
      }

      console.log('Vote process completed successfully');
      console.log('New counts - Up:', localUpvotes, 'Down:', localDownvotes);
      onVoteChange();

    } catch (err) {
      console.error('Error in vote process:', err);
      // Revert local state on error
      if (rating) {
        localUpvotes = rating.upvotes_count;
        localDownvotes = rating.downvotes_count;
      }
    } finally {
      isProcessingVote = false;
    }
  }

  async function loadUserVote() {
    if (!rating) return;
    console.log('Loading user vote for rating:', rating.id);

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // Check if user has already voted
      const { data, error } = await supabase
        .from('votes')
        .select('vote_type')
        .eq('rating_id', rating.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading user vote:', error);
      }

      userVote = data?.vote_type as 'up' | 'down' | null;
      console.log('Loaded user vote:', userVote);
    } else {
      userVote = null;
    }
  }

  // Reset state when rating changes
  $: if (rating && rating.id !== prevRatingId) {
    console.log('Rating changed, resetting state');
    prevRatingId = rating.id;
    userVote = null;
    localUpvotes = rating.upvotes_count;
    localDownvotes = rating.downvotes_count;
    loadUserVote();
  }

  onMount(() => {
    if (rating) {
      console.log('Component mounted, initializing with rating:', rating.id);
      localUpvotes = rating.upvotes_count;
      localDownvotes = rating.downvotes_count;
      loadUserVote();
    }
  });
</script>

{#if rating}
  <div
    transition:fly={{ x: '100%', duration: 300 }}
    class="fixed inset-y-0 right-0 w-full sm:w-96 bg-white dark:bg-gray-900 shadow-lg z-[2000] flex flex-col"
  >
    <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-xl font-bold text-gray-800 dark:text-gray-100">{rating.restaurant_name}</h2>
      <button 
        on:click={onClose} 
        class="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600"
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
        >
          <Icon icon={faThumbsUp} class="text-2xl mb-1" />
          <span class="font-medium">{localUpvotes}</span>
        </button>
        
        <button
          on:click={() => handleVote('down')}
          disabled={isProcessingVote}
          class="flex flex-col items-center p-3 rounded-lg transition-colors {userVote === 'down' ? 'text-red-500 bg-red-100 dark:bg-red-900' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'} {isProcessingVote ? 'opacity-50 cursor-not-allowed' : ''}"
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
            <span class="text-gray-700 dark:text-gray-200">{rating.user_display_name || 'Anonymous'}</span>
          </div>

          <div class="flex items-center mb-2">
            <Icon icon={faStar} class="text-yellow-400 mr-2" />
            <span class="text-2xl font-bold text-gray-700 dark:text-gray-200">{rating.rating}/10</span>
          </div>
          
          <a 
            href={getGoogleMapsLink(rating.address)} 
            target="_blank" 
            rel="noopener noreferrer" 
            class="flex items-center mb-2 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
          >
            <Icon icon={faMapMarkerAlt} class="mr-2" />
            <span class="underline">{rating.address}</span>
          </a>
          
          <div class="flex items-center mb-2 text-gray-600 dark:text-gray-300">
            <Icon icon={faCalendar} class="mr-2" />
            <span>Visited: {new Date(rating.date_visited).toLocaleDateString()}</span>
          </div>
          
          {#if rating.distance !== undefined}
            <div class="flex items-center text-gray-600 dark:text-gray-300">
              <Icon icon={faRuler} class="mr-2" />
              <span>Distance: {rating.distance.toFixed(2)} km</span>
            </div>
          {/if}
        </div>
        
        <div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <h3 class="text-lg font-semibold mb-2 text-gray-700 dark:text-gray-200">Review</h3>
          <p class="text-gray-600 dark:text-gray-300 leading-relaxed">{rating.review}</p>
        </div>
      </div>
    </div>
  </div>

  <SignInModal 
    show={showSignInModal} 
    onClose={() => showSignInModal = false} 
  />
{/if}
