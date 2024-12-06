import { supabase } from './supabase';

// Simple function to test database access
async function testDatabase() {
    try {
        // 1. Check if votes table exists and its structure
        const { data: votesData, error: votesError } = await supabase
            .from('votes')
            .select('*')
            .limit(1);

        console.log('Votes table check:', votesError ? 'Error: ' + votesError.message : 'OK');

        // 2. Check if wing_ratings table exists and its structure
        const { data: ratingsData, error: ratingsError } = await supabase
            .from('wing_ratings')
            .select('id, upvotes_count, downvotes_count')
            .limit(1);

        console.log('Wing ratings table check:', ratingsError ? 'Error: ' + ratingsError.message : 'OK');
        
        if (ratingsData && ratingsData[0]) {
            console.log('Sample rating:', ratingsData[0]);
        }

    } catch (error) {
        console.error('Test failed:', error);
    }
}

// Run the test
console.log('Starting database test...');
testDatabase().then(() => console.log('Test complete'));
