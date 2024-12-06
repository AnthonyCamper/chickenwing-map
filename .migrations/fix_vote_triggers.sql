-- Drop all existing triggers
drop trigger if exists votes_trigger on votes;
drop trigger if exists votes_insert_trigger on votes;
drop trigger if exists votes_update_trigger on votes;
drop trigger if exists votes_delete_trigger on votes;

-- Drop all existing trigger functions
drop function if exists votes_insert_trigger_func();
drop function if exists votes_update_trigger_func();
drop function if exists votes_delete_trigger_func();
drop function if exists update_rating_vote_counts(bigint);
drop function if exists update_rating_vote_counts();

-- Recreate the single trigger function
create or replace function update_rating_vote_counts()
returns trigger as $$
begin
  if (TG_OP = 'INSERT') then
    update wing_ratings
    set
      upvotes_count = case when NEW.vote_type = 'up' then upvotes_count + 1 else upvotes_count end,
      downvotes_count = case when NEW.vote_type = 'down' then downvotes_count + 1 else downvotes_count end
    where id = NEW.rating_id;
    return NEW;
  elsif (TG_OP = 'DELETE') then
    update wing_ratings
    set
      upvotes_count = case when OLD.vote_type = 'up' then upvotes_count - 1 else upvotes_count end,
      downvotes_count = case when OLD.vote_type = 'down' then downvotes_count - 1 else downvotes_count end
    where id = OLD.rating_id;
    return OLD;
  elsif (TG_OP = 'UPDATE') then
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
      where id = NEW.rating_id;
    end if;
    return NEW;
  end if;
  return null;
end;
$$ language plpgsql;

-- Create the single trigger
create trigger votes_trigger
  after insert or update or delete on votes
  for each row
  execute function update_rating_vote_counts();
