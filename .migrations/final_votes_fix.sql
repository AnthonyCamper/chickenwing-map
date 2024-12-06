-- Drop existing triggers first
DROP TRIGGER IF EXISTS votes_trigger ON votes;
DROP FUNCTION IF EXISTS update_rating_vote_counts();

-- Recreate votes table with correct structure
DROP TABLE IF EXISTS votes CASCADE;

CREATE TABLE votes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    rating_id bigint REFERENCES wing_ratings(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    vote_type text CHECK (vote_type IN ('up', 'down')),
    created_at timestamptz DEFAULT timezone('utc'::text, now()),
    UNIQUE (rating_id, user_id)
);

-- Enable RLS
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Users can insert their own votes" ON votes;
DROP POLICY IF EXISTS "Users can update their own votes" ON votes;
DROP POLICY IF EXISTS "Users can delete their own votes" ON votes;
DROP POLICY IF EXISTS "Everyone can read votes" ON votes;

CREATE POLICY "Users can insert their own votes" ON votes 
    FOR INSERT TO authenticated 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own votes" ON votes 
    FOR UPDATE TO authenticated 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own votes" ON votes 
    FOR DELETE TO authenticated 
    USING (auth.uid() = user_id);

CREATE POLICY "Everyone can read votes" ON votes 
    FOR SELECT TO authenticated, anon 
    USING (true);

-- Create trigger function for vote counting
CREATE OR REPLACE FUNCTION update_rating_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE wing_ratings
        SET
            upvotes_count = COALESCE((
                SELECT COUNT(*) 
                FROM votes 
                WHERE rating_id = NEW.rating_id 
                AND vote_type = 'up'
            ), 0),
            downvotes_count = COALESCE((
                SELECT COUNT(*) 
                FROM votes 
                WHERE rating_id = NEW.rating_id 
                AND vote_type = 'down'
            ), 0)
        WHERE id = NEW.rating_id;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE wing_ratings
        SET
            upvotes_count = COALESCE((
                SELECT COUNT(*) 
                FROM votes 
                WHERE rating_id = OLD.rating_id 
                AND vote_type = 'up'
            ), 0),
            downvotes_count = COALESCE((
                SELECT COUNT(*) 
                FROM votes 
                WHERE rating_id = OLD.rating_id 
                AND vote_type = 'down'
            ), 0)
        WHERE id = OLD.rating_id;
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        UPDATE wing_ratings
        SET
            upvotes_count = COALESCE((
                SELECT COUNT(*) 
                FROM votes 
                WHERE rating_id = NEW.rating_id 
                AND vote_type = 'up'
            ), 0),
            downvotes_count = COALESCE((
                SELECT COUNT(*) 
                FROM votes 
                WHERE rating_id = NEW.rating_id 
                AND vote_type = 'down'
            ), 0)
        WHERE id = NEW.rating_id;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER votes_trigger
    AFTER INSERT OR UPDATE OR DELETE ON votes
    FOR EACH ROW
    EXECUTE FUNCTION update_rating_vote_counts();
