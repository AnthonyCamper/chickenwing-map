import { supabase } from './supabase';

async function checkDatabaseStructure() {
    console.log('=== Checking Database Structure ===\n');

    // Check votes table structure
    console.log('Checking votes table...');
    const { data: votesInfo, error: votesError } = await supabase
        .from('votes')
        .select('*')
        .limit(1);

    if (votesError) {
        console.error('Error accessing votes table:', votesError);
    } else {
        console.log('✓ Votes table is accessible');
        
        // Try to insert a test vote
        const testVote = {
            rating_id: -1, // Using -1 as a test ID
            user_id: 'test',
            vote_type: 'up'
        };
        
        const { error: insertError } = await supabase
            .from('votes')
            .insert([testVote]);

        if (insertError) {
            console.error('Error testing vote insert:', insertError);
        } else {
            console.log('✓ Vote insert permission test passed');
            
            // Clean up test vote
            await supabase
                .from('votes')
                .delete()
                .eq('rating_id', -1);
        }
    }

    // Check wing_ratings table structure
    console.log('\nChecking wing_ratings table...');
    const { data: ratingsInfo, error: ratingsError } = await supabase
        .from('wing_ratings')
        .select('id, upvotes_count, downvotes_count')
        .limit(1);

    if (ratingsError) {
        console.error('Error accessing wing_ratings table:', ratingsError);
    } else {
        console.log('✓ Wing ratings table is accessible');
        console.log('Sample rating structure:', ratingsInfo[0]);

        // Try to update vote counts
        if (ratingsInfo[0]) {
            const currentCounts = {
                upvotes_count: ratingsInfo[0].upvotes_count,
                downvotes_count: ratingsInfo[0].downvotes_count
            };

            const { error: updateError } = await supabase
                .from('wing_ratings')
                .update(currentCounts)
                .eq('id', ratingsInfo[0].id);

            if (updateError) {
                console.error('Error testing ratings update:', updateError);
            } else {
                console.log('✓ Ratings update permission test passed');
            }
        }
    }

    // Check RLS policies
    console.log('\nChecking RLS policies...');
    const { data: policies, error: policiesError } = await supabase
        .rpc('get_policies');

    if (policiesError) {
        console.error('Error checking policies:', policiesError);
    } else {
        console.log('Table policies:', policies);
    }
}

// Run the check
console.log('Starting database structure check...\n');
checkDatabaseStructure()
    .catch(console.error)
    .finally(() => console.log('\nDatabase check complete'));
