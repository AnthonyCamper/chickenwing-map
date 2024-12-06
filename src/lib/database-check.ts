import { supabase } from './supabase';

async function checkDatabaseStructure() {
    console.log('=== Checking Database Structure ===');

    // Check tables
    const { data: tables, error: tablesError } = await supabase
        .from('pg_tables')
        .select('tablename, schemaname')
        .eq('schemaname', 'public');

    if (tablesError) {
        console.error('Error fetching tables:', tablesError);
    } else {
        console.log('Tables:', tables);
    }

    // Check functions
    const { data: functions, error: functionsError } = await supabase
        .rpc('list_functions');

    if (functionsError) {
        console.error('Error fetching functions:', functionsError);
    } else {
        console.log('Functions:', functions);
    }

    // Check votes table structure
    const { data: votesStructure, error: votesError } = await supabase
        .from('votes')
        .select()
        .limit(1);

    if (votesError) {
        console.error('Error checking votes table:', votesError);
    } else {
        console.log('Votes table exists');
    }

    // Check wing_ratings table structure
    const { data: ratingsStructure, error: ratingsError } = await supabase
        .from('wing_ratings')
        .select()
        .limit(1);

    if (ratingsError) {
        console.error('Error checking wing_ratings table:', ratingsError);
    } else {
        console.log('Wing ratings table exists');
    }
}

// Run the check
checkDatabaseStructure().catch(console.error);
