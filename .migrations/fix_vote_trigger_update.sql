-- Drop existing trigger and function
drop trigger if exists votes_trigger on votes;
drop function if exists update_rating_vote_counts();

-- Create the updated trigger function
create or replace function update_rating_vote_counts()
returns trigger as $$
declare
    rating_id_val bigint;
begin
    if (TG_OP = 'INSERT') then
        rating_id_val := NEW.rating_id;
        update wing_ratings
        set
            upvotes_count = case when NEW.vote_type = 'up' then upvotes_count + 1 else upvotes_count end,
            downvotes_count = case when NEW.vote_type = 'down' then downvotes_count + 1 else downvotes_count end
        where id = rating_id_val;
        return NEW;
    elsif (TG_OP = 'DELETE') then
        rating_id_val := OLD.rating_id;
        update wing_ratings
        set
            upvotes_count = case when OLD.vote_type = 'up' then upvotes_count - 1 else upvotes_count end,
            downvotes_count = case when OLD.vote_type = 'down' then downvotes_count - 1 else downvotes_count end
        where id = rating_id_val;
        return OLD;
    elsif (TG_OP = 'UPDATE') then
        rating_id_val := NEW.rating_id;
        -- If vote type changed, update both old and new counts
        if OLD.vote_type != NEW.vote_type then
            update wing_ratings
            set
                upvotes_count = case 
                    when OLD.vote_type = 'up' then upvotes_count - 1
                    when NEW.vote_type = 'up' then upvotes_count + 1
                    else upvotes_count
                end,
                downvotes_count = case
                    when OLD.vote_type = 'down' then downvotes_count - 1
                    when NEW.vote_type = 'down' then downvotes_count + 1
                    else downvotes_count
                end
            where id = rating_id_val;
        end if;
        return NEW;
    end if;
    return null;
end;
$$ language plpgsql;

-- Recreate the trigger
create trigger votes_trigger
    after insert or update or delete on votes
    for each row
    execute function update_rating_vote_counts();
