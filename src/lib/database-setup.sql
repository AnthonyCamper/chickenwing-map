-- Enable Row Level Security
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE wing_ratings ENABLE ROW LEVEL SECURITY;

-- Create votes table if it doesn't exist
CREATE TABLE IF NOT EXISTS votes (
    id BIGSERIAL PRIMARY KEY,
    rating_id BIGINT REFERENCES wing_ratings(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    vote_type TEXT CHECK (vote_type IN ('up', 'down')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(rating_id, user_id)
);

-- Create policies for votes table
CREATE POLICY "Enable read access for all users" ON votes
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON votes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable update for vote owner" ON votes
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Enable delete for vote owner" ON votes
    FOR DELETE USING (auth.uid() = user_id);

-- Create policies for wing_ratings table
CREATE POLICY "Enable read access for all users" ON wing_ratings
    FOR SELECT USING (true);

CREATE POLICY "Enable update for vote counts" ON wing_ratings
    FOR UPDATE USING (true)
    WITH CHECK (
        -- Only allow updating upvotes_count and downvotes_count
        (COALESCE(NEW.upvotes_count, OLD.upvotes_count) = NEW.upvotes_count) AND
        (COALESCE(NEW.downvotes_count, OLD.downvotes_count) = NEW.downvotes_count) AND
        -- All other fields must remain unchanged
        OLD.id = NEW.id AND
        OLD.restaurant_name = NEW.restaurant_name AND
        OLD.address = NEW.address AND
        OLD.rating = NEW.rating AND
        OLD.review = NEW.review AND
        OLD.date_visited = NEW.date_visited AND
        OLD.latitude = NEW.latitude AND
        OLD.longitude = NEW.longitude AND
        OLD.user_display_name = NEW.user_display_name
    );

-- Add vote count columns to wing_ratings if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'wing_ratings' AND column_name = 'upvotes_count') THEN
        ALTER TABLE wing_ratings ADD COLUMN upvotes_count INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'wing_ratings' AND column_name = 'downvotes_count') THEN
        ALTER TABLE wing_ratings ADD COLUMN downvotes_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- Create function to update vote counts
CREATE OR REPLACE FUNCTION update_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Increment the appropriate counter
        IF NEW.vote_type = 'up' THEN
            UPDATE wing_ratings 
            SET upvotes_count = upvotes_count + 1
            WHERE id = NEW.rating_id;
        ELSE
            UPDATE wing_ratings 
            SET downvotes_count = downvotes_count + 1
            WHERE id = NEW.rating_id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement the appropriate counter
        IF OLD.vote_type = 'up' THEN
            UPDATE wing_ratings 
            SET upvotes_count = GREATEST(0, upvotes_count - 1)
            WHERE id = OLD.rating_id;
        ELSE
            UPDATE wing_ratings 
            SET downvotes_count = GREATEST(0, downvotes_count - 1)
            WHERE id = OLD.rating_id;
        END IF;
    ELSIF TG_OP = 'UPDATE' AND OLD.vote_type != NEW.vote_type THEN
        -- Switch vote type
        IF NEW.vote_type = 'up' THEN
            UPDATE wing_ratings 
            SET upvotes_count = upvotes_count + 1,
                downvotes_count = GREATEST(0, downvotes_count - 1)
            WHERE id = NEW.rating_id;
        ELSE
            UPDATE wing_ratings 
            SET downvotes_count = downvotes_count + 1,
                upvotes_count = GREATEST(0, upvotes_count - 1)
            WHERE id = NEW.rating_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for vote counts
DROP TRIGGER IF EXISTS update_vote_counts_trigger ON votes;
CREATE TRIGGER update_vote_counts_trigger
    AFTER INSERT OR UPDATE OR DELETE ON votes
    FOR EACH ROW
    EXECUTE FUNCTION update_vote_counts();
